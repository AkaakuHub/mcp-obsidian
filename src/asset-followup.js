import path from 'path';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import {
  buildDestinationAssetPath,
  extractInternalAssetLinks,
  isPathInsideDirectory,
  rewriteAssetTargets,
  serializeAssetTarget
} from './asset-links.js';
import {
  collectReferenceOwners,
  isAssetOwnedOnlyBy,
  normalizePath,
  pathExists,
  resolveAssetCandidate
} from './asset-references.js';
import { Errors } from './errors.js';
import { sanitizeContent as sanitizeContentPure } from './validation.js';

function buildRewriteMap(vaultPath, resolvedLinks, refsToMove) {
  const replacements = new Map();
  const movedAssetPaths = new Set(refsToMove.map(ref => ref.fullPath));

  for (const ref of resolvedLinks) {
    const isMoved = movedAssetPaths.has(ref.fullPath);
    let replacementPath = null;

    if (isMoved) {
      if (ref.style === 'vault') {
        replacementPath = normalizePath(path.relative(vaultPath, ref.destinationAssetPath));
      }
    } else if (ref.style === 'relative' || ref.style === 'basename') {
      replacementPath = normalizePath(path.relative(vaultPath, ref.fullPath));
    }

    if (!replacementPath) {
      continue;
    }

    const replacement = serializeAssetTarget(ref.format, replacementPath, ref.fragment);
    replacements.set(`${ref.format}:${ref.rawTarget}`, replacement);
  }

  return replacements;
}

export async function planAssetFollowupForMove(vaultPath, sourceNoteFullPath, destinationNoteFullPath) {
  const sourceContent = await readFile(sourceNoteFullPath, 'utf-8');
  const sourceDirectory = path.dirname(sourceNoteFullPath);
  const destinationDirectory = path.dirname(destinationNoteFullPath);
  const assetLinks = extractInternalAssetLinks(sourceContent);
  const resolvedLinks = [];
  const movableLinks = [];

  for (const link of assetLinks) {
    const resolved = await resolveAssetCandidate(vaultPath, sourceNoteFullPath, link);
    if (!resolved) {
      continue;
    }

    const resolvedLink = {
      ...link,
      fullPath: resolved.fullPath,
      style: resolved.style,
      destinationAssetPath: buildDestinationAssetPath(sourceDirectory, destinationDirectory, resolved.fullPath)
    };

    resolvedLinks.push(resolvedLink);

    if (isPathInsideDirectory(sourceDirectory, resolved.fullPath)) {
      movableLinks.push(resolvedLink);
    }
  }

  const candidatePaths = new Set(movableLinks.map(link => link.fullPath));
  const owners = await collectReferenceOwners(vaultPath, candidatePaths);
  const sourceOwnerSet = new Set([sourceNoteFullPath]);
  const refsToMove = movableLinks.filter((link) => {
    return isAssetOwnedOnlyBy(owners, link.fullPath, sourceOwnerSet);
  });

  const uniqueMoves = new Map();
  for (const ref of refsToMove) {
    if (!uniqueMoves.has(ref.fullPath)) {
      uniqueMoves.set(ref.fullPath, {
        sourceAssetPath: ref.fullPath,
        destinationAssetPath: ref.destinationAssetPath
      });
    }
  }

  return {
    sourceContent,
    assetMoves: [...uniqueMoves.values()],
    rewrittenContent: rewriteAssetTargets(sourceContent, buildRewriteMap(vaultPath, resolvedLinks, refsToMove))
  };
}

async function removeExistingDestinationAssets(assetMoves) {
  for (const assetMove of assetMoves) {
    if (await pathExists(assetMove.destinationAssetPath)) {
      await rm(assetMove.destinationAssetPath, { recursive: true, force: true });
    }
  }
}

async function ensureDestinationAssetsAvailable(vaultPath, assetMoves, overwrite) {
  for (const assetMove of assetMoves) {
    const exists = await pathExists(assetMove.destinationAssetPath);
    if (!exists) {
      continue;
    }

    if (!overwrite) {
      throw Errors.invalidParams(`Destination asset already exists: ${normalizePath(path.relative(vaultPath, assetMove.destinationAssetPath))}`, {
        path: normalizePath(path.relative(vaultPath, assetMove.destinationAssetPath))
      });
    }
  }
}

export async function applyAssetFollowupForMove(vaultPath, assetPlan, destinationNoteFullPath, overwrite) {
  await ensureDestinationAssetsAvailable(vaultPath, assetPlan.assetMoves, overwrite);

  if (overwrite) {
    await removeExistingDestinationAssets(assetPlan.assetMoves);
  }

  const completedMoves = [];

  try {
    for (const assetMove of assetPlan.assetMoves) {
      await mkdir(path.dirname(assetMove.destinationAssetPath), { recursive: true });
      await rename(assetMove.sourceAssetPath, assetMove.destinationAssetPath);
      completedMoves.push(assetMove);
    }

    if (assetPlan.rewrittenContent !== assetPlan.sourceContent) {
      await mkdir(path.dirname(destinationNoteFullPath), { recursive: true });
      await writeFile(destinationNoteFullPath, sanitizeContentPure(assetPlan.rewrittenContent), 'utf-8');
    }

    return completedMoves;
  } catch (error) {
    for (const completedMove of completedMoves.reverse()) {
      try {
        await mkdir(path.dirname(completedMove.sourceAssetPath), { recursive: true });
        await rename(completedMove.destinationAssetPath, completedMove.sourceAssetPath);
      } catch {
        // Best-effort rollback.
      }
    }

    throw Errors.internalError(`Failed to move note assets: ${error.message}`);
  }
}

export async function planAssetFollowupForDelete(vaultPath, noteFullPath) {
  const content = await readFile(noteFullPath, 'utf-8');
  const assetLinks = extractInternalAssetLinks(content);
  const resolvedLinks = [];
  const trackedAssets = new Set();

  for (const link of assetLinks) {
    const resolved = await resolveAssetCandidate(vaultPath, noteFullPath, link);
    if (!resolved) {
      continue;
    }

    resolvedLinks.push({
      ...link,
      fullPath: resolved.fullPath
    });
    trackedAssets.add(resolved.fullPath);
  }

  const owners = await collectReferenceOwners(vaultPath, trackedAssets);
  const noteOwnerSet = new Set([noteFullPath]);
  const assetPaths = [...new Set(
    resolvedLinks
      .filter((link) => isAssetOwnedOnlyBy(owners, link.fullPath, noteOwnerSet))
      .map((link) => link.fullPath)
  )].sort();

  return { assetPaths };
}

export async function applyAssetFollowupForDelete(assetPlan) {
  const deletedAssetPaths = [];

  for (const assetFullPath of assetPlan.assetPaths) {
    await rm(assetFullPath);
    deletedAssetPaths.push(assetFullPath);
  }

  return deletedAssetPaths;
}
