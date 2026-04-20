import { moveNote } from './note-io-tools.js';
import { Errors } from './errors.js';
import { buildMovePlan, createAliasMap, flattenFolderTree, resolveLinkTarget, resolveNoteReference, validateDestinationPath } from './reorganization-core.js';
import { buildFolderTree, buildLinkGraph, getVaultSnapshot } from './vault-analysis.js';
import { validateRequiredParameters } from './validation.js';

function assertValid(validationResult, errorFactory) {
  if (!validationResult.valid) {
    throw errorFactory(validationResult.error, validationResult);
  }
}

export async function listFolders(vaultPath, options = {}) {
  const { directory = null } = options;
  const snapshot = await getVaultSnapshot(vaultPath, { directory });
  const folders = buildFolderTree(snapshot.notes.map((note) => note.path));
  const paths = flattenFolderTree(folders);

  return {
    root: directory || '',
    folderCount: paths.length,
    folders,
    paths
  };
}

export async function previewMoveImpact(vaultPath, options = {}) {
  const { sourcePath, destinationPath } = options;
  const paramValidation = validateRequiredParameters({ sourcePath, destinationPath }, ['sourcePath', 'destinationPath']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));

  validateDestinationPath(vaultPath, destinationPath);

  const snapshot = await getVaultSnapshot(vaultPath, {});
  const sourceNote = resolveNoteReference(snapshot, sourcePath);
  const graph = buildLinkGraph(snapshot.notes);
  const sourceNode = graph.nodes.find((node) => node.path === sourceNote.path);
  const futureNotes = snapshot.notes.map((note) => note.path === sourceNote.path
    ? {
        ...note,
        path: destinationPath,
        name: destinationPath.split('/').pop(),
        stem: destinationPath.split('/').pop().replace(/\.md$/i, ''),
        directory: destinationPath.includes('/') ? destinationPath.slice(0, destinationPath.lastIndexOf('/')) : ''
      }
    : note);
  const futureAliasMap = createAliasMap(futureNotes);

  const affectedLinks = graph.nodes
    .flatMap((node) => node.outboundLinks
      .filter((link) => link.resolvedPath === sourceNote.path)
      .map((link) => ({
        path: node.path,
        target: link.target,
        futureResolvedPath: resolveLinkTarget(link.target, futureAliasMap)
      })))
    .map((link) => ({
      ...link,
      willBreak: link.futureResolvedPath !== destinationPath
    }))
    .filter((link) => link.willBreak)
    .sort((left, right) => left.path.localeCompare(right.path) || left.target.localeCompare(right.target));

  return {
    sourcePath,
    resolvedSourcePath: sourceNote.path,
    destinationPath,
    renameDetected: sourceNote.name !== (destinationPath.split('/').pop()),
    inboundLinkCount: sourceNode.inboundCount,
    affectedLinkCount: affectedLinks.length,
    affectedLinks,
    sourceOutboundLinks: sourceNode.outboundLinks
  };
}

export async function moveMany(vaultPath, options = {}) {
  const { moves = [], overwrite = false, dryRun = true } = options;
  const paramValidation = validateRequiredParameters({ moves }, ['moves']);
  assertValid(paramValidation, (msg) => Errors.invalidParams(msg));
  if (!Array.isArray(moves) || moves.length === 0) {
    throw Errors.invalidParams('moves must contain at least one move specification');
  }

  const snapshot = await getVaultSnapshot(vaultPath, {});
  const existingPaths = new Set(snapshot.notes.map((note) => note.path));
  const seenSources = new Set();
  const seenDestinations = new Set();
  const plans = moves.map((moveSpec) =>
    buildMovePlan(snapshot, vaultPath, moveSpec, overwrite, seenSources, seenDestinations, existingPaths)
  );
  const invalidPlans = plans.filter((plan) => plan.status === 'invalid');

  if (invalidPlans.length > 0) {
    return {
      dryRun,
      applied: false,
      validationFailed: true,
      rolledBack: false,
      moveCount: moves.length,
      movedCount: 0,
      errors: invalidPlans.flatMap((plan) => plan.errors.map((error) => ({ sourcePath: plan.sourcePath, destinationPath: plan.destinationPath, error }))),
      rollbackErrors: [],
      results: plans
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      applied: false,
      validationFailed: false,
      rolledBack: false,
      moveCount: moves.length,
      movedCount: 0,
      errors: [],
      rollbackErrors: [],
      results: plans
    };
  }

  const completedMoves = [];
  const errors = [];
  const rollbackErrors = [];

  for (const plan of plans) {
    try {
      const result = await moveNote(vaultPath, plan.resolvedSourcePath, plan.destinationPath, overwrite);
      completedMoves.push({
        ...plan,
        ...result,
        status: 'moved'
      });
    } catch (error) {
      errors.push({
        sourcePath: plan.resolvedSourcePath,
        destinationPath: plan.destinationPath,
        error: error.message
      });

      for (const completedMove of [...completedMoves].reverse()) {
        try {
          await moveNote(vaultPath, completedMove.path, completedMove.fromPath, true);
        } catch (rollbackError) {
          rollbackErrors.push({
            sourcePath: completedMove.path,
            destinationPath: completedMove.fromPath,
            error: rollbackError.message
          });
        }
      }

      return {
        dryRun: false,
        applied: false,
        validationFailed: false,
        rolledBack: rollbackErrors.length === 0,
        moveCount: moves.length,
        movedCount: completedMoves.length,
        errors,
        rollbackErrors,
        results: [
          ...completedMoves,
          {
            ...plan,
            status: 'failed',
            errors: [error.message]
          }
        ]
      };
    }
  }

  return {
    dryRun: false,
    applied: true,
    validationFailed: false,
    rolledBack: false,
    moveCount: moves.length,
    movedCount: completedMoves.length,
    errors: [],
    rollbackErrors: [],
    results: completedMoves
  };
}
