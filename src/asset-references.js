import { access } from 'fs/promises';
import { constants } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { extractInternalAssetLinks } from './asset-links.js';
import { getVaultSnapshot } from './vault-analysis.js';

export function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

export async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveAssetCandidate(vaultPath, noteFullPath, link) {
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

export async function collectReferenceOwners(vaultPath, trackedAssetPaths) {
  if (trackedAssetPaths.size === 0) {
    return new Map();
  }

  const snapshot = await getVaultSnapshot(vaultPath, { includeContent: true });
  const owners = new Map();

  for (const note of snapshot.notes) {
    const noteFullPath = path.join(vaultPath, note.path);
    const links = extractInternalAssetLinks(note.content || '');

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

export function isAssetOwnedOnlyBy(owners, assetFullPath, ownerPaths) {
  const expectedOwners = ownerPaths instanceof Set ? ownerPaths : new Set(ownerPaths);
  const actualOwners = owners.get(assetFullPath) ?? new Set();

  if (actualOwners.size !== expectedOwners.size) {
    return false;
  }

  for (const ownerPath of expectedOwners) {
    if (!actualOwners.has(ownerPath)) {
      return false;
    }
  }

  return true;
}
