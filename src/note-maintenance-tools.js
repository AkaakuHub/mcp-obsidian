import { deleteNote, readResolvedNote, writeNote } from './note-io-tools.js';
import { Errors } from './errors.js';
import { resolveNoteReference } from './reorganization-core.js';
import { buildLinkGraph, getVaultSnapshot } from './vault-analysis.js';
import { validateRequiredParameters } from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

function joinWithSeparator(existingContent, appendedContent, separator) {
  if (existingContent.length === 0) {
    return appendedContent;
  }

  if (separator.length === 0 || existingContent.endsWith(separator)) {
    return `${existingContent}${appendedContent}`;
  }

  return `${existingContent}${separator}${appendedContent}`;
}

export async function appendToNote(vaultPath, notePath, content, options = {}) {
  const { separator = '\n\n' } = options;
  const paramValidation = validateRequiredParameters({ path: notePath, content }, ['path', 'content']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const note = await readResolvedNote(vaultPath, notePath);
  const nextContent = joinWithSeparator(note.content, content, separator);
  await writeNote(vaultPath, note.path, nextContent);

  return {
    path: note.path,
    status: 'appended',
    appendedLength: content.length,
    newContentLength: nextContent.length
  };
}

export async function deleteNoteSafe(vaultPath, notePath, options = {}) {
  const { dryRun = true, force = false } = options;
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const snapshot = await getVaultSnapshot(vaultPath, {});
  const note = resolveNoteReference(snapshot, notePath);
  const graph = buildLinkGraph(snapshot.notes);
  const node = graph.nodes.find((candidate) => candidate.path === note.path);

  if (!node) {
    throw Errors.resourceNotFound(notePath, { path: notePath });
  }

  const blocked = node.inboundCount > 0 && !force;
  const result = {
    path: note.path,
    requestedPath: notePath,
    dryRun,
    force,
    blocked,
    deleted: false,
    inboundLinkCount: node.inboundCount,
    inboundLinks: node.inboundLinks,
    outboundLinkCount: node.outboundCount,
    outboundLinks: node.outboundLinks
  };

  if (dryRun || blocked) {
    return result;
  }

  await deleteNote(vaultPath, note.path);
  return {
    ...result,
    dryRun: false,
    blocked: false,
    deleted: true
  };
}
