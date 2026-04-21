import { readFile, writeFile, mkdir, unlink, access, rename, stat } from 'fs/promises';
import { constants } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { Errors, MCPError } from './errors.js';
import { config } from './config.js';
import { invalidateSnapshotsForVault } from './vault-cache.js';
import { buildFolderTree } from './vault-analysis.js';
import { searchFilenamesWithSnapshot, searchVaultWithSnapshot } from './search-tools.js';
import { paginateArray } from './search.js';
import { flattenFolderTree } from './reorganization-core.js';
import {
  applyAssetFollowupForDelete,
  applyAssetFollowupForMove,
  planAssetFollowupForDelete,
  planAssetFollowupForMove
} from './asset-followup.js';
import {
  applyLinkFollowupPlan,
  planLinkFollowupForDelete,
  planLinkFollowupForMove
} from './link-followup.js';
import {
  normalizeMarkdownNotePath,
  validatePathWithinBase,
  validateMarkdownExtension,
  validateRequiredParameters,
  validateFileSize as validateFileSizePure,
  sanitizeContent as sanitizeContentPure
} from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
  return validationResult;
}

export async function searchVault(vaultPath, query, searchPath, caseSensitive = false, contextOptions = {}, limit = 100, offset = 0) {
  return searchVaultWithSnapshot(vaultPath, query, searchPath, caseSensitive, contextOptions, limit, offset);
}

export async function searchByFilename(vaultPath, query, searchPath, caseSensitive = false, limit = 100, offset = 0) {
  return searchFilenamesWithSnapshot(vaultPath, query, searchPath, caseSensitive, limit, offset);
}

export async function listNotes(vaultPath, directory, limit = 100, offset = 0, includeFolders = false) {
  if (directory) {
    const pathValidation = validatePathWithinBase(vaultPath, directory);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: directory }));
  }

  const searchPath = directory
    ? path.join(vaultPath, directory, '**/*.md')
    : path.join(vaultPath, '**/*.md');

  const files = await glob(searchPath);
  const allNotes = files.map(file => path.relative(vaultPath, file)).sort();
  const { items: paginatedNotes, pagination } = paginateArray(allNotes, limit, offset);
  const folders = includeFolders ? buildFolderTree(allNotes) : [];
  const folderPaths = includeFolders ? flattenFolderTree(folders) : [];

  return {
    notes: paginatedNotes,
    count: paginatedNotes.length,
    pagination,
    root: directory || '',
    folderCount: folderPaths.length,
    folders,
    folderPaths
  };
}

async function resolveNotePath(vaultPath, notePath) {
  const normalizedNotePath = normalizeMarkdownNotePath(notePath);
  const pathValidation = validatePathWithinBase(vaultPath, normalizedNotePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

  const fullPath = pathValidation.resolvedPath;

  try {
    await access(fullPath, constants.R_OK);
    return fullPath;
  } catch {
    // Fallback: search by filename
  }

  const basename = path.basename(normalizedNotePath);
  const searchPattern = path.join(vaultPath, '**', basename);
  const matches = await glob(searchPattern);

  if (matches.length === 0) {
    throw Errors.resourceNotFound(notePath, { path: notePath });
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const relativePaths = matches.map(m => path.relative(vaultPath, m)).join(', ');
  throw Errors.invalidParams(
    `Ambiguous path "${notePath}" matches multiple notes: ${relativePaths}. Please specify the full path.`,
    { path: notePath, matches: relativePaths }
  );
}

function toVaultRelativePath(vaultPath, fullPath) {
  return path.relative(vaultPath, fullPath);
}

export async function readResolvedNote(vaultPath, notePath) {
  const normalizedNotePath = normalizeMarkdownNotePath(notePath);
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(normalizedNotePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const fullPath = await resolveNotePath(vaultPath, normalizedNotePath);

  try {
    const stats = await stat(fullPath);
    const sizeValidation = validateFileSizePure(stats.size, config.limits.maxFileSize);
    assertValid(sizeValidation, (msg, data) =>
      Errors.invalidParams(msg, { path: notePath, ...data })
    );
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw Errors.resourceNotFound(notePath, { path: notePath });
  }

  try {
    const content = await readFile(fullPath, 'utf-8');
    return {
      path: toVaultRelativePath(vaultPath, fullPath),
      content
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Errors.resourceNotFound(notePath, { path: notePath });
    }
    throw Errors.internalError(`Failed to read note: ${error.message}`, { path: notePath });
  }
}

export async function readNote(vaultPath, notePath) {
  const result = await readResolvedNote(vaultPath, notePath);
  return result.content;
}

export async function writeNote(vaultPath, notePath, content) {
  const normalizedNotePath = normalizeMarkdownNotePath(notePath);
  const paramValidation = validateRequiredParameters({ path: notePath, content }, ['path', 'content']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(normalizedNotePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const pathValidation = validatePathWithinBase(vaultPath, normalizedNotePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: normalizedNotePath }));

  const fullPath = pathValidation.resolvedPath;
  const dir = path.dirname(fullPath);
  const sanitizedContent = sanitizeContentPure(content);
  const sizeValidation = validateFileSizePure(Buffer.byteLength(sanitizedContent, 'utf-8'), config.limits.maxFileSize);
  assertValid(sizeValidation, (msg, data) => Errors.invalidParams(msg, { path: notePath, ...data }));

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, sanitizedContent, 'utf-8');
    invalidateSnapshotsForVault(vaultPath);
    return normalizedNotePath;
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw Errors.accessDenied(`Permission denied: ${notePath}`, { path: notePath });
    }
    throw Errors.internalError(`Failed to write note: ${error.message}`, { path: notePath });
  }
}

function joinWithSeparator(existingContent, appendedContent, separator) {
  if (existingContent.length === 0) {
    return appendedContent;
  }

  if (separator.length === 0 || existingContent.endsWith(separator)) {
    return `${existingContent}${appendedContent}`;
  }

  return `${existingContent}${separator}${appendedContent}`;
}

function countOccurrences(content, searchValue) {
  if (searchValue.length === 0) {
    return 0;
  }

  let count = 0;
  let fromIndex = 0;

  while (true) {
    const index = content.indexOf(searchValue, fromIndex);
    if (index === -1) {
      return count;
    }
    count += 1;
    fromIndex = index + searchValue.length;
  }
}

function applySinglePatch(content, patch, notePath) {
  const { match, replace = '', replaceAll = false, expectedMatches } = patch;

  if (typeof match !== 'string' || match.length === 0) {
    throw Errors.invalidParams('Each patch requires a non-empty match string', { path: notePath });
  }

  const actualMatches = countOccurrences(content, match);
  if (actualMatches === 0) {
    throw Errors.invalidParams(`Patch match not found in ${notePath}`, { path: notePath, match });
  }

  if (typeof expectedMatches === 'number' && actualMatches !== expectedMatches) {
    throw Errors.invalidParams(`Patch expected ${expectedMatches} matches but found ${actualMatches} in ${notePath}`, {
      path: notePath,
      match,
      expectedMatches,
      actualMatches
    });
  }

  if (!replaceAll && expectedMatches === undefined && actualMatches !== 1) {
    throw Errors.invalidParams(`Patch match is ambiguous in ${notePath}; found ${actualMatches} matches`, {
      path: notePath,
      match,
      actualMatches
    });
  }

  const nextContent = replaceAll
    ? content.split(match).join(replace)
    : content.replace(match, replace);

  return {
    content: nextContent,
    appliedCount: replaceAll ? actualMatches : 1
  };
}

export async function updateNote(vaultPath, notePath, options = {}) {
  const normalizedNotePath = normalizeMarkdownNotePath(notePath);
  const {
    mode = 'replace',
    content,
    separator = '\n\n',
    patches = []
  } = options;

  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  if (!['replace', 'append', 'patch'].includes(mode)) {
    throw Errors.invalidParams(`Unsupported update mode: ${mode}`, { path: notePath, mode });
  }

  if (mode === 'replace') {
    if (typeof content !== 'string') {
      throw Errors.invalidParams('replace mode requires content', { path: notePath, mode });
    }

    const writtenPath = await writeNote(vaultPath, normalizedNotePath, content);
    return {
      path: writtenPath,
      status: 'written',
      previousContentLength: 0,
      newContentLength: content.length,
      changeCount: 1
    };
  }

  const note = await readResolvedNote(vaultPath, normalizedNotePath);
  const previousContentLength = note.content.length;

  if (mode === 'append') {
    if (typeof content !== 'string') {
      throw Errors.invalidParams('append mode requires content', { path: notePath, mode });
    }

    const nextContent = joinWithSeparator(note.content, content, separator);
    await writeNote(vaultPath, note.path, nextContent);
    return {
      path: note.path,
      status: 'appended',
      previousContentLength,
      newContentLength: nextContent.length,
      changeCount: 1
    };
  }

  if (!Array.isArray(patches) || patches.length === 0) {
    throw Errors.invalidParams('patch mode requires a non-empty patches array', { path: notePath, mode });
  }

  let nextContent = note.content;
  let appliedPatchCount = 0;
  for (const patch of patches) {
    const result = applySinglePatch(nextContent, patch, note.path);
    nextContent = result.content;
    appliedPatchCount += result.appliedCount;
  }

  await writeNote(vaultPath, note.path, nextContent);
  return {
    path: note.path,
    status: 'patched',
    previousContentLength,
    newContentLength: nextContent.length,
    changeCount: appliedPatchCount
  };
}

export async function moveNote(vaultPath, sourcePath, destinationPath, overwrite = false) {
  const normalizedSourcePath = normalizeMarkdownNotePath(sourcePath);
  const normalizedDestinationPath = normalizeMarkdownNotePath(destinationPath);
  const paramValidation = validateRequiredParameters(
    { sourcePath, destinationPath },
    ['sourcePath', 'destinationPath']
  );
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const sourceExtensionValidation = validateMarkdownExtension(normalizedSourcePath);
  assertValid(sourceExtensionValidation, (msg) => Errors.invalidParams(msg, { path: sourcePath }));

  const destinationExtensionValidation = validateMarkdownExtension(normalizedDestinationPath);
  assertValid(destinationExtensionValidation, (msg) => Errors.invalidParams(msg, { path: destinationPath }));

  const fullSourcePath = await resolveNotePath(vaultPath, normalizedSourcePath);
  const destinationValidation = validatePathWithinBase(vaultPath, normalizedDestinationPath);
  assertValid(destinationValidation, (msg) => Errors.accessDenied(msg, { path: destinationPath }));

  const fullDestinationPath = destinationValidation.resolvedPath;
  const resolvedSourcePath = toVaultRelativePath(vaultPath, fullSourcePath);

  if (resolvedSourcePath === normalizedDestinationPath) {
    throw Errors.invalidParams('sourcePath and destinationPath must differ', {
      sourcePath: resolvedSourcePath,
      destinationPath: normalizedDestinationPath
    });
  }

  const assetPlan = await planAssetFollowupForMove(vaultPath, fullSourcePath, fullDestinationPath);
  const linkPlan = await planLinkFollowupForMove(vaultPath, resolvedSourcePath, normalizedDestinationPath);
  let overwriteDestinationAssetPlan = null;
  let overwriteBackupPath = null;
  let overwriteBackupCleanedUp = false;

  try {
    await access(fullDestinationPath, constants.F_OK);
    if (!overwrite) {
      throw Errors.invalidParams(`Destination already exists: ${destinationPath}`, {
        path: normalizedDestinationPath
      });
    }
    overwriteDestinationAssetPlan = await planAssetFollowupForDelete(vaultPath, fullDestinationPath);
    overwriteBackupPath = `${fullDestinationPath}.mcp-overwrite-backup-${Date.now()}`;
    await rename(fullDestinationPath, overwriteBackupPath);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    if (error.code !== 'ENOENT') {
      throw Errors.internalError(`Failed to prepare destination: ${error.message}`, {
        sourcePath: resolvedSourcePath,
        destinationPath: normalizedDestinationPath
      });
    }
  }

  let noteMoved = false;

  try {
    await mkdir(path.dirname(fullDestinationPath), { recursive: true });
    await rename(fullSourcePath, fullDestinationPath);
    noteMoved = true;
    await applyAssetFollowupForMove(vaultPath, assetPlan, fullDestinationPath, overwrite);
    await applyLinkFollowupPlan(vaultPath, linkPlan);
    if (overwriteBackupPath) {
      await applyAssetFollowupForDelete(overwriteDestinationAssetPlan);
      await unlink(overwriteBackupPath);
      overwriteBackupCleanedUp = true;
    }
    invalidateSnapshotsForVault(vaultPath);
    return {
      fromPath: resolvedSourcePath,
      path: normalizedDestinationPath,
      status: 'moved'
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Errors.resourceNotFound(sourcePath, { path: sourcePath });
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw Errors.accessDenied(`Permission denied while moving note to ${destinationPath}`, {
        sourcePath: resolvedSourcePath,
        destinationPath
      });
    }

    if (noteMoved) {
      try {
        await rename(fullDestinationPath, fullSourcePath);
      } catch {
        // Best-effort rollback.
      }
    }

    if (overwriteBackupPath && !overwriteBackupCleanedUp) {
      try {
        await rename(overwriteBackupPath, fullDestinationPath);
      } catch {
        // Best-effort restore.
      }
    }

    throw Errors.internalError(`Failed to move note: ${error.message}`, {
      sourcePath: resolvedSourcePath,
      destinationPath: normalizedDestinationPath
    });
  }
}

async function deleteNoteWithFollowup(vaultPath, notePath) {
  const normalizedNotePath = normalizeMarkdownNotePath(notePath);
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(normalizedNotePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const pathValidation = validatePathWithinBase(vaultPath, normalizedNotePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

  const fullPath = pathValidation.resolvedPath;
  const resolvedNotePath = toVaultRelativePath(vaultPath, fullPath);

  try {
    await access(fullPath, constants.W_OK);
  } catch {
    throw Errors.resourceNotFound(notePath, { path: notePath });
  }

  const assetPlan = await planAssetFollowupForDelete(vaultPath, fullPath);
  const linkPlan = await planLinkFollowupForDelete(vaultPath, resolvedNotePath);

  try {
    await unlink(fullPath);
    const deletedAssetPaths = await applyAssetFollowupForDelete(assetPlan);
    const updatedLinkNotePaths = await applyLinkFollowupPlan(vaultPath, linkPlan);
    invalidateSnapshotsForVault(vaultPath);
    return {
      path: resolvedNotePath,
      status: 'deleted',
      deletedAssetPaths: deletedAssetPaths.map((assetPath) => toVaultRelativePath(vaultPath, assetPath)),
      updatedLinkNotePaths
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Errors.resourceNotFound(notePath, { path: notePath });
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw Errors.accessDenied(`Permission denied: ${notePath}`, { path: notePath });
    }
    throw Errors.internalError(`Failed to delete note: ${error.message}`, { path: notePath });
  }
}

export async function deleteNote(vaultPath, notePath) {
  const result = await deleteNoteWithFollowup(vaultPath, notePath);
  return result.path;
}
