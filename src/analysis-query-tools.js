import { summarizeTasks } from './task-analysis.js';
import { getVaultSnapshot } from './vault-analysis.js';

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
