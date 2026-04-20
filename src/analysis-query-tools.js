import { Errors } from './errors.js';
import { summarizeTasks } from './task-analysis.js';
import { buildLinkGraph, getVaultSnapshot } from './vault-analysis.js';

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
