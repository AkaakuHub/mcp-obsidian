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
  executeNoteAssetMoves,
  planNoteAssetMoves,
  rewriteMovedNoteAssets
} from './note-asset-moves.js';
import {
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
  const pathValidation = validatePathWithinBase(vaultPath, notePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

  const fullPath = pathValidation.resolvedPath;

  try {
    await access(fullPath, constants.R_OK);
    return fullPath;
  } catch {
    // Fallback: search by filename
  }

  const basename = path.basename(notePath);
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
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(notePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const fullPath = await resolveNotePath(vaultPath, notePath);

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
  const paramValidation = validateRequiredParameters({ path: notePath, content }, ['path', 'content']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(notePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const pathValidation = validatePathWithinBase(vaultPath, notePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

  const fullPath = pathValidation.resolvedPath;
  const dir = path.dirname(fullPath);
  const sanitizedContent = sanitizeContentPure(content);
  const sizeValidation = validateFileSizePure(Buffer.byteLength(sanitizedContent, 'utf-8'), config.limits.maxFileSize);
  assertValid(sizeValidation, (msg, data) => Errors.invalidParams(msg, { path: notePath, ...data }));

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, sanitizedContent, 'utf-8');
    invalidateSnapshotsForVault(vaultPath);
    return notePath;
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

export async function appendToNote(vaultPath, notePath, content, options = {}) {
  const { separator = '\n\n' } = options;
  const paramValidation = validateRequiredParameters({ path: notePath, content }, ['path', 'content']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const note = await readResolvedNote(vaultPath, notePath);
  const nextContent = joinWithSeparator(note.content, content, separator);
  await writeNote(vaultPath, note.path, nextContent);

  return {
    path: note.path,
    status: 'appended',
    appendedLength: content.length,
    newContentLength: nextContent.length
  };
}

export async function moveNote(vaultPath, sourcePath, destinationPath, overwrite = false) {
  const paramValidation = validateRequiredParameters(
    { sourcePath, destinationPath },
    ['sourcePath', 'destinationPath']
  );
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const sourceExtensionValidation = validateMarkdownExtension(sourcePath);
  assertValid(sourceExtensionValidation, (msg) => Errors.invalidParams(msg, { path: sourcePath }));

  const destinationExtensionValidation = validateMarkdownExtension(destinationPath);
  assertValid(destinationExtensionValidation, (msg) => Errors.invalidParams(msg, { path: destinationPath }));

  const fullSourcePath = await resolveNotePath(vaultPath, sourcePath);
  const destinationValidation = validatePathWithinBase(vaultPath, destinationPath);
  assertValid(destinationValidation, (msg) => Errors.accessDenied(msg, { path: destinationPath }));

  const fullDestinationPath = destinationValidation.resolvedPath;
  const resolvedSourcePath = toVaultRelativePath(vaultPath, fullSourcePath);

  if (resolvedSourcePath === destinationPath) {
    throw Errors.invalidParams('sourcePath and destinationPath must differ', {
      sourcePath: resolvedSourcePath,
      destinationPath
    });
  }

  const assetPlan = await planNoteAssetMoves(vaultPath, fullSourcePath, fullDestinationPath);

  try {
    await access(fullDestinationPath, constants.F_OK);
    if (!overwrite) {
      throw Errors.invalidParams(`Destination already exists: ${destinationPath}`, {
        path: destinationPath
      });
    }
    await unlink(fullDestinationPath);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    if (error.code !== 'ENOENT') {
      throw Errors.internalError(`Failed to prepare destination: ${error.message}`, {
        sourcePath: resolvedSourcePath,
        destinationPath
      });
    }
  }

  let noteMoved = false;

  try {
    await mkdir(path.dirname(fullDestinationPath), { recursive: true });
    await rename(fullSourcePath, fullDestinationPath);
    noteMoved = true;
    await executeNoteAssetMoves(vaultPath, assetPlan, overwrite);
    await rewriteMovedNoteAssets(fullDestinationPath, assetPlan);
    invalidateSnapshotsForVault(vaultPath);
    return {
      fromPath: resolvedSourcePath,
      path: destinationPath,
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

    throw Errors.internalError(`Failed to move note: ${error.message}`, {
      sourcePath: resolvedSourcePath,
      destinationPath
    });
  }
}

export async function deleteNote(vaultPath, notePath) {
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(notePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const pathValidation = validatePathWithinBase(vaultPath, notePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

  const fullPath = pathValidation.resolvedPath;

  try {
    await access(fullPath, constants.W_OK);
  } catch {
    throw Errors.resourceNotFound(notePath, { path: notePath });
  }

  try {
    await unlink(fullPath);
    invalidateSnapshotsForVault(vaultPath);
    return notePath;
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
