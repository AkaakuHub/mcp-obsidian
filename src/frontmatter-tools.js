import { readFile, stat, writeFile } from 'fs/promises';
import { config } from './config.js';
import { Errors } from './errors.js';
import { prepareFrontmatterUpdate } from './frontmatter.js';
import { invalidateSnapshotsForVault } from './vault-cache.js';
import {
  normalizeMarkdownNotePath,
  validateFileSize,
  validateMarkdownExtension,
  validatePathWithinBase,
  validateRequiredParameters
} from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

async function readNoteForMutation(vaultPath, notePath) {
  const normalizedNotePath = normalizeMarkdownNotePath(notePath);
  const paramValidation = validateRequiredParameters({ path: notePath }, ['path']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  const extensionValidation = validateMarkdownExtension(normalizedNotePath);
  assertValid(extensionValidation, (msg) => Errors.invalidParams(msg, { path: notePath }));

  const pathValidation = validatePathWithinBase(vaultPath, normalizedNotePath);
  assertValid(pathValidation, (msg) => Errors.accessDenied(msg, { path: notePath }));

  const fullPath = pathValidation.resolvedPath;
  let stats;
  try {
    stats = await stat(fullPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Errors.resourceNotFound(notePath, { path: notePath });
    }
    throw Errors.internalError(`Failed to inspect note: ${error.message}`, { path: notePath });
  }

  const sizeValidation = validateFileSize(stats.size, config.limits.maxFileSize);
  assertValid(sizeValidation, (msg, data) => Errors.invalidParams(msg, { path: notePath, ...data }));

  let content;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Errors.resourceNotFound(notePath, { path: notePath });
    }
    throw Errors.internalError(`Failed to read note: ${error.message}`, { path: notePath });
  }

  return { fullPath, content };
}

async function planFrontmatterUpdate(vaultPath, notePath, fields, merge = true) {
  const { fullPath, content } = await readNoteForMutation(vaultPath, notePath);
  const normalizedNotePath = normalizeMarkdownNotePath(notePath);
  const prepared = prepareFrontmatterUpdate(content, fields, merge);

  return {
    path: normalizedNotePath,
    fullPath,
    originalContent: content,
    nextContent: prepared.nextContent,
    before: prepared.before,
    after: prepared.after,
    changes: prepared.changes
  };
}

export async function writeFrontmatter(vaultPath, notePath, fields, options = {}) {
  const { merge = true, dryRun = true } = options;
  const plan = await planFrontmatterUpdate(vaultPath, notePath, fields, merge);

  if (!dryRun) {
    await writeFile(plan.fullPath, plan.nextContent, 'utf-8');
    invalidateSnapshotsForVault(vaultPath);
  }

  return {
    path: notePath,
    dryRun,
    written: !dryRun,
    changes: plan.changes,
    before: plan.before,
    after: plan.after
  };
}
