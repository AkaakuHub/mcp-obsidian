import { readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { Errors } from './errors.js';
import { prepareFrontmatterUpdate } from './frontmatter.js';
import { extractFrontmatter } from './metadata.js';
import { invalidateSnapshotsForVault } from './vault-cache.js';
import { listMarkdownFiles } from './vault-analysis.js';
import { validateFileSize, validateMarkdownExtension, validatePathWithinBase, validateRequiredParameters } from './validation.js';

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
  let stats;
  try {
    stats = await stat(fullPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Errors.resourceNotFound(notePath, { path: notePath });
    }
    throw Errors.internalError(`Failed to inspect note: ${error.message}`, { path: notePath });
  }

  const sizeValidation = validateFileSize(stats.size, config.limits.maxFileSize);
  assertValid(sizeValidation, (msg, data) => Errors.invalidParams(msg, { path: notePath, ...data }));

  let content;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Errors.resourceNotFound(notePath, { path: notePath });
    }
    throw Errors.internalError(`Failed to read note: ${error.message}`, { path: notePath });
  }

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

export async function readFrontmatter(vaultPath, notePath) {
  const { content } = await readNoteForMutation(vaultPath, notePath);
  const { frontmatter, parseError } = extractFrontmatter(content);

  return {
    path: notePath,
    frontmatter,
    parseError
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
  let failedPlanPath = null;

  try {
    for (const plan of plannedResults) {
      if (plan.changes.length === 0) {
        continue;
      }

      failedPlanPath = plan.path;
      await writeFile(plan.fullPath, plan.nextContent, 'utf-8');
      appliedPlans.push(plan);
    }
  } catch (error) {
    const rollbackErrors = [];

    for (const appliedPlan of appliedPlans.reverse()) {
      try {
        await writeFile(appliedPlan.fullPath, appliedPlan.originalContent, 'utf-8');
      } catch (rollbackError) {
        rollbackErrors.push({
          path: appliedPlan.path,
          error: rollbackError.message || String(rollbackError)
        });
      }
    }

    invalidateSnapshotsForVault(vaultPath);
    return {
      dryRun: false,
      applied: false,
      validationFailed: false,
      rolledBack: rollbackErrors.length === 0,
      targetCount: targetPaths.length,
      updatedCount: 0,
      errors: [{
        path: failedPlanPath,
        error: error.message || String(error)
      }],
      rollbackErrors,
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
