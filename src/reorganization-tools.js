import { moveNote } from './note-io-tools.js';
import { Errors } from './errors.js';
import { buildMovePlan } from './reorganization-core.js';
import { getVaultSnapshot } from './vault-analysis.js';
import { validateRequiredParameters } from './validation.js';

export async function moveMany(vaultPath, options = {}) {
  function assertValid(validationResult, errorFactory) {
    if (!validationResult.valid) {
      throw errorFactory(validationResult.error, validationResult);
    }
  }
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
