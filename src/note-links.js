import path from 'path';

const markdownLinkPattern = /(!?\[[^\]]*\]\()([^)]+)(\))/g;
const wikilinkPattern = /(!?\[\[)([^[\]|]+)(\|[^\]]+)?(\]\])/g;

function normalizeSlashes(value) {
  return value.replace(/\\/g, '/');
}

function stripAngleBrackets(value) {
  if (value.startsWith('<') && value.endsWith('>')) {
    return value.slice(1, -1);
  }
  return value;
}

function splitTargetAndFragment(target) {
  const hashIndex = target.indexOf('#');
  if (hashIndex === -1) {
    return {
      targetPath: target,
      fragment: ''
    };
  }

  return {
    targetPath: target.slice(0, hashIndex),
    fragment: target.slice(hashIndex)
  };
}

function isExternalTarget(targetPath) {
  return /^(?:https?:\/\/|obsidian:\/\/|file:\/\/|mailto:)/i.test(targetPath);
}

function parseLinkTarget(rawTarget, format) {
  const cleanedTarget = stripAngleBrackets(rawTarget.trim());
  const { targetPath, fragment } = splitTargetAndFragment(cleanedTarget);
  const decodedTargetPath = format === 'markdown'
    ? decodeURI(targetPath)
    : targetPath;
  const extension = path.extname(decodedTargetPath).toLowerCase();
  const isNote = extension.length === 0 || extension === '.md';

  return {
    rawTarget,
    format,
    targetPath,
    decodedTargetPath,
    fragment,
    extension,
    isExternal: isExternalTarget(targetPath),
    isNote
  };
}

function extractMarkdownLabel(prefix) {
  const match = /^!?\[([^\]]*)\]\($/.exec(prefix);
  return match ? match[1].trim() : '';
}

function fallbackLabel(decodedTargetPath) {
  return path.basename(decodedTargetPath, path.extname(decodedTargetPath));
}

export function extractInternalNoteLinks(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const links = [];

  content.replace(markdownLinkPattern, (match, prefix, target, suffix, offset) => {
    const parsed = parseLinkTarget(target, 'markdown');
    if (parsed.isNote && !parsed.isExternal) {
      links.push({
        format: 'markdown',
        match,
        prefix,
        suffix,
        offset,
        ...parsed
      });
    }
    return match;
  });

  content.replace(wikilinkPattern, (match, prefix, target, alias = '', suffix, offset) => {
    const parsed = parseLinkTarget(target, 'wikilink');
    if (parsed.isNote && !parsed.isExternal) {
      links.push({
        format: 'wikilink',
        match,
        prefix,
        alias,
        suffix,
        offset,
        ...parsed
      });
    }
    return match;
  });

  return links;
}

function serializeNoteTarget(format, notePath, fragment = '') {
  const normalizedPath = normalizeSlashes(notePath);

  if (format === 'markdown') {
    return `${encodeURI(normalizedPath)}${fragment}`;
  }

  return `${normalizedPath.replace(/\.md$/i, '')}${fragment}`;
}

export function buildMovedNoteLinkReplacement(link, destinationNotePath) {
  const target = serializeNoteTarget(link.format, destinationNotePath, link.fragment);

  if (link.format === 'markdown') {
    return `${link.prefix}${target}${link.suffix}`;
  }

  return `${link.prefix}${target}${link.alias || ''}${link.suffix}`;
}

export function buildDeletedNoteLinkReplacement(link) {
  if (link.format === 'markdown') {
    return extractMarkdownLabel(link.prefix) || fallbackLabel(link.decodedTargetPath);
  }

  return (link.alias ? link.alias.slice(1).trim() : '') || fallbackLabel(link.decodedTargetPath);
}

export function rewriteNoteLinks(content, replacements) {
  if (!content || replacements.size === 0) {
    return content;
  }

  return content
    .replace(markdownLinkPattern, (match) => replacements.get(match) ?? match)
    .replace(wikilinkPattern, (match) => replacements.get(match) ?? match);
}
