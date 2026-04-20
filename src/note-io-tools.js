import { readFile, writeFile, mkdir, unlink, access, stat } from 'fs/promises';
import { constants } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { Errors, MCPError } from './errors.js';
import { config } from './config.js';
import { invalidateSnapshotsForVault } from './vault-cache.js';
import { searchFilenamesWithSnapshot, searchTitlesWithSnapshot, searchVaultWithSnapshot } from './search-tools.js';
import { paginateArray } from './search.js';
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

export async function searchByTitle(vaultPath, query, searchPath, caseSensitive = false, limit = 100, offset = 0) {
  return searchTitlesWithSnapshot(vaultPath, query, searchPath, caseSensitive, limit, offset);
}

export async function searchByFilename(vaultPath, query, searchPath, caseSensitive = false, limit = 100, offset = 0) {
  return searchFilenamesWithSnapshot(vaultPath, query, searchPath, caseSensitive, limit, offset);
}

export async function listNotes(vaultPath, directory, limit = 100, offset = 0) {
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

  return {
    notes: paginatedNotes,
    count: paginatedNotes.length,
    pagination
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
