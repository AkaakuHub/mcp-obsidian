import { access, mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { glob } from 'glob';
import path from 'path';
import {
  buildDestinationAssetPath,
  extractInternalAssetLinks,
  isPathInsideDirectory,
  rewriteAssetTargets,
  serializeAssetTarget
} from './asset-links.js';
import { Errors } from './errors.js';
import { sanitizeContent as sanitizeContentPure } from './validation.js';

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveAssetCandidate(vaultPath, noteFullPath, link) {
  const sourceDirectory = path.dirname(noteFullPath);
  const candidates = new Map();
  const decodedTarget = link.decodedTargetPath;
  const hasPathSeparator = /[\\/]/.test(decodedTarget);

  if (hasPathSeparator) {
    const relativeCandidate = path.resolve(sourceDirectory, decodedTarget);
    if (await pathExists(relativeCandidate)) {
      candidates.set(relativeCandidate, {
        fullPath: relativeCandidate,
        style: 'relative'
      });
    }

    const vaultCandidate = path.resolve(vaultPath, decodedTarget);
    if (await pathExists(vaultCandidate)) {
      candidates.set(vaultCandidate, {
        fullPath: vaultCandidate,
        style: 'vault'
      });
    }
  } else {
    const basenameMatches = await glob(path.join(vaultPath, '**', decodedTarget));
    for (const match of basenameMatches) {
      candidates.set(match, {
        fullPath: match,
        style: 'basename'
      });
    }
  }

  if (candidates.size !== 1) {
    return null;
  }

  return [...candidates.values()][0];
}

async function collectReferenceOwners(vaultPath, trackedAssetPaths) {
  if (trackedAssetPaths.size === 0) {
    return new Map();
  }

  const owners = new Map();
  const notePaths = await glob(path.join(vaultPath, '**/*.md'));

  for (const noteFullPath of notePaths) {
    let content;
    try {
      content = await readFile(noteFullPath, 'utf-8');
    } catch {
      continue;
    }

    const links = extractInternalAssetLinks(content);
    for (const link of links) {
      const resolved = await resolveAssetCandidate(vaultPath, noteFullPath, link);
      if (!resolved || !trackedAssetPaths.has(resolved.fullPath)) {
        continue;
      }

      const currentOwners = owners.get(resolved.fullPath) ?? new Set();
      currentOwners.add(noteFullPath);
      owners.set(resolved.fullPath, currentOwners);
    }
  }

  return owners;
}

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

export async function planNoteAssetMoves(vaultPath, sourceNoteFullPath, destinationNoteFullPath) {
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
  const refsToMove = movableLinks.filter(link => {
    const linkOwners = owners.get(link.fullPath);
    return linkOwners && linkOwners.size === 1 && linkOwners.has(sourceNoteFullPath);
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

export async function executeNoteAssetMoves(vaultPath, assetPlan, overwrite) {
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

export async function rewriteMovedNoteAssets(destinationNoteFullPath, assetPlan) {
  if (assetPlan.rewrittenContent === assetPlan.sourceContent) {
    return;
  }

  await mkdir(path.dirname(destinationNoteFullPath), { recursive: true });
  await writeFile(destinationNoteFullPath, sanitizeContentPure(assetPlan.rewrittenContent), 'utf-8');
}
