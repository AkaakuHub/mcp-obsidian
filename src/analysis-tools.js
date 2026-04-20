import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Errors } from './errors.js';
import { prepareFrontmatterUpdate } from './frontmatter.js';
import { extractFrontmatter } from './metadata.js';
import { collectTaskStyleVariants, summarizeTasks } from './task-analysis.js';
import { invalidateSnapshotsForVault } from './vault-cache.js';
import { buildFolderTree, buildLinkGraph, buildPreview, getVaultSnapshot, listMarkdownFiles, scanVaultNotes } from './vault-analysis.js';
import { validateMarkdownExtension, validatePathWithinBase, validateRequiredParameters } from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

async function readNoteForMutation(vaultPath, notePath) {
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(notePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const pathValidation = validatePathWithinBase(vaultPath, notePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

  const fullPath = pathValidation.resolvedPath;
  const content = await readFile(fullPath, 'utf-8');
  return { fullPath, content };
}

async function planFrontmatterUpdate(vaultPath, notePath, fields, merge = true) {
  const { fullPath, content } = await readNoteForMutation(vaultPath, notePath);
  const prepared = prepareFrontmatterUpdate(content, fields, merge);

  return {
    path: notePath,
    fullPath,
    originalContent: content,
    nextContent: prepared.nextContent,
    before: prepared.before,
    after: prepared.after,
    changes: prepared.changes
  };
}

export async function getVaultStructure(vaultPath, options = {}) {
  const { directory = null } = options;
  const snapshot = await getVaultSnapshot(vaultPath, { directory });
  const folders = buildFolderTree(snapshot.notes.map((note) => note.path));

  return {
    root: directory || '',
    folderCount: folders.length,
    noteCount: snapshot.notes.length,
    folders
  };
}

export async function listNotesDetailed(vaultPath, options = {}) {
  const { directory = null, limit = 100, offset = 0, sortBy = 'updatedAt', order = 'desc' } = options;
  const snapshot = await getVaultSnapshot(vaultPath, { directory });
  const linkGraph = buildLinkGraph(snapshot.notes);
  const linkIndex = new Map(linkGraph.nodes.map((node) => [node.path, node]));

  const notes = snapshot.notes.map((note) => ({
    path: note.path,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    sizeBytes: note.sizeBytes,
    lineCount: note.lineCount,
    tags: note.tags,
    linkCount: note.linkCount,
    backlinkCount: linkIndex.get(note.path)?.inboundCount || 0,
    taskCount: note.taskCount
  }));

  notes.sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    const direction = order === 'asc' ? 1 : -1;

    if (leftValue === rightValue) {
      return left.path.localeCompare(right.path);
    }

    return leftValue > rightValue ? direction : -direction;
  });

  const paginatedNotes = notes.slice(offset, offset + limit);
  const returned = paginatedNotes.length;

  return {
    notes: paginatedNotes,
    count: paginatedNotes.length,
    errors: snapshot.errors,
    pagination: {
      total: snapshot.total,
      returned,
      limit,
      offset,
      hasMore: offset + returned < snapshot.total
    }
  };
}

export async function previewNotes(vaultPath, options = {}) {
  const { directory = null, limit = 50, offset = 0, previewLines = 20 } = options;
  const scan = await scanVaultNotes(vaultPath, { directory, limit, offset, includeContent: true });

  return {
    notes: scan.notes.map((note) => ({
      path: note.path,
      title: note.title,
      preview: buildPreview(note.content || '', previewLines)
    })),
    count: scan.notes.length,
    errors: scan.errors,
    pagination: scan.pagination
  };
}

export async function readFrontmatter(vaultPath, notePath) {
  const { content } = await readNoteForMutation(vaultPath, notePath);
  const { frontmatter } = extractFrontmatter(content);

  return {
    path: notePath,
    frontmatter
  };
}

export async function writeFrontmatter(vaultPath, notePath, fields, options = {}) {
  const { merge = true, dryRun = true } = options;
  const plan = await planFrontmatterUpdate(vaultPath, notePath, fields, merge);

  if (!dryRun) {
    await writeFile(plan.fullPath, plan.nextContent, 'utf-8');
    invalidateSnapshotsForVault(vaultPath);
  }

  return {
    path: notePath,
    dryRun,
    written: !dryRun,
    changes: plan.changes,
    before: plan.before,
    after: plan.after
  };
}

export async function bulkUpdateFrontmatter(vaultPath, options = {}) {
  const {
    paths = [],
    directory = null,
    fields = {},
    merge = true,
    dryRun = true,
    limit = 100
  } = options;

  let targetPaths = paths;

  if (targetPaths.length === 0) {
    const files = await listMarkdownFiles(vaultPath, directory);
    targetPaths = files.slice(0, limit).map((file) => path.relative(vaultPath, file));
  }

  const plannedResults = [];
  const validationErrors = [];

  for (const notePath of targetPaths) {
    try {
      const plan = await planFrontmatterUpdate(vaultPath, notePath, fields, merge);
      plannedResults.push(plan);
    } catch (error) {
      validationErrors.push({
        path: notePath,
        error: error.message || String(error)
      });
    }
  }

  if (validationErrors.length > 0) {
    return {
      dryRun,
      applied: false,
      validationFailed: true,
      targetCount: targetPaths.length,
      updatedCount: 0,
      errors: validationErrors,
      results: plannedResults.map((plan) => ({
        path: plan.path,
        dryRun: true,
        written: false,
        changes: plan.changes,
        before: plan.before,
        after: plan.after
      }))
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      applied: false,
      validationFailed: false,
      targetCount: targetPaths.length,
      updatedCount: plannedResults.filter((result) => result.changes.length > 0).length,
      errors: [],
      results: plannedResults.map((plan) => ({
        path: plan.path,
        dryRun: true,
        written: false,
        changes: plan.changes,
        before: plan.before,
        after: plan.after
      }))
    };
  }

  const appliedPlans = [];

  try {
    for (const plan of plannedResults) {
      if (plan.changes.length === 0) {
        continue;
      }

      await writeFile(plan.fullPath, plan.nextContent, 'utf-8');
      appliedPlans.push(plan);
    }
  } catch (error) {
    for (const appliedPlan of appliedPlans.reverse()) {
      await writeFile(appliedPlan.fullPath, appliedPlan.originalContent, 'utf-8');
    }

    invalidateSnapshotsForVault(vaultPath);
    return {
      dryRun: false,
      applied: false,
      validationFailed: false,
      rolledBack: true,
      targetCount: targetPaths.length,
      updatedCount: 0,
      errors: [{
        path: appliedPlans[appliedPlans.length - 1]?.path || null,
        error: error.message || String(error)
      }],
      results: plannedResults.map((plan) => ({
        path: plan.path,
        dryRun: false,
        written: false,
        changes: plan.changes,
        before: plan.before,
        after: plan.after
      }))
    };
  }

  invalidateSnapshotsForVault(vaultPath);

  return {
    dryRun: false,
    applied: true,
    validationFailed: false,
    targetCount: targetPaths.length,
    updatedCount: plannedResults.filter((result) => result.changes.length > 0).length,
    errors: [],
    results: plannedResults.map((plan) => ({
      path: plan.path,
      dryRun: false,
      written: plan.changes.length > 0,
      changes: plan.changes,
      before: plan.before,
      after: plan.after
    }))
  };
}

export async function extractTasks(vaultPath, options = {}) {
  const { directory = null, includeCompleted = true, limit = 500, offset = 0 } = options;
  const scan = await getVaultSnapshot(vaultPath, { directory, includeContent: true });

  let tasks = scan.notes.flatMap((note) => note.tasks);
  if (!includeCompleted) {
    tasks = tasks.filter((task) => !task.completed);
  }

  const slicedTasks = tasks.slice(offset, offset + limit);

  return {
    tasks: slicedTasks,
    count: slicedTasks.length,
    total: tasks.length,
    summaryByNote: summarizeTasks(tasks).slice(0, 20),
    pagination: {
      total: tasks.length,
      returned: slicedTasks.length,
      limit,
      offset,
      hasMore: offset + slicedTasks.length < tasks.length
    }
  };
}

export async function analyzeLinks(vaultPath, options = {}) {
  const { notePath = null, directory = null } = options;
  const scan = await getVaultSnapshot(vaultPath, { directory });
  const graph = buildLinkGraph(scan.notes);

  if (notePath) {
    const node = graph.nodes.find((candidate) => candidate.path === notePath);
    if (!node) {
      throw Errors.resourceNotFound(notePath, { path: notePath });
    }

    return node;
  }

  return {
    notes: graph.nodes,
    orphanCount: graph.orphans.length,
    hubCount: graph.hubs.length,
    orphans: graph.orphans,
    hubs: graph.hubs
  };
}

export async function collectTaskStyles(vaultPath, options = {}) {
  const { directory = null } = options;
  const scan = await getVaultSnapshot(vaultPath, { directory, includeContent: true });
  const variants = scan.notes.flatMap((note) => collectTaskStyleVariants(note.content, note.path));

  return {
    variants,
    count: variants.length
  };
}
