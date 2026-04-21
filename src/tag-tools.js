import { diffFrontmatter, upsertFrontmatter } from './frontmatter.js';
import { Errors } from './errors.js';
import { extractFrontmatter } from './metadata.js';
import { canonicalizeTag, dedupeTags, isValidTag, normalizeTagValue } from './tag-format.js';
import { extractFrontmatterTags, extractInlineTags } from './tags.js';
import { readResolvedNote, writeNote } from './tools.js';
import { getVaultSnapshot } from './vault-analysis.js';

function normalizeTags(tags) {
  return dedupeTags(tags);
}

function ensureValidTags(tags, contextPath) {
  for (const tag of tags) {
    if (!isValidTag(tag)) {
      throw Errors.invalidParams(
        `Invalid tag: ${normalizeTagValue(tag)}. Tags must contain letters, numbers, underscores, hyphens, or forward slashes, and cannot be only numbers.`,
        { path: contextPath, tag: normalizeTagValue(tag) }
      );
    }
  }
}

function sortTagEntries(entries) {
  return entries.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.tag.localeCompare(right.tag, undefined, { sensitivity: 'base' });
  });
}

function buildTagInventory(notes, includeNotes) {
  const tagMap = new Map();

  for (const note of notes) {
    for (const tag of note.tags || []) {
      const canonical = canonicalizeTag(tag);
      if (!canonical) {
        continue;
      }

      if (!tagMap.has(canonical)) {
        tagMap.set(canonical, {
          tag,
          count: 0,
          notes: []
        });
      }

      const entry = tagMap.get(canonical);
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
    const requested = new Set(requestedTags.map(canonicalizeTag));
    return currentTags.filter((tag) => !requested.has(canonicalizeTag(tag)));
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
  ensureValidTags(requestedTags, note.path);
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
  const beforeCanonical = new Set(beforeFrontmatterTags.map(canonicalizeTag));
  const afterCanonical = new Set(afterFrontmatterTags.map(canonicalizeTag));
  const addedTags = afterFrontmatterTags.filter((tag) => !beforeCanonical.has(canonicalizeTag(tag)));
  const removedTags = beforeFrontmatterTags.filter((tag) => !afterCanonical.has(canonicalizeTag(tag)));

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
