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

  return {
    rawTarget,
    format,
    targetPath,
    decodedTargetPath,
    fragment,
    extension,
    isExternal: isExternalTarget(targetPath),
    isAsset: extension.length > 0 && extension !== '.md'
  };
}

export function extractInternalAssetLinks(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const links = [];

  content.replace(markdownLinkPattern, (match, prefix, target, suffix, offset) => {
    const parsed = parseLinkTarget(target, 'markdown');
    if (parsed.isAsset && !parsed.isExternal) {
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
    if (parsed.isAsset && !parsed.isExternal) {
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

export function serializeAssetTarget(format, targetPath, fragment = '') {
  const normalizedPath = normalizeSlashes(targetPath);
  if (format === 'markdown') {
    return `${encodeURI(normalizedPath)}${fragment}`;
  }
  return `${normalizedPath}${fragment}`;
}

export function rewriteAssetTargets(content, replacements) {
  if (!content || replacements.size === 0) {
    return content;
  }

  return content
    .replace(markdownLinkPattern, (match, prefix, target, suffix) => {
      const replacement = replacements.get(`markdown:${target}`);
      return replacement ? `${prefix}${replacement}${suffix}` : match;
    })
    .replace(wikilinkPattern, (match, prefix, target, alias = '', suffix) => {
      const replacement = replacements.get(`wikilink:${target}`);
      return replacement ? `${prefix}${replacement}${alias}${suffix}` : match;
    });
}

export function isPathInsideDirectory(directoryPath, targetPath) {
  const relativePath = path.relative(directoryPath, targetPath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

export function buildDestinationAssetPath(sourceNoteDirectory, destinationNoteDirectory, assetPath) {
  const relativeAssetPath = path.relative(sourceNoteDirectory, assetPath);
  return path.join(destinationNoteDirectory, relativeAssetPath);
}
