import { getVaultSnapshot } from './vault-analysis.js';
import {
  findMatchesInContent,
  findMatchesWithOperators,
  paginateArray,
  paginateSearchResults,
  transformSearchResults
} from './search.js';
import { Errors } from './errors.js';
import { validatePathWithinBase, validateRequiredParameters } from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

function assertSearchPath(vaultPath, searchPath) {
  if (!searchPath) {
    return;
  }

  const pathValidation = validatePathWithinBase(vaultPath, searchPath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: searchPath }));
}

function buildSearchMetadata(note) {
  return {
    title: note.title || '',
    tags: note.tags || []
  };
}

function evaluateNoteMatches(note, query, caseSensitive, contextOptions) {
  const content = note.content || '';
  const hasOperators = /\b(AND|OR|NOT)\b|[:\-()]|"/.test(query);

  if (hasOperators) {
    return findMatchesWithOperators(content, query, buildSearchMetadata(note), caseSensitive, contextOptions);
  }

  return findMatchesInContent(content, query, caseSensitive, contextOptions);
}

export async function searchVaultWithSnapshot(
  vaultPath,
  query,
  searchPath,
  caseSensitive = false,
  contextOptions = {},
  limit = 100,
  offset = 0
) {
  const paramValidation = validateRequiredParameters({ query }, ['query']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));
  assertSearchPath(vaultPath, searchPath);

  const snapshot = await getVaultSnapshot(vaultPath, {
    directory: searchPath || null,
    includeContent: true
  });

  const fileMatches = snapshot.notes.reduce((matches, note) => {
    const noteMatches = evaluateNoteMatches(note, query, caseSensitive, contextOptions);
    if (noteMatches.length > 0) {
      matches.push({
        file: note.path,
        matches: noteMatches
      });
    }
    return matches;
  }, []);

  const transformed = transformSearchResults(fileMatches, '');
  transformed.filesSearched = snapshot.total;
  return paginateSearchResults(transformed, limit, offset);
}

export async function searchFilenamesWithSnapshot(
  vaultPath,
  query,
  searchPath,
  caseSensitive = false,
  limit = 100,
  offset = 0
) {
  const paramValidation = validateRequiredParameters({ query }, ['query']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  if (!query || query.trim() === '') {
    throw Errors.invalidParams('query cannot be empty');
  }

  assertSearchPath(vaultPath, searchPath);

  const normalizedQuery = caseSensitive ? query : query.toLowerCase();
  const snapshot = await getVaultSnapshot(vaultPath, {
    directory: searchPath || null
  });

  const results = snapshot.notes
    .filter((note) => {
      const candidates = caseSensitive
        ? [note.name, note.stem, note.path]
        : [note.name.toLowerCase(), note.stem.toLowerCase(), note.path.toLowerCase()];
      return candidates.some((candidate) => candidate.includes(normalizedQuery));
    })
    .map((note) => ({
      file: note.path,
      filename: note.name,
      stem: note.stem,
      title: note.title
    }));

  const { items: paginatedResults, pagination } = paginateArray(results, limit, offset);
  return {
    results: paginatedResults,
    count: paginatedResults.length,
    filesSearched: snapshot.total,
    pagination
  };
}
