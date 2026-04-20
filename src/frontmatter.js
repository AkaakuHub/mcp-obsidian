import { extractFrontmatter } from './metadata.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapeString(value) {
  return String(value).replace(/"/g, '\\"');
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

function serializeScalar(value) {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '""';
  }

  return `"${escapeString(value)}"`;
}

function serializeArray(values) {
  return `[${values.map(serializeScalar).join(', ')}]`;
}

function serializeObjectEntries(object, indent = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return `${indent}${key}: ${serializeArray(value)}`;
    }

    if (isPlainObject(value)) {
      return [
        `${indent}${key}:`,
        ...serializeObjectEntries(value, `${indent}  `)
      ];
    }

    return `${indent}${key}: ${serializeScalar(value)}`;
  });
}

export function serializeFrontmatter(frontmatter) {
  const normalized = normalizeFrontmatterValue(frontmatter || {});
  const lines = serializeObjectEntries(normalized);

  if (lines.length === 0) {
    return '';
  }

  return `---\n${lines.join('\n')}\n---\n`;
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
  const { contentWithoutFrontmatter } = extractFrontmatter(content || '');
  const serialized = serializeFrontmatter(frontmatter);
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
  const { frontmatter } = extractFrontmatter(content);
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
