import { diffFrontmatter, upsertFrontmatter } from './frontmatter.js';
import { Errors } from './errors.js';
import { extractFrontmatter } from './metadata.js';
import { extractFrontmatterTags, extractInlineTags } from './tags.js';
import { readResolvedNote, writeNote } from './tools.js';
import { getVaultSnapshot } from './vault-analysis.js';

function normalizeTag(tag) {
  return String(tag || '').trim().replace(/^#+/, '');
}

function normalizeTags(tags) {
  const uniqueTags = [];
  const seen = new Set();

  for (const rawTag of tags || []) {
    const tag = normalizeTag(rawTag);
    if (!tag || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    uniqueTags.push(tag);
  }

  return uniqueTags;
}

function sortTagEntries(entries) {
  return entries.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.tag.localeCompare(right.tag);
  });
}

function buildTagInventory(notes, includeNotes) {
  const tagMap = new Map();

  for (const note of notes) {
    for (const tag of note.tags || []) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          tag,
          count: 0,
          notes: []
        });
      }

      const entry = tagMap.get(tag);
      entry.count += 1;
      if (includeNotes) {
        entry.notes.push(note.path);
      }
    }
  }

  return sortTagEntries([...tagMap.values()].map((entry) => ({
    ...entry,
    notes: includeNotes ? entry.notes.sort() : []
  })));
}

function applyTagMode(currentTags, requestedTags, mode) {
  if (mode === 'replace') {
    return requestedTags;
  }

  if (mode === 'add') {
    return normalizeTags([...currentTags, ...requestedTags]);
  }

  if (mode === 'remove') {
    return currentTags.filter((tag) => !requestedTags.includes(tag));
  }

  throw Errors.invalidParams(`Unsupported tag mode: ${mode}`, { mode });
}

export async function listTags(vaultPath, options = {}) {
  const { notePath = null, directory = null, includeNotes = false } = options;

  if (notePath) {
    const note = await readResolvedNote(vaultPath, notePath);
    const { parseError } = extractFrontmatter(note.content);
    const frontmatterTags = normalizeTags(extractFrontmatterTags(note.content));
    const inlineTags = normalizeTags(extractInlineTags(note.content));

    return {
      path: note.path,
      frontmatterTags,
      inlineTags,
      tags: normalizeTags([...frontmatterTags, ...inlineTags]),
      frontmatterError: parseError
    };
  }

  const snapshot = await getVaultSnapshot(vaultPath, { directory });
  const tags = buildTagInventory(snapshot.notes, includeNotes);

  return {
    tags,
    count: tags.length,
    noteCount: snapshot.notes.length
  };
}

export async function writeTags(vaultPath, notePath, tagsInput, options = {}) {
  const { mode = 'replace', dryRun = true } = options;

  if (!Array.isArray(tagsInput)) {
    throw Errors.invalidParams('tags must be an array', { path: notePath });
  }

  const note = await readResolvedNote(vaultPath, notePath);
  const { frontmatter, parseError } = extractFrontmatter(note.content);
  if (parseError) {
    throw Errors.invalidParams(`Invalid frontmatter: ${parseError}`, { path: note.path });
  }

  const requestedTags = normalizeTags(tagsInput);
  const beforeFrontmatterTags = normalizeTags(extractFrontmatterTags(note.content));
  const afterFrontmatterTags = applyTagMode(beforeFrontmatterTags, requestedTags, mode);
  const inlineTagsDetected = normalizeTags(extractInlineTags(note.content));
  const nextFrontmatter = {
    ...(frontmatter || {})
  };

  if (afterFrontmatterTags.length === 0) {
    delete nextFrontmatter.tags;
  } else {
    nextFrontmatter.tags = afterFrontmatterTags;
  }

  const changes = diffFrontmatter(frontmatter || {}, nextFrontmatter);
  const addedTags = afterFrontmatterTags.filter((tag) => !beforeFrontmatterTags.includes(tag));
  const removedTags = beforeFrontmatterTags.filter((tag) => !afterFrontmatterTags.includes(tag));

  if (!dryRun) {
    const nextContent = upsertFrontmatter(note.content, nextFrontmatter);
    await writeNote(vaultPath, note.path, nextContent);
  }

  return {
    path: note.path,
    dryRun,
    written: !dryRun,
    mode,
    beforeFrontmatterTags,
    afterFrontmatterTags,
    inlineTagsDetected,
    addedTags,
    removedTags,
    changes
  };
}
