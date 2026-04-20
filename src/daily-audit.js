function dateLikeStem(stem) {
  return /^\d{4}-\d{2}-\d{2}$/.test(stem) || /^\d{8}$/.test(stem);
}

function classifyDailyNote(note) {
  const lowerPath = note.path.toLowerCase();
  const lowerStem = note.stem.toLowerCase();

  if (lowerPath.includes('/daily/') || lowerPath.startsWith('daily/')) {
    return 'daily';
  }

  if (lowerPath.includes('/journal/') || lowerPath.startsWith('journal/')) {
    return 'journal';
  }

  if (lowerPath.includes('thino')) {
    return 'thino';
  }

  if (lowerPath.includes('/log/') || lowerStem.includes('log')) {
    return 'log';
  }

  if (dateLikeStem(note.stem)) {
    return 'dated-note';
  }

  return null;
}

export function buildDailyNoteDetection(scan) {
  const notes = scan.notes
    .map((note) => ({
      path: note.path,
      title: note.title,
      category: classifyDailyNote(note)
    }))
    .filter((note) => note.category);

  return {
    notes,
    count: notes.length
  };
}

export function buildDailyJournalAudit(scan) {
  const candidates = scan.notes.map((note) => ({
    path: note.path,
    category: classifyDailyNote(note),
    updatedAt: note.updatedAt,
    title: note.title
  }));

  const entryPoints = candidates.filter((candidate) => candidate.category);
  const migrationCandidates = scan.notes
    .filter((note) => !classifyDailyNote(note) && note.path.toLowerCase().includes('memo'))
    .map((note) => ({
      path: note.path,
      suggestedCategory: 'journal'
    }));

  const dailyReadyNotes = scan.notes
    .filter((note) => note.tags.includes('daily') || note.tags.includes('journal'))
    .map((note) => note.path);

  return {
    entryPoints,
    dailyReadyNotes,
    migrationCandidates
  };
}
