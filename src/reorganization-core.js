import path from 'path';
import { Errors } from './errors.js';
import { validateMarkdownExtension, validatePathWithinBase, validateRequiredParameters } from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

function normalizeLinkTarget(target) {
  return target.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
}

function createAliasMap(notes) {
  const aliasMap = new Map();

  for (const note of notes) {
    const relativeWithoutExt = note.path.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
    const stem = note.stem.toLowerCase();

    if (!aliasMap.has(relativeWithoutExt)) {
      aliasMap.set(relativeWithoutExt, note.path);
    }

    if (!aliasMap.has(stem)) {
      aliasMap.set(stem, note.path);
    }
  }

  return aliasMap;
}

function resolveLinkTarget(linkTarget, aliasMap) {
  return aliasMap.get(normalizeLinkTarget(linkTarget)) || null;
}

function resolveNoteReference(snapshot, noteReference) {
  const exact = snapshot.notes.find((note) => note.path === noteReference);
  if (exact) {
    return exact;
  }

  const basename = path.basename(noteReference);
  const stem = basename.replace(/\.md$/i, '');
  const matches = snapshot.notes.filter((note) => note.name === basename || note.stem === stem);

  if (matches.length === 0) {
    throw Errors.resourceNotFound(noteReference, { path: noteReference });
  }

  if (matches.length > 1) {
    throw Errors.invalidParams(
      `Ambiguous path "${noteReference}" matches multiple notes: ${matches.map((note) => note.path).join(', ')}. Please specify the full path.`,
      { path: noteReference }
    );
  }

  return matches[0];
}

export function flattenFolderTree(nodes) {
  const flattened = [];

  for (const node of nodes) {
    flattened.push(node.path);
    flattened.push(...flattenFolderTree(node.children));
  }

  return flattened;
}

function validateDestinationPath(vaultPath, destinationPath) {
  const extensionValidation = validateMarkdownExtension(destinationPath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: destinationPath }));

  const pathValidation = validatePathWithinBase(vaultPath, destinationPath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: destinationPath }));

  return destinationPath;
}

export function buildMovePlan(snapshot, vaultPath, moveSpec, overwrite, seenSources, seenDestinations, existingPaths) {
  const { sourcePath, destinationPath } = moveSpec;
  const errors = [];

  const paramValidation = validateRequiredParameters({ sourcePath, destinationPath }, ['sourcePath', 'destinationPath']);
  if (!paramValidation.valid) {
    errors.push(paramValidation.error);
    return {
      sourcePath,
      destinationPath,
      status: 'invalid',
      errors
    };
  }

  const sourceExtensionValidation = validateMarkdownExtension(sourcePath);
  if (!sourceExtensionValidation.valid) {
    errors.push(sourceExtensionValidation.error);
  }

  let sourceNote = null;
  try {
    sourceNote = resolveNoteReference(snapshot, sourcePath);
  } catch (error) {
    errors.push(error.message);
  }

  try {
    validateDestinationPath(vaultPath, destinationPath);
  } catch (error) {
    errors.push(error.message);
  }

  if (sourceNote && sourceNote.path === destinationPath) {
    errors.push('sourcePath and destinationPath must differ');
  }

  if (sourceNote && seenSources.has(sourceNote.path)) {
    errors.push(`Duplicate source note in batch: ${sourceNote.path}`);
  }

  if (seenDestinations.has(destinationPath)) {
    errors.push(`Duplicate destination path in batch: ${destinationPath}`);
  }

  if (!overwrite && existingPaths.has(destinationPath)) {
    errors.push(`Destination already exists: ${destinationPath}`);
  }

  if (errors.length > 0) {
    return {
      sourcePath,
      destinationPath,
      resolvedSourcePath: sourceNote?.path || null,
      status: 'invalid',
      errors
    };
  }

  seenSources.add(sourceNote.path);
  seenDestinations.add(destinationPath);

  return {
    sourcePath,
    destinationPath,
    resolvedSourcePath: sourceNote.path,
    status: 'planned',
    errors: []
  };
}
