/**
 * Pure functional utilities for tag operations
 */

import { extractFrontmatter } from './metadata.js';
import {
  canonicalizeTag,
  dedupeTags,
  extractInlineTagsFromContent,
  normalizeTagValue
} from './tag-format.js';

/**
 * Extracts tags from markdown content (pure function)
 * @param {string} content - The markdown content
 * @returns {Array<string>} Array of unique tags
 */
export function extractTags(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  return dedupeTags([
    ...extractFrontmatterTags(content),
    ...extractInlineTags(content)
  ]);
}

/**
 * Extracts tags from frontmatter (pure function)
 * @param {string} content - The markdown content
 * @returns {Array<string>} Array of tags from frontmatter
 */
export function extractFrontmatterTags(content) {
  const { frontmatter } = extractFrontmatter(content);
  const rawTags = frontmatter?.tags;

  if (Array.isArray(rawTags)) {
    return dedupeTags(rawTags
      .filter(tag => typeof tag === 'string')
      .map(normalizeTagValue)
      .filter(tag => tag.length > 0));
  }

  if (typeof rawTags === 'string' && rawTags.trim()) {
    return dedupeTags([rawTags]);
  }

  return [];
}

/**
 * Extracts inline tags from content (pure function)
 * @param {string} content - The markdown content
 * @returns {Array<string>} Array of inline tags
 */
export function extractInlineTags(content) {
  return extractInlineTagsFromContent(removeCodeBlocks(content || ''));
}

/**
 * Removes code blocks from content (pure function)
 * @param {string} content - The markdown content
 * @returns {string} Content without code blocks
 */
export function removeCodeBlocks(content) {
  return content.replace(/```[\s\S]*?```/g, '');
}

/**
 * Checks if a note has all specified tags (pure function)
 * @param {Array<string>} noteTags - Tags in the note
 * @param {Array<string>} searchTags - Tags to search for
 * @param {boolean} caseSensitive - Whether to perform case-sensitive matching
 * @returns {boolean} True if note has all search tags
 */
export function hasAllTags(noteTags, searchTags, caseSensitive = false) {
  if (!searchTags || searchTags.length === 0) {
    return true;
  }
  
  const normalizedNoteTags = noteTags.map(tag => 
    caseSensitive ? normalizeTagValue(tag) : canonicalizeTag(tag)
  );
  
  const normalizedSearchTags = searchTags.map(tag => 
    caseSensitive ? normalizeTagValue(tag) : canonicalizeTag(tag)
  );
  
  // Check if all search tags are present (AND operation)
  return normalizedSearchTags.every(searchTag => 
    normalizedNoteTags.includes(searchTag)
  );
}
