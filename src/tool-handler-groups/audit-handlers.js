import { createMetadata, structuredResponse } from '../response-formatter.js';
import { auditDailyJournal, auditTasks, buildVaultInventory, detectDailyNotes, detectLargeNotes, detectSimilarNotes, detectUnorganizedNotes, proposeNoteRefactors } from '../audits.js';

export function createAuditHandlers(vaultPath) {
  return {
    'detect-daily-notes': async (args, startTime, toolName) => {
      const result = await detectDailyNotes(vaultPath, args);
      return structuredResponse(result, `Detected ${result.count} daily or journal style notes`, createMetadata(startTime, { tool: toolName }));
    },
    'detect-similar-notes': async (args, startTime, toolName) => {
      const result = await detectSimilarNotes(vaultPath, args);
      return structuredResponse(result, `Detected ${result.count} similar note pairs`, createMetadata(startTime, { tool: toolName }));
    },
    'detect-large-notes': async (args, startTime, toolName) => {
      const result = await detectLargeNotes(vaultPath, args);
      return structuredResponse(result, `Detected ${result.count} large notes`, createMetadata(startTime, { tool: toolName }));
    },
    'detect-unorganized-notes': async (args, startTime, toolName) => {
      const result = await detectUnorganizedNotes(vaultPath, args);
      return structuredResponse(result, `Detected ${result.count} unorganized notes`, createMetadata(startTime, { tool: toolName }));
    },
    'vault-inventory': async (args, startTime, toolName) => {
      const result = await buildVaultInventory(vaultPath, args);
      return structuredResponse(result, `Vault inventory for ${result.noteCount} notes`, createMetadata(startTime, { tool: toolName }));
    },
    'task-audit': async (args, startTime, toolName) => {
      const result = await auditTasks(vaultPath, args);
      return structuredResponse(result, `Task audit across ${result.totalTasks} tasks`, createMetadata(startTime, { tool: toolName }));
    },
    'daily-journal-audit': async (args, startTime, toolName) => {
      const result = await auditDailyJournal(vaultPath, args);
      return structuredResponse(result, `Daily/journal audit with ${result.entryPoints.length} entry points`, createMetadata(startTime, { tool: toolName }));
    },
    'propose-note-refactors': async (args, startTime, toolName) => {
      const result = await proposeNoteRefactors(vaultPath, args);
      return structuredResponse(result, `Generated ${result.suggestionCount} proposal-only refactor suggestions`, createMetadata(startTime, { tool: toolName, mode: result.mode }));
    }
  };
}
