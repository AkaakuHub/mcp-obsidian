import YAML from 'yaml';

function createEmptyDocument() {
  const doc = new YAML.Document({});
  return doc;
}

function ensureTopLevelMap(document) {
  if (!document.contents || document.contents === null) {
    document.contents = document.createNode({});
    return document;
  }

  const json = document.toJSON();
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return document;
  }

  document.contents = document.createNode({});
  return document;
}

export function parseFrontmatterDocument(rawFrontmatter = '') {
  if (!rawFrontmatter.trim()) {
    return {
      document: createEmptyDocument(),
      parseError: null
    };
  }

  const document = YAML.parseDocument(rawFrontmatter, {
    prettyErrors: true
  });

  if (document.errors.length > 0) {
    return {
      document: null,
      parseError: document.errors.map((error) => error.message).join('; ')
    };
  }

  return {
    document: ensureTopLevelMap(document),
    parseError: null
  };
}

export function applyFrontmatterState(document, frontmatter = {}) {
  const nextState = frontmatter || {};
  const nextKeys = new Set(Object.keys(nextState));
  const workingDocument = ensureTopLevelMap(document);
  const currentState = workingDocument.toJSON() || {};

  for (const key of Object.keys(currentState)) {
    if (!nextKeys.has(key)) {
      workingDocument.delete(key);
    }
  }

  for (const [key, value] of Object.entries(nextState)) {
    workingDocument.set(key, value);
  }

  return workingDocument;
}

export function stringifyFrontmatterDocument(document) {
  const body = document.toString({
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE',
    lineWidth: 0
  }).trimEnd();

  if (!body) {
    return '';
  }

  return `---\n${body}\n---\n`;
}
