export function buildVaultInventorySummary(scan, graph) {
  const tasks = scan.notes.flatMap((note) => note.tasks);
  const tagDistribution = new Map();

  for (const note of scan.notes) {
    for (const tag of note.tags) {
      tagDistribution.set(tag, (tagDistribution.get(tag) || 0) + 1);
    }
  }

  const topTags = [...tagDistribution.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, 20);

  const recentNotes = [...scan.notes]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 10)
    .map((note) => ({
      path: note.path,
      updatedAt: note.updatedAt
    }));

  const largeNotes = [...scan.notes]
    .sort((left, right) => right.sizeBytes - left.sizeBytes)
    .slice(0, 10)
    .map((note) => ({
      path: note.path,
      sizeBytes: note.sizeBytes,
      lineCount: note.lineCount
    }));

  return {
    noteCount: scan.notes.length,
    folderCount: new Set(scan.notes.map((note) => note.directory).filter(Boolean)).size,
    taskCount: tasks.length,
    orphanCount: graph.orphans.length,
    topTags,
    largeNotes,
    recentNotes,
    orphans: graph.orphans
  };
}
