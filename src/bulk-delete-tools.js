import path from 'path';
import { rm } from 'fs/promises';
import { Errors } from './errors.js';
import { collectAssetReferences, normalizePath } from './asset-references.js';
import { deleteNote, readResolvedNote } from './tools.js';
import { listMarkdownFiles } from './vault-analysis.js';

async function resolveTargetPaths(vaultPath, options = {}) {
  const { paths = [], directory = null } = options;

  if (paths.length > 0) {
    const resolved = [];
    const seen = new Set();

    for (const notePath of paths) {
      const note = await readResolvedNote(vaultPath, notePath);
      if (seen.has(note.path)) {
        throw Errors.invalidParams(`Duplicate note target: ${note.path}`, { path: note.path });
      }
      seen.add(note.path);
      resolved.push(note.path);
    }

    return resolved;
  }

  const files = await listMarkdownFiles(vaultPath, directory);
  return files.map((file) => normalizePath(path.relative(vaultPath, file)));
}

function buildAssetDeletionPlan(targetPaths, noteReferences, owners) {
  const targetSet = new Set(targetPaths);
  const plans = new Map(targetPaths.map((targetPath) => [targetPath, new Set()]));

  for (const note of noteReferences) {
    if (!targetSet.has(note.path)) {
      continue;
    }

    for (const link of note.assetLinks) {
      const noteOwners = owners.get(link.fullPath) ?? new Set();
      const deletable = [...noteOwners].every((ownerPath) => targetSet.has(ownerPath));
      if (deletable) {
        plans.get(note.path).add(link.fullPath);
      }
    }
  }

  return plans;
}

export async function bulkDeleteNote(vaultPath, options = {}) {
  const {
    dryRun = true,
    deleteOwnedAssets = false
  } = options;

  let targetPaths;
  try {
    targetPaths = await resolveTargetPaths(vaultPath, options);
  } catch (error) {
    return {
      dryRun,
      applied: false,
      validationFailed: true,
      targetCount: 0,
      deletedCount: 0,
      deletedAssetCount: 0,
      errors: [{
        path: options.paths?.[0] || options.directory || '',
        error: error.message || String(error)
      }],
      results: []
    };
  }

  const { noteReferences, owners } = deleteOwnedAssets
    ? await collectAssetReferences(vaultPath, {})
    : { noteReferences: [], owners: new Map() };
  const assetDeletionPlan = deleteOwnedAssets
    ? buildAssetDeletionPlan(targetPaths, noteReferences, owners)
    : new Map(targetPaths.map((targetPath) => [targetPath, new Set()]));

  if (dryRun) {
    return {
      dryRun: true,
      applied: false,
      validationFailed: false,
      targetCount: targetPaths.length,
      deletedCount: 0,
      deletedAssetCount: 0,
      errors: [],
      results: targetPaths.map((targetPath) => ({
        path: targetPath,
        status: 'planned',
        assetPaths: [...(assetDeletionPlan.get(targetPath) ?? [])]
          .map((assetPath) => normalizePath(path.relative(vaultPath, assetPath)))
          .sort(),
        errors: []
      }))
    };
  }

  const deletedPaths = new Set();
  const errors = [];
  const results = [];

  for (const targetPath of targetPaths) {
    try {
      await deleteNote(vaultPath, targetPath);
      deletedPaths.add(targetPath);
      results.push({
        path: targetPath,
        status: 'deleted',
        assetPaths: [],
        errors: []
      });
    } catch (error) {
      errors.push({
        path: targetPath,
        error: error.message || String(error)
      });
      results.push({
        path: targetPath,
        status: 'failed',
        assetPaths: [],
        errors: [error.message || String(error)]
      });
    }
  }

  const assetPathsToDelete = new Set();
  if (deleteOwnedAssets) {
    for (const targetPath of deletedPaths) {
      for (const assetFullPath of assetDeletionPlan.get(targetPath) ?? []) {
        const noteOwners = owners.get(assetFullPath) ?? new Set();
        const deletable = [...noteOwners].every((ownerPath) => deletedPaths.has(ownerPath));
        if (deletable) {
          assetPathsToDelete.add(assetFullPath);
        }
      }
    }
  }

  const deletedAssetPaths = [];
  for (const assetFullPath of [...assetPathsToDelete].sort()) {
    const relativePath = normalizePath(path.relative(vaultPath, assetFullPath));

    try {
      await rm(assetFullPath);
      deletedAssetPaths.push(relativePath);
    } catch (error) {
      errors.push({
        path: relativePath,
        error: error.message || String(error)
      });
    }
  }

  for (const result of results) {
    if (result.status !== 'deleted') {
      continue;
    }

    result.assetPaths = [...(assetDeletionPlan.get(result.path) ?? [])]
      .map((assetPath) => normalizePath(path.relative(vaultPath, assetPath)))
      .filter((assetPath) => deletedAssetPaths.includes(assetPath))
      .sort();
  }

  return {
    dryRun: false,
    applied: errors.length === 0,
    validationFailed: false,
    targetCount: targetPaths.length,
    deletedCount: deletedPaths.size,
    deletedAssetCount: deletedAssetPaths.length,
    errors,
    results
  };
}
