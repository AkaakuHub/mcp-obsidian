import { readFile, stat } from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { mapWithConcurrency } from './async.js';
import { config } from './config.js';
import { Errors } from './errors.js';
import { extractWikilinks } from './links.js';
import { extractNoteMetadata } from './metadata.js';
import { extractTasksFromContent } from './task-analysis.js';
import { extractTags } from './tags.js';
import { getCachedSnapshot, setCachedSnapshot } from './vault-cache.js';
import { validateFileSize, validatePathWithinBase } from './validation.js';

function assertDirectoryWithinVault(vaultPath, directory) {
  if (!directory) {
    return;
  }

  const pathValidation = validatePathWithinBase(vaultPath, directory);
  if (!pathValidation.valid) {
    throw Errors.accessDenied(pathValidation.error, { path: directory });
  }
}

export async function listMarkdownFiles(vaultPath, directory = null) {
  assertDirectoryWithinVault(vaultPath, directory);

  const searchPattern = directory
    ? path.join(vaultPath, directory, '**/*.md')
    : path.join(vaultPath, '**/*.md');

  const files = await glob(searchPattern);
  return files.sort();
}

async function buildNoteRecord(vaultPath, file, options = {}) {
  const {
    includeContent = false
  } = options;

  const stats = await stat(file);
  const sizeValidation = validateFileSize(stats.size, config.limits.maxFileSize);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }

  const content = await readFile(file, 'utf-8');
  const relativePath = path.relative(vaultPath, file);
  const metadata = extractNoteMetadata(content, relativePath);
  const tags = extractTags(content);
  const links = extractWikilinks(content);
  const tasks = extractTasksFromContent(content, relativePath);
  const lines = content.split('\n');

  const record = {
    path: relativePath,
    name: path.basename(relativePath),
    stem: path.basename(relativePath, '.md'),
    directory: path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath),
    createdAt: stats.birthtime.toISOString(),
    updatedAt: stats.mtime.toISOString(),
    sizeBytes: stats.size,
    lineCount: lines.length,
    frontmatter: metadata.frontmatter,
    frontmatterError: metadata.frontmatterError,
    title: metadata.title,
    titleLine: metadata.titleLine,
    hasContent: metadata.hasContent,
    contentLength: metadata.contentLength,
    contentPreview: metadata.contentPreview,
    inlineTags: metadata.inlineTags,
    tags,
    linkCount: links.length,
    links,
    taskCount: tasks.length,
    tasks,
    hasFrontmatter: Object.keys(metadata.frontmatter).length > 0
  };

  if (includeContent) {
    record.content = content;
  }

  return record;
}

function normalizeScanOptions(options = {}) {
  return {
    directory: options.directory || null,
    includeContent: Boolean(options.includeContent),
  };
}

function createCacheKey(vaultPath, options) {
  return JSON.stringify({
    vaultPath,
    ...normalizeScanOptions(options)
  });
}

async function buildSnapshot(vaultPath, options = {}) {
  const normalizedOptions = normalizeScanOptions(options);
  const files = await listMarkdownFiles(vaultPath, normalizedOptions.directory);
  const results = await mapWithConcurrency(
    files,
    config.limits.maxConcurrentReads,
    async (file) => {
      try {
        return {
          note: await buildNoteRecord(vaultPath, file, normalizedOptions),
          error: null
        };
      } catch (error) {
        return {
          note: null,
          error: {
            path: path.relative(vaultPath, file),
            error: error.message || String(error)
          }
        };
      }
    }
  );

  const notes = [];
  const errors = [];

  for (const result of results) {
    if (result.note) {
      notes.push(result.note);
    }
    if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    notes,
    errors,
    total: files.length
  };
}

export async function getVaultSnapshot(vaultPath, options = {}) {
  const cacheKey = createCacheKey(vaultPath, options);
  const ttlMs = config.cache.snapshotTtlMs;
  const cached = getCachedSnapshot(cacheKey, ttlMs);
  if (cached) {
    return cached;
  }

  const snapshot = await buildSnapshot(vaultPath, options);
  setCachedSnapshot(cacheKey, snapshot);
  return snapshot;
}

export async function scanVaultNotes(vaultPath, options = {}) {
  const { limit, offset = 0 } = options;
  const snapshot = await getVaultSnapshot(vaultPath, options);
  const notes = typeof limit === 'number'
    ? snapshot.notes.slice(offset, offset + limit)
    : snapshot.notes.slice(offset);
  const returned = notes.length;

  return {
    notes,
    errors: snapshot.errors,
    pagination: typeof limit === 'number'
      ? {
          total: snapshot.total,
          returned,
          limit,
          offset,
          hasMore: offset + returned < snapshot.total
        }
      : null
  };
}

function normalizeLinkTarget(target) {
  return target.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
}

export function buildLinkGraph(notes) {
  const aliasMap = new Map();
  const inbound = new Map(notes.map((note) => [note.path, new Set()]));
  const outbound = new Map(notes.map((note) => [note.path, []]));

  for (const note of notes) {
    const relativeWithoutExt = note.path.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
    const stem = note.stem.toLowerCase();

    if (!aliasMap.has(relativeWithoutExt)) {
      aliasMap.set(relativeWithoutExt, note.path);
    }

    if (!aliasMap.has(stem)) {
      aliasMap.set(stem, note.path);
    }
  }

  for (const note of notes) {
    const resolved = [];

    for (const link of note.links) {
      const target = aliasMap.get(normalizeLinkTarget(link));
      resolved.push({
        target: link,
        resolvedPath: target || null
      });

      if (target && target !== note.path) {
        inbound.get(target).add(note.path);
      }
    }

    outbound.set(note.path, resolved);
  }

  const nodes = notes.map((note) => {
    const inboundLinks = [...(inbound.get(note.path) || [])].sort();
    const outboundLinks = outbound.get(note.path) || [];
    const resolvedOutboundCount = outboundLinks.filter((link) => link.resolvedPath).length;

    return {
      path: note.path,
      outboundCount: resolvedOutboundCount,
      inboundCount: inboundLinks.length,
      outboundLinks,
      inboundLinks,
      isOrphan: inboundLinks.length === 0 && resolvedOutboundCount === 0,
      isHub: inboundLinks.length + resolvedOutboundCount >= 10
    };
  }).sort((left, right) => left.path.localeCompare(right.path));

  return {
    nodes,
    orphans: nodes.filter((node) => node.isOrphan).map((node) => node.path),
    hubs: nodes.filter((node) => node.isHub).map((node) => node.path)
  };
}

function createFolderNode(name, nodePath, depth) {
  return {
    name,
    path: nodePath,
    depth,
    noteCount: 0,
    children: []
  };
}

export function buildFolderTree(notePaths) {
  const root = createFolderNode('', '', 0);
  const index = new Map([['', root]]);

  for (const notePath of notePaths) {
    const directory = path.dirname(notePath);
    const segments = directory === '.' ? [] : directory.split(path.sep);

    let currentPath = '';
    let currentNode = root;
    currentNode.noteCount += 1;

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!index.has(currentPath)) {
        const node = createFolderNode(segment, currentPath, currentNode.depth + 1);
        currentNode.children.push(node);
        currentNode.children.sort((left, right) => left.path.localeCompare(right.path));
        index.set(currentPath, node);
      }

      currentNode = index.get(currentPath);
      currentNode.noteCount += 1;
    }
  }

  return root.children;
}
