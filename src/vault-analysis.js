import { readFile, stat } from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { config } from './config.js';
import { Errors } from './errors.js';
import { extractWikilinks } from './links.js';
import { extractFrontmatter, extractNoteMetadata } from './metadata.js';
import { extractTasksFromContent } from './task-analysis.js';
import { extractTags } from './tags.js';
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

function buildPreview(content, previewLines) {
  const { contentWithoutFrontmatter } = extractFrontmatter(content);
  return contentWithoutFrontmatter
    .split('\n')
    .slice(0, previewLines)
    .join('\n')
    .trim();
}

export async function buildNoteRecord(vaultPath, file, options = {}) {
  const {
    includeContent = false,
    previewLines = 12
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
  const preview = buildPreview(content, previewLines);
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
    title: metadata.title,
    tags,
    linkCount: links.length,
    links,
    taskCount: tasks.length,
    tasks,
    hasFrontmatter: Object.keys(metadata.frontmatter).length > 0,
    preview
  };

  if (includeContent) {
    record.content = content;
  }

  return record;
}

export async function scanVaultNotes(vaultPath, options = {}) {
  const {
    directory = null,
    includeContent = false,
    previewLines = 12,
    limit,
    offset = 0
  } = options;

  const files = await listMarkdownFiles(vaultPath, directory);
  const total = files.length;
  const selectedFiles = typeof limit === 'number'
    ? files.slice(offset, offset + limit)
    : files.slice(offset);

  const notes = [];
  const errors = [];

  for (const file of selectedFiles) {
    try {
      const record = await buildNoteRecord(vaultPath, file, { includeContent, previewLines });
      notes.push(record);
    } catch (error) {
      errors.push({
        path: path.relative(vaultPath, file),
        error: error.message || String(error)
      });
    }
  }

  const returned = notes.length;

  return {
    notes,
    errors,
    pagination: typeof limit === 'number'
      ? {
          total,
          returned,
          limit,
          offset,
          hasMore: offset + returned < total
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

    return {
      path: note.path,
      outboundCount: outboundLinks.filter((link) => link.resolvedPath).length,
      inboundCount: inboundLinks.length,
      outboundLinks,
      inboundLinks,
      isOrphan: inboundLinks.length === 0 && outboundLinks.filter((link) => link.resolvedPath).length === 0,
      isHub: inboundLinks.length + outboundLinks.filter((link) => link.resolvedPath).length >= 10
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
