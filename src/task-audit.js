import { collectTaskStyleVariants } from './task-analysis.js';

export function buildTaskAudit(scan, hotspotThreshold = 20) {
  const tasks = scan.notes.flatMap((note) => note.tasks);
  const missingDue = tasks.filter((task) => !task.completed && !task.due);
  const hotspots = scan.notes
    .filter((note) => note.taskCount >= hotspotThreshold)
    .map((note) => ({
      path: note.path,
      taskCount: note.taskCount
    }))
    .sort((left, right) => right.taskCount - left.taskCount);

  const styleVariants = scan.notes.flatMap((note) => collectTaskStyleVariants(note.content || '', note.path));
  const markerCounts = new Map();
  for (const variant of styleVariants) {
    markerCounts.set(variant.marker, (markerCounts.get(variant.marker) || 0) + 1);
  }

  const completionStyles = [...markerCounts.entries()]
    .map(([marker, count]) => ({ marker, count }))
    .sort((left, right) => right.count - left.count || left.marker.localeCompare(right.marker));

  const unclassifiedProjects = scan.notes
    .filter((note) => note.taskCount > 0 && !note.frontmatter.project)
    .map((note) => note.path);

  return {
    totalTasks: tasks.length,
    missingDueCount: missingDue.length,
    missingDueTasks: missingDue.slice(0, 100),
    hotspots,
    completionStyles,
    projectUnclassifiedNotes: unclassifiedProjects
  };
}
