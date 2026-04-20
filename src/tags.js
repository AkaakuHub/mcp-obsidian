/**
 * Pure functional utilities for tag operations
 */

import { extractFrontmatter } from './metadata.js';

/**
 * Extracts tags from markdown content (pure function)
 * @param {string} content - The markdown content
 * @returns {Array<string>} Array of unique tags
 */
export function extractTags(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }
  
  const tags = new Set();
  
  // Extract frontmatter tags
  const frontmatterTags = extractFrontmatterTags(content);
  frontmatterTags.forEach(tag => tags.add(tag));
  
  // Extract inline tags
  const inlineTags = extractInlineTags(content);
  inlineTags.forEach(tag => tags.add(tag));
  
  return Array.from(tags);
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
    return rawTags
      .filter(tag => typeof tag === 'string')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  if (typeof rawTags === 'string' && rawTags.trim()) {
    return [rawTags.trim()];
  }

  return [];
}

/**
 * Extracts inline tags from content (pure function)
 * @param {string} content - The markdown content
 * @returns {Array<string>} Array of inline tags
 */
export function extractInlineTags(content) {
  // Remove code blocks to avoid false positives
  const contentWithoutCode = removeCodeBlocks(content);
  
  const tags = [];
  // Match hashtags that are not part of headings
  // Tag name can contain letters, numbers, underscore, hyphen, plus, dot, and forward slash
  const inlineTagRegex = /(?:^|[^#\w])#([a-zA-Z0-9_\-+.\/]+?)(?=[^a-zA-Z0-9_\-+\/]|$)/gm;
  let match;
  
  while ((match = inlineTagRegex.exec(contentWithoutCode)) !== null) {
    let tag = match[1];
    // Remove trailing dots (but keep dots inside the tag like .net)
    tag = tag.replace(/\.+$/, '');
    if (tag) tags.push(tag);
  }
  
  return tags;
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
    caseSensitive ? tag : tag.toLowerCase()
  );
  
  const normalizedSearchTags = searchTags.map(tag => 
    caseSensitive ? tag : tag.toLowerCase()
  );
  
  // Check if all search tags are present (AND operation)
  return normalizedSearchTags.every(searchTag => 
    normalizedNoteTags.includes(searchTag)
  );
}
