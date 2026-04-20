import { extractFrontmatter } from './metadata.js';
import {
  applyFrontmatterState,
  parseFrontmatterDocument,
  stringifyFrontmatterDocument
} from './frontmatter-document.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeFrontmatterValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeFrontmatterValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeFrontmatterValue(nestedValue)])
    );
  }

  return value;
}

export function serializeFrontmatter(frontmatter) {
  const normalized = normalizeFrontmatterValue(frontmatter || {});
  if (Object.keys(normalized).length === 0) {
    return '';
  }

  const { document } = parseFrontmatterDocument('');
  applyFrontmatterState(document, normalized);
  return stringifyFrontmatterDocument(document);
}

export function mergeFrontmatter(existingFrontmatter, patch, merge = true) {
  if (!merge) {
    return normalizeFrontmatterValue(patch || {});
  }

  return {
    ...(existingFrontmatter || {}),
    ...(patch || {})
  };
}

export function upsertFrontmatter(content, frontmatter) {
  const { contentWithoutFrontmatter, rawFrontmatter } = extractFrontmatter(content || '');
  const normalized = normalizeFrontmatterValue(frontmatter || {});
  const { document } = parseFrontmatterDocument(rawFrontmatter);
  applyFrontmatterState(document, normalized);
  const serialized = stringifyFrontmatterDocument(document);
  const body = contentWithoutFrontmatter.replace(/^\n+/, '');

  if (!serialized) {
    return body;
  }

  if (!body) {
    return serialized;
  }

  return `${serialized}\n${body}`;
}

export function diffFrontmatter(before = {}, after = {}) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({
      key,
      before: before[key] ?? null,
      after: after[key] ?? null
    }));
}

export function prepareFrontmatterUpdate(content, fields, merge = true) {
  const { frontmatter, parseError } = extractFrontmatter(content);
  if (parseError) {
    throw new Error(`Invalid frontmatter: ${parseError}`);
  }

  const nextFrontmatter = mergeFrontmatter(frontmatter, fields, merge);
  const nextContent = upsertFrontmatter(content, nextFrontmatter);
  const changes = diffFrontmatter(frontmatter, nextFrontmatter);

  return {
    before: frontmatter,
    after: nextFrontmatter,
    changes,
    nextContent
  };
}
