import { access } from 'fs/promises';
import { constants } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { extractInternalAssetLinks } from './asset-links.js';
import { Errors } from './errors.js';
import { getVaultSnapshot } from './vault-analysis.js';
import { validatePathWithinBase } from './validation.js';

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

function isNoteInDirectory(notePath, directory) {
  if (!directory) {
    return true;
  }

  const normalizedDirectory = normalizePath(directory).replace(/\/+$/, '');
  const normalizedNotePath = normalizePath(notePath);
  return normalizedNotePath === normalizedDirectory || normalizedNotePath.startsWith(`${normalizedDirectory}/`);
}

function assertDirectoryWithinVault(vaultPath, directory) {
  if (!directory) {
    return;
  }

  const pathValidation = validatePathWithinBase(vaultPath, directory);
  if (!pathValidation.valid) {
    throw Errors.accessDenied(pathValidation.error, { path: directory });
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

export async function collectAssetReferences(vaultPath, options = {}) {
  const { directory = null } = options;
  assertDirectoryWithinVault(vaultPath, directory);

  const snapshot = await getVaultSnapshot(vaultPath, { includeContent: true });
  const noteReferences = [];
  const owners = new Map();
  const missingAssets = [];

  for (const note of snapshot.notes) {
    const noteFullPath = path.join(vaultPath, note.path);
    const links = extractInternalAssetLinks(note.content || '');
    const resolvedLinks = [];

    for (const link of links) {
      const resolved = await resolveAssetCandidate(vaultPath, noteFullPath, link);
      if (!resolved) {
        if (isNoteInDirectory(note.path, directory)) {
          missingAssets.push({
            notePath: note.path,
            target: link.rawTarget,
            format: link.format
          });
        }
        continue;
      }

      resolvedLinks.push({
        ...link,
        fullPath: resolved.fullPath,
        style: resolved.style
      });

      const currentOwners = owners.get(resolved.fullPath) ?? new Set();
      currentOwners.add(note.path);
      owners.set(resolved.fullPath, currentOwners);
    }

    if (isNoteInDirectory(note.path, directory)) {
      noteReferences.push({
        path: note.path,
        fullPath: noteFullPath,
        assetLinks: resolvedLinks
      });
    }
  }

  return {
    noteReferences,
    owners,
    missingAssets
  };
}

export async function listAssetFiles(vaultPath, directory = null) {
  assertDirectoryWithinVault(vaultPath, directory);

  const searchPattern = directory
    ? path.join(vaultPath, directory, '**/*')
    : path.join(vaultPath, '**/*');

  const files = await glob(searchPattern, { nodir: true });
  return files
    .filter((file) => path.extname(file).toLowerCase() !== '.md')
    .sort();
}
