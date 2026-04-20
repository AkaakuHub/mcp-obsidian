import { createMetadata, structuredResponse } from '../response-formatter.js';
import { auditTasks, buildVaultInventory } from '../audits.js';

export function createAuditHandlers(vaultPath) {
  return {
    'vault-inventory': async (args, startTime, toolName) => {
      const result = await buildVaultInventory(vaultPath, args);
      return structuredResponse(result, `Vault inventory for ${result.noteCount} notes`, createMetadata(startTime, { tool: toolName }));
    },
    'task-audit': async (args, startTime, toolName) => {
      const result = await auditTasks(vaultPath, args);
      return structuredResponse(result, `Task audit across ${result.totalTasks} tasks`, createMetadata(startTime, { tool: toolName }));
    }
  };
}
