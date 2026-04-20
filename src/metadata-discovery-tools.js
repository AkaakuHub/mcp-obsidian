import { Errors } from './errors.js';
import { getVaultSnapshot } from './vault-analysis.js';
import { extractTags as extractTagsPure, hasAllTags } from './tags.js';
import { validatePathWithinBase } from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

export async function searchByTags(vaultPath, searchTags, directory = null, caseSensitive = false) {
  if (directory) {
    const pathValidation = validatePathWithinBase(vaultPath, directory);
    assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: directory }));
  }

  const snapshot = await getVaultSnapshot(vaultPath, { directory });
  const results = snapshot.notes
    .filter((note) => hasAllTags(note.tags, searchTags, caseSensitive))
    .map((note) => ({
      path: note.path,
      tags: note.tags
    }));

  return {
    notes: results,
    count: results.length
  };
}

export const extractTags = extractTagsPure;
