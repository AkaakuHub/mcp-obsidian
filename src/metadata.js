/**
 * Pure functional utilities for metadata extraction
 */

import { extractH1Title } from './title-search.js';
import YAML from 'yaml';

/**
 * Extracts frontmatter from markdown content (pure function)
 * @param {string} content - The markdown content
 * @returns {object} Object with frontmatter data and content without frontmatter
 */
export function extractFrontmatter(content) {
  if (!content || !content.trim().startsWith('---')) {
    return {
      frontmatter: {},
      contentWithoutFrontmatter: content || '',
      rawFrontmatter: '',
      parseError: null
    };
  }
  
  const lines = content.split('\n');
  let endIndex = -1;
  
  // Find the closing --- (skip the first line)
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex === -1) {
    // No closing ---, treat as regular content
    return {
      frontmatter: {},
      contentWithoutFrontmatter: content,
      rawFrontmatter: '',
      parseError: null
    };
  }
  
  // Extract YAML content
  const yamlContent = lines.slice(1, endIndex).join('\n');
  const { frontmatter, parseError } = parseYamlContent(yamlContent);
  
  // Get content after frontmatter
  const contentWithoutFrontmatter = lines.slice(endIndex + 1).join('\n');
  
  return {
    frontmatter,
    contentWithoutFrontmatter,
    rawFrontmatter: yamlContent,
    parseError
  };
}

/**
 * Parse YAML content into object (simplified parser)
 * @param {string} yamlContent - YAML string
 * @returns {object} Parsed object
 */
function parseYamlContent(yamlContent) {
  try {
    const document = YAML.parseDocument(yamlContent, {
      prettyErrors: true
    });

    if (document.errors.length > 0) {
      return {
        frontmatter: {},
        parseError: document.errors.map((error) => error.message).join('; ')
      };
    }

    const parsed = document.toJSON();
    return {
      frontmatter: parsed && typeof parsed === 'object' ? parsed : {},
      parseError: null
    };
  } catch (error) {
    return {
      frontmatter: {},
      parseError: error.message || 'Failed to parse frontmatter'
    };
  }
}

/**
 * Extracts inline tags from content (pure function)
 * @param {string} content - The markdown content
 * @returns {string[]} Array of tag names (without #)
 */
export function extractInlineTags(content) {
  if (!content) return [];
  
  // Match #tag-name pattern (alphanumeric and hyphens)
  const tagPattern = /#([a-zA-Z0-9-_]+)/g;
  const matches = content.match(tagPattern) || [];
  
  // Remove # prefix and deduplicate
  const tags = matches.map(tag => tag.substring(1));
  return [...new Set(tags)];
}

/**
 * Extracts the first N characters of content as preview (pure function)
 * @param {string} content - The content to preview
 * @param {number} maxLength - Maximum preview length
 * @returns {string} Preview text
 */
export function extractContentPreview(content, maxLength = 200) {
  if (!content) return '';
  
  // Remove frontmatter if present
  const { contentWithoutFrontmatter } = extractFrontmatter(content);
  
  // Get text content (skip headings)
  const lines = contentWithoutFrontmatter.split('\n');
  const textLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });
  
  const preview = textLines.join(' ').trim();
  
  if (preview.length <= maxLength) {
    return preview;
  }
  
  return preview.substring(0, maxLength - 3) + '...';
}

/**
 * Combines all metadata for a note (pure function)
 * @param {string} content - The markdown content
 * @param {string} path - The file path
 * @returns {object} Complete metadata object
 */
export function extractNoteMetadata(content, path) {
  const { frontmatter, contentWithoutFrontmatter, parseError } = extractFrontmatter(content);
  const inlineTags = extractInlineTags(contentWithoutFrontmatter);
  
  const titleInfo = extractH1Title(content);
  const title = titleInfo ? titleInfo.title : null;
  const titleLine = titleInfo ? titleInfo.line : null;
  
  const hasContent = contentWithoutFrontmatter.trim().length > 0;
  const contentPreview = extractContentPreview(content);
  
  return {
    path,
    frontmatter,
    frontmatterError: parseError,
    title,
    titleLine,
    hasContent,
    contentLength: content.length,
    contentPreview,
    inlineTags
  };
}

/**
 * Transforms batch metadata results (pure function)
 * @param {Array} metadataResults - Array of {file, metadata, error} objects
 * @param {string} basePath - Base path to make paths relative
 * @returns {object} Batch results with notes and errors
 */
export function transformBatchMetadata(metadataResults, basePath) {
  const notes = [];
  const errors = [];
  
  for (const result of metadataResults) {
    if (result.error) {
      errors.push({
        file: makeRelativePath(result.file, basePath),
        error: result.error.message || String(result.error)
      });
    } else if (result.metadata) {
      notes.push({
        ...result.metadata,
        path: makeRelativePath(result.file, basePath)
      });
    }
  }
  
  return {
    notes,
    count: notes.length,
    errors
  };
}

/**
 * Makes a path relative to a base path (pure function)
 * @param {string} absolutePath - The absolute path
 * @param {string} basePath - The base path
 * @returns {string} Relative path
 */
function makeRelativePath(absolutePath, basePath) {
  if (!absolutePath || !basePath) {
    return absolutePath || '';
  }
  
  // Normalize paths by removing trailing slashes
  const normalizedBase = basePath.replace(/\/$/, '');
  const normalizedPath = absolutePath.replace(/\/$/, '');
  
  if (normalizedPath.startsWith(normalizedBase + '/')) {
    return normalizedPath.slice(normalizedBase.length + 1);
  }
  
  return absolutePath;
}
