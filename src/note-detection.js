import { buildLinkGraph } from './vault-analysis.js';

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

export function buildSimilarNotesDetection(scan, threshold = 0.6) {
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

export function buildLargeNotesDetection(scan, minSizeBytes = 50000, minLineCount = 800) {
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

export function buildUnorganizedNotesDetection(scan) {
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
