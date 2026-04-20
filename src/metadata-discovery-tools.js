import { readFile, stat } from 'fs/promises';
import path from 'path';
import { Errors } from './errors.js';
import { config } from './config.js';
import { getVaultSnapshot } from './vault-analysis.js';
import { paginateArray } from './search.js';
import { extractTags as extractTagsPure, hasAllTags } from './tags.js';
import { extractNoteMetadata } from './metadata.js';
import { isMoc } from './links.js';
import {
  validatePathWithinBase,
  validateMarkdownExtension,
  validateFileSize as validateFileSizePure
} from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

export async function searchByTags(vaultPath, searchTags, directory = null, caseSensitive = false) {
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

export async function getNoteMetadata(vaultPath, notePath, options = {}) {
  const { batch = false, limit = 50, offset = 0 } = options;

  if (!notePath && !batch) {
    throw Errors.invalidParams('Either path or batch mode must be specified');
  }

  if (notePath && !batch) {
    const pathValidation = validatePathWithinBase(vaultPath, notePath);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

    const extensionValidation = validateMarkdownExtension(notePath);
    assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

    const fullPath = pathValidation.resolvedPath;

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

    let content;
    try {
      content = await readFile(fullPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw Errors.resourceNotFound(notePath, { path: notePath });
      }
      throw Errors.internalError(`Failed to read note: ${error.message}`, { path: notePath });
    }

    return extractNoteMetadata(content, notePath);
  }

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

export async function discoverMocs(vaultPath, options = {}) {
  const { mocName, directory } = options;

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

  const mocPaths = new Set(mocs.map((moc) => path.basename(moc.path, '.md')));

  mocs.forEach((moc) => {
    const linkedMocs = moc.linkedNotes.filter((linkedNote) => {
      const linkedBaseName = path.basename(linkedNote, '.md');
      return mocPaths.has(linkedBaseName);
    });

    moc.linkedMocs = linkedMocs;
  });

  return {
    mocs,
    count: mocs.length
  };
}

export const extractTags = extractTagsPure;
