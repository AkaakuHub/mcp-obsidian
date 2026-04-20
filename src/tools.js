import { readFile, writeFile, mkdir, unlink, access, stat } from 'fs/promises';
import { constants } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { Errors, MCPError } from './errors.js';
import { config } from './config.js';
import { invalidateSnapshotsForVault } from './vault-cache.js';
import { getVaultSnapshot } from './vault-analysis.js';
import { searchTitlesWithSnapshot, searchVaultWithSnapshot } from './search-tools.js';

// Import pure functions
import { paginateArray } from './search.js';
import { extractTags as extractTagsPure, hasAllTags } from './tags.js';
import { extractNoteMetadata } from './metadata.js';
import { isMoc } from './links.js';
import { 
  validatePathWithinBase, 
  validateMarkdownExtension, 
  validateRequiredParameters,
  validateFileSize as validateFileSizePure,
  sanitizeContent as sanitizeContentPure
} from './validation.js';

/**
 * Wrapper to convert validation results to exceptions
 */
function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
  return validationResult;
}

/**
 * Search for content in vault (I/O function using pure functions)
 */
export async function searchVault(vaultPath, query, searchPath, caseSensitive = false, contextOptions = {}, limit = 100, offset = 0) {
  return searchVaultWithSnapshot(vaultPath, query, searchPath, caseSensitive, contextOptions, limit, offset);
}

/**
 * Search for notes by title (I/O function using pure functions)
 */
export async function searchByTitle(vaultPath, query, searchPath, caseSensitive = false, limit = 100, offset = 0) {
  return searchTitlesWithSnapshot(vaultPath, query, searchPath, caseSensitive, limit, offset);
}

/**
 * List notes in vault (I/O function)
 */
export async function listNotes(vaultPath, directory, limit = 100, offset = 0) {
  // Validate directory path if provided
  if (directory) {
    const pathValidation = validatePathWithinBase(vaultPath, directory);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: directory }));
  }

  const searchPath = directory
    ? path.join(vaultPath, directory, '**/*.md')
    : path.join(vaultPath, '**/*.md');

  const files = await glob(searchPath);
  const allNotes = files.map(file => path.relative(vaultPath, file)).sort();

  // Apply pagination
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

  // Multiple matches - report ambiguity
  const relativePaths = matches.map(m => path.relative(vaultPath, m)).join(', ');
  throw Errors.invalidParams(
    `Ambiguous path "${notePath}" matches multiple notes: ${relativePaths}. Please specify the full path.`,
    { path: notePath, matches: relativePaths }
  );
}

function toVaultRelativePath(vaultPath, fullPath) {
  return path.relative(vaultPath, fullPath);
}

/**
 * Read note content and expose the resolved vault-relative path used.
 */
export async function readResolvedNote(vaultPath, notePath) {
  // Pure validations
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

/**
 * Read note content (I/O function with validation)
 */
export async function readNote(vaultPath, notePath) {
  const result = await readResolvedNote(vaultPath, notePath);
  return result.content;
}

/**
 * Write note content (I/O function with validation)
 */
export async function writeNote(vaultPath, notePath, content) {
  // Pure validations
  const paramValidation = validateRequiredParameters({ path: notePath, content }, ['path', 'content']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));
  
  const extensionValidation = validateMarkdownExtension(notePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));
  
  const pathValidation = validatePathWithinBase(vaultPath, notePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));
  
  const fullPath = pathValidation.resolvedPath;
  const dir = path.dirname(fullPath);
  
  // Pure: Sanitize content
  const sanitizedContent = sanitizeContentPure(content);
  const sizeValidation = validateFileSizePure(Buffer.byteLength(sanitizedContent, 'utf-8'), config.limits.maxFileSize);
  assertValid(sizeValidation, (msg, data) => Errors.invalidParams(msg, { path: notePath, ...data }));
  
  // I/O: Write file
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

/**
 * Delete note (I/O function with validation)
 */
export async function deleteNote(vaultPath, notePath) {
  // Pure validations
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));
  
  const extensionValidation = validateMarkdownExtension(notePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));
  
  const pathValidation = validatePathWithinBase(vaultPath, notePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));
  
  const fullPath = pathValidation.resolvedPath;
  
  // I/O: Check file exists
  try {
    await access(fullPath, constants.W_OK);
  } catch (error) {
    throw Errors.resourceNotFound(notePath, { path: notePath });
  }
  
  // I/O: Delete file
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

/**
 * Search notes by tags (I/O function using pure functions)
 */
export async function searchByTags(vaultPath, searchTags, directory = null, caseSensitive = false) {
  // Validate directory path if provided
  if (directory) {
    const pathValidation = validatePathWithinBase(vaultPath, directory);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: directory }));
  }
  
  const snapshot = await getVaultSnapshot(vaultPath, { directory });
  const results = snapshot.notes
    .filter((note) => hasAllTags(note.tags, searchTags, caseSensitive))
    .map((note) => ({
      path: note.path,
      tags: note.tags
    }));
  
  return {
    notes: results,
    count: results.length
  };
}

/**
 * Get metadata for a note or multiple notes (I/O function using pure functions)
 */
export async function getNoteMetadata(vaultPath, notePath, options = {}) {
  const { batch = false, limit = 50, offset = 0 } = options;

  // Validate that we have either a path or batch mode
  if (!notePath && !batch) {
    throw Errors.invalidParams('Either path or batch mode must be specified');
  }

  // Single note mode
  if (notePath && !batch) {
    // Validate path
    const pathValidation = validatePathWithinBase(vaultPath, notePath);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

    const extensionValidation = validateMarkdownExtension(notePath);
    assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

    const fullPath = pathValidation.resolvedPath;

    // I/O: Check file size
    let stats;
    try {
      stats = await stat(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw Errors.resourceNotFound(notePath, { path: notePath });
      }
      throw Errors.internalError(`Failed to inspect note: ${error.message}`, { path: notePath });
    }
    const sizeValidation = validateFileSizePure(stats.size, config.limits.maxFileSize);
    assertValid(sizeValidation, (msg, data) =>
      Errors.invalidParams(msg, { path: notePath, ...data }));

    // I/O: Read file
    let content;
    try {
      content = await readFile(fullPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw Errors.resourceNotFound(notePath, { path: notePath });
      }
      throw Errors.internalError(`Failed to read note: ${error.message}`, { path: notePath });
    }

    // Pure: Extract metadata
    return extractNoteMetadata(content, notePath);
  }

  // Batch mode
  if (notePath) {
    const pathValidation = validatePathWithinBase(vaultPath, notePath);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));
  }
  const snapshot = await getVaultSnapshot(vaultPath, { directory: notePath || null });
  const { items: notes, pagination } = paginateArray(snapshot.notes, limit, offset);
    return {
      notes: notes.map((note) => ({
        path: note.path,
        frontmatter: note.frontmatter,
        frontmatterError: note.frontmatterError,
        title: note.title,
        titleLine: note.titleLine,
        hasContent: note.hasContent,
        contentLength: note.contentLength,
        contentPreview: note.contentPreview,
        inlineTags: note.inlineTags,
        tags: note.tags
    })),
    count: notes.length,
    errors: snapshot.errors,
    pagination
  };
}

/**
 * Discover MOCs (Maps of Content) in the vault with their linked notes
 * @param {string} vaultPath - The vault base path
 * @param {object} options - Discovery options
 * @param {string} options.mocName - Filter by specific MOC name (optional)
 * @param {string} options.directory - Limit search to specific directory (optional)
 * @returns {Promise<object>} MOCs with their metadata and linked notes
 */
export async function discoverMocs(vaultPath, options = {}) {
  const { mocName, directory } = options;

  // Validate directory path if provided
  if (directory) {
    const pathValidation = validatePathWithinBase(vaultPath, directory);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: directory }));
  }

  const snapshot = await getVaultSnapshot(vaultPath, { directory });
  const mocs = snapshot.notes
    .filter((note) => {
      if (mocName) {
        const filename = path.basename(note.path, '.md');
        if (filename !== mocName && !note.path.includes(`/${mocName}.md`)) {
          return false;
        }
      }

      return isMoc('', note.tags);
    })
    .map((note) => ({
      path: note.path,
      title: note.title || note.stem,
      tags: note.tags,
      linkedNotes: note.links,
      linkCount: note.links.length
    }));

  // Detect MOC hierarchy: find which linked notes are themselves MOCs
  const mocPaths = new Set(mocs.map(m => {
    // Extract just the note name (without .md extension) for matching
    const baseName = path.basename(m.path, '.md');
    return baseName;
  }));

  // For each MOC, check if any of its linked notes are also MOCs
  mocs.forEach(moc => {
    const linkedMocs = moc.linkedNotes.filter(linkedNote => {
      // Extract just the note name from the link (handle nested paths)
      const linkedBaseName = path.basename(linkedNote, '.md');
      return mocPaths.has(linkedBaseName);
    });

    moc.linkedMocs = linkedMocs;
  });

  return {
    mocs: mocs,
    count: mocs.length
  };
}

// Re-export the pure extractTags function for backward compatibility
export const extractTags = extractTagsPure;
