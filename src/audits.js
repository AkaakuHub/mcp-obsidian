import path from 'path';
import { analyzeLinks, extractTasks } from './analysis-tools.js';
import { collectTaskStyleVariants } from './task-analysis.js';
import { buildLinkGraph, scanVaultNotes } from './vault-analysis.js';

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

function normalizeTitle(title, fallbackStem) {
  return (title || fallbackStem || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  return new Set(value.split(/\s+/).filter(Boolean));
}

function jaccardSimilarity(left, right) {
  const union = new Set([...left, ...right]);
  const intersection = [...left].filter((value) => right.has(value));
  return union.size === 0 ? 0 : intersection.length / union.size;
}

export async function detectDailyNotes(vaultPath, options = {}) {
  const { directory = null } = options;
  const scan = await scanVaultNotes(vaultPath, { directory });
  const candidates = scan.notes
    .map((note) => ({
      path: note.path,
      title: note.title,
      category: classifyDailyNote(note)
    }))
    .filter((note) => note.category);

  return {
    notes: candidates,
    count: candidates.length
  };
}

export async function detectSimilarNotes(vaultPath, options = {}) {
  const { directory = null, threshold = 0.6 } = options;
  const scan = await scanVaultNotes(vaultPath, { directory });
  const pairs = [];

  for (let index = 0; index < scan.notes.length; index++) {
    for (let cursor = index + 1; cursor < scan.notes.length; cursor++) {
      const left = scan.notes[index];
      const right = scan.notes[cursor];
      const leftTokens = tokenize(normalizeTitle(left.title, left.stem));
      const rightTokens = tokenize(normalizeTitle(right.title, right.stem));
      const score = jaccardSimilarity(leftTokens, rightTokens);

      if (score >= threshold) {
        pairs.push({
          left: left.path,
          right: right.path,
          score: Number(score.toFixed(2))
        });
      }
    }
  }

  pairs.sort((left, right) => right.score - left.score || left.left.localeCompare(right.left));

  return {
    pairs,
    count: pairs.length
  };
}

export async function detectLargeNotes(vaultPath, options = {}) {
  const { directory = null, minSizeBytes = 50000, minLineCount = 800 } = options;
  const scan = await scanVaultNotes(vaultPath, { directory });
  const notes = scan.notes.filter((note) => note.sizeBytes >= minSizeBytes || note.lineCount >= minLineCount)
    .map((note) => ({
      path: note.path,
      sizeBytes: note.sizeBytes,
      lineCount: note.lineCount,
      taskCount: note.taskCount
    }))
    .sort((left, right) => right.sizeBytes - left.sizeBytes || right.lineCount - left.lineCount);

  return {
    notes,
    count: notes.length
  };
}

export async function detectUnorganizedNotes(vaultPath, options = {}) {
  const { directory = null } = options;
  const scan = await scanVaultNotes(vaultPath, { directory });
  const graph = buildLinkGraph(scan.notes);
  const graphIndex = new Map(graph.nodes.map((node) => [node.path, node]));

  const notes = scan.notes
    .map((note) => {
      const linkData = graphIndex.get(note.path);
      const reasons = [];

      if (!note.hasFrontmatter) {
        reasons.push('missing-frontmatter');
      }
      if (note.tags.length === 0) {
        reasons.push('missing-tags');
      }
      if (note.linkCount === 0 && (linkData?.inboundCount || 0) === 0) {
        reasons.push('isolated');
      }
      if (!note.directory) {
        reasons.push('root-level');
      }

      return {
        path: note.path,
        reasons
      };
    })
    .filter((note) => note.reasons.length > 0);

  return {
    notes,
    count: notes.length
  };
}

export async function buildVaultInventory(vaultPath, options = {}) {
  const { directory = null } = options;
  const scan = await scanVaultNotes(vaultPath, { directory });
  const graph = buildLinkGraph(scan.notes);
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

export async function auditTasks(vaultPath, options = {}) {
  const { directory = null, hotspotThreshold = 20 } = options;
  const scan = await scanVaultNotes(vaultPath, { directory, includeContent: true });
  const tasks = scan.notes.flatMap((note) => note.tasks);
  const missingDue = tasks.filter((task) => !task.completed && !task.due);
  const hotspots = scan.notes
    .filter((note) => note.taskCount >= hotspotThreshold)
    .map((note) => ({
      path: note.path,
      taskCount: note.taskCount
    }))
    .sort((left, right) => right.taskCount - left.taskCount);

  const styleVariants = scan.notes.flatMap((note) => collectTaskStyleVariants(note.content, note.path));
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

export async function auditDailyJournal(vaultPath, options = {}) {
  const { directory = null } = options;
  const scan = await scanVaultNotes(vaultPath, { directory });
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

export async function proposeNoteRefactors(vaultPath, options = {}) {
  const { directory = null } = options;
  const scan = await scanVaultNotes(vaultPath, { directory });
  const graph = await analyzeLinks(vaultPath, { directory });
  const orphanSet = new Set(graph.orphans);

  const suggestions = [];

  for (const note of scan.notes) {
    if (!note.directory && note.frontmatter.area) {
      suggestions.push({
        type: 'move',
        path: note.path,
        proposedPath: `${note.frontmatter.area}/${path.basename(note.path)}`,
        reason: 'frontmatter-area'
      });
    }

    if (note.title && path.basename(note.path, '.md') !== note.title) {
      const safeTitle = note.title.replace(/[\\/:*?"<>|]/g, '-');
      suggestions.push({
        type: 'rename',
        path: note.path,
        proposedPath: note.directory ? `${note.directory}/${safeTitle}.md` : `${safeTitle}.md`,
        reason: 'title-file-mismatch'
      });
    }

    if (orphanSet.has(note.path)) {
      suggestions.push({
        type: 'link',
        path: note.path,
        proposedAction: 'review for MOC or index links',
        reason: 'isolated-note'
      });
    }
  }

  return {
    mode: 'proposal-only',
    suggestionCount: suggestions.length,
    suggestions
  };
}
