import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import {
  buildDeletedNoteLinkReplacement,
  buildMovedNoteLinkReplacement,
  extractInternalNoteLinks,
  rewriteNoteLinks
} from './note-links.js';
import { getVaultSnapshot } from './vault-analysis.js';
import { sanitizeContent as sanitizeContentPure } from './validation.js';

function normalizeLinkTarget(target) {
  return target.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
}

function buildAliasMap(notes) {
  const aliasMap = new Map();

  for (const note of notes) {
    const relativeWithoutExt = normalizeLinkTarget(note.path);
    const stem = note.stem.toLowerCase();

    if (!aliasMap.has(relativeWithoutExt)) {
      aliasMap.set(relativeWithoutExt, note.path);
    }

    if (!aliasMap.has(stem)) {
      aliasMap.set(stem, note.path);
    } else if (aliasMap.get(stem) !== note.path) {
      aliasMap.set(stem, null);
    }
  }

  return aliasMap;
}

function resolveNotePath(aliasMap, link) {
  return aliasMap.get(normalizeLinkTarget(link.decodedTargetPath)) ?? null;
}

function collectFollowupReplacements(notes, aliasMap, targetPath, replacementFactory, destinationPath = null) {
  const updates = new Map();

  for (const note of notes) {
    const replacements = new Map();
    const noteLinks = extractInternalNoteLinks(note.content || '');

    for (const link of noteLinks) {
      if (resolveNotePath(aliasMap, link) !== targetPath) {
        continue;
      }

      const replacement = destinationPath
        ? replacementFactory(link, destinationPath)
        : replacementFactory(link);

      replacements.set(link.match, replacement);
    }

    if (replacements.size === 0) {
      continue;
    }

    updates.set(note.path, replacements);
  }

  return updates;
}

export async function planLinkFollowupForMove(vaultPath, sourcePath, destinationPath) {
  const snapshot = await getVaultSnapshot(vaultPath, { includeContent: true });
  const aliasMap = buildAliasMap(snapshot.notes);
  const replacements = collectFollowupReplacements(
    snapshot.notes,
    aliasMap,
    sourcePath,
    buildMovedNoteLinkReplacement,
    destinationPath
  );

  return [...replacements.entries()].map(([notePath, noteReplacements]) => ({
    path: notePath === sourcePath ? destinationPath : notePath,
    replacements: [...noteReplacements.entries()]
  }));
}

export async function planLinkFollowupForDelete(vaultPath, notePath) {
  const snapshot = await getVaultSnapshot(vaultPath, { includeContent: true });
  const aliasMap = buildAliasMap(snapshot.notes);
  const remainingNotes = snapshot.notes.filter((note) => note.path !== notePath);
  const replacements = collectFollowupReplacements(
    remainingNotes,
    aliasMap,
    notePath,
    buildDeletedNoteLinkReplacement
  );

  return [...replacements.entries()].map(([targetPath, noteReplacements]) => ({
    path: targetPath,
    replacements: [...noteReplacements.entries()]
  }));
}

export async function applyLinkFollowupPlan(vaultPath, plan) {
  const updatedPaths = [];

  for (const update of plan) {
    const fullPath = path.join(vaultPath, update.path);
    const content = await readFile(fullPath, 'utf-8');
    const rewrittenContent = rewriteNoteLinks(content, new Map(update.replacements));

    if (rewrittenContent === content) {
      continue;
    }

    await writeFile(fullPath, sanitizeContentPure(rewrittenContent), 'utf-8');
    updatedPaths.push(update.path);
  }

  return updatedPaths;
}
