const TAG_BODY_PATTERN = /^[\p{L}\p{N}_/-]+$/u;
const NON_NUMERIC_PATTERN = /[^\p{N}]/u;
const INLINE_TAG_PATTERN = /(^|[^\p{L}\p{N}_#/-])#([\p{L}\p{N}_/-]+)(?=$|[^\p{L}\p{N}_/-])/gu;

export function normalizeTagValue(rawTag) {
  if (typeof rawTag !== 'string') {
    return '';
  }

  return rawTag.trim().replace(/^#+/, '').normalize('NFC');
}

export function canonicalizeTag(rawTag) {
  const normalized = normalizeTagValue(rawTag);
  return normalized ? normalized.toLocaleLowerCase() : '';
}

export function isValidTag(rawTag) {
  const normalized = normalizeTagValue(rawTag);
  return normalized.length > 0
    && TAG_BODY_PATTERN.test(normalized)
    && NON_NUMERIC_PATTERN.test(normalized);
}

export function dedupeTags(tags = []) {
  const uniqueTags = [];
  const seen = new Set();

  for (const rawTag of tags) {
    const normalized = normalizeTagValue(rawTag);
    const canonical = canonicalizeTag(normalized);
    if (!normalized || !canonical || seen.has(canonical)) {
      continue;
    }

    seen.add(canonical);
    uniqueTags.push(normalized);
  }

  return uniqueTags;
}

export function extractInlineTagsFromContent(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const tags = [];

  for (const match of content.matchAll(INLINE_TAG_PATTERN)) {
    const tag = normalizeTagValue(match[2]);
    if (isValidTag(tag)) {
      tags.push(tag);
    }
  }

  return dedupeTags(tags);
}
