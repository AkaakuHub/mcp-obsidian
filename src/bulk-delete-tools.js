import path from 'path';
import { Errors } from './errors.js';
import { normalizePath } from './asset-references.js';
import { deleteNoteWithFollowup, readResolvedNote } from './note-io-tools.js';
import { planAssetFollowupForDelete } from './asset-followup.js';
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

async function buildDryRunResult(vaultPath, targetPath) {
  const note = await readResolvedNote(vaultPath, targetPath);
  const assetPlan = await planAssetFollowupForDelete(vaultPath, path.join(vaultPath, targetPath));

  return {
    path: note.path,
    status: 'planned',
    assetPaths: assetPlan.assetPaths
      .map((assetPath) => normalizePath(path.relative(vaultPath, assetPath)))
      .sort(),
    errors: []
  };
}

export async function bulkDeleteNote(vaultPath, options = {}) {
  const { dryRun = true } = options;

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

  if (dryRun) {
    const results = [];

    for (const targetPath of targetPaths) {
      results.push(await buildDryRunResult(vaultPath, targetPath));
    }

    return {
      dryRun: true,
      applied: false,
      validationFailed: false,
      targetCount: targetPaths.length,
      deletedCount: 0,
      deletedAssetCount: 0,
      errors: [],
      results
    };
  }

  const errors = [];
  const results = [];
  let deletedCount = 0;
  let deletedAssetCount = 0;

  for (const targetPath of targetPaths) {
    try {
      const result = await deleteNoteWithFollowup(vaultPath, targetPath);
      deletedCount += 1;
      deletedAssetCount += result.deletedAssetPaths.length;
      results.push({
        path: result.path,
        status: 'deleted',
        assetPaths: result.deletedAssetPaths.sort(),
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

  return {
    dryRun: false,
    applied: errors.length === 0,
    validationFailed: false,
    targetCount: targetPaths.length,
    deletedCount,
    deletedAssetCount,
    errors,
    results
  };
}
