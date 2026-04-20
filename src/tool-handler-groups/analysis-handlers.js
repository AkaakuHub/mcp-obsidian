import { createMetadata, structuredResponse } from '../response-formatter.js';
import { analyzeLinks, bulkUpdateFrontmatter, collectTaskStyles, extractTasks, getVaultStructure, listNotesDetailed, previewNotes, readFrontmatter, writeFrontmatter } from '../analysis-tools.js';

export function createAnalysisHandlers(vaultPath) {
  return {
    'get-vault-structure': async (args, startTime, toolName) => {
      const result = await getVaultStructure(vaultPath, args);
      return structuredResponse(result, `Found ${result.noteCount} notes across ${result.folderCount} top-level folders`, createMetadata(startTime, { tool: toolName }));
    },
    'list-notes-detailed': async (args, startTime, toolName) => {
      const result = await listNotesDetailed(vaultPath, args);
      return structuredResponse(result, `Detailed listing for ${result.count} notes`, createMetadata(startTime, { tool: toolName }));
    },
    'preview-notes': async (args, startTime, toolName) => {
      const result = await previewNotes(vaultPath, args);
      return structuredResponse(result, `Previewed ${result.count} notes`, createMetadata(startTime, { tool: toolName }));
    },
    'read-frontmatter': async (args, startTime, toolName) => {
      const result = await readFrontmatter(vaultPath, args.path);
      return structuredResponse(result, `Read frontmatter for ${args.path}`, createMetadata(startTime, { tool: toolName }));
    },
    'write-frontmatter': async (args, startTime, toolName) => {
      const result = await writeFrontmatter(vaultPath, args.path, args.fields, { merge: args.merge, dryRun: args.dryRun });
      return structuredResponse(result, result.dryRun ? `Dry-run frontmatter diff for ${args.path}` : `Updated frontmatter for ${args.path}`, createMetadata(startTime, { tool: toolName, dryRun: result.dryRun }));
    },
    'bulk-update-frontmatter': async (args, startTime, toolName) => {
      const result = await bulkUpdateFrontmatter(vaultPath, args);
      const description = result.validationFailed
        ? `Validation failed for ${result.errors.length} targets; no changes were applied`
        : result.dryRun
          ? `Dry-run bulk frontmatter update for ${result.targetCount} notes`
          : result.applied
            ? `Updated frontmatter for ${result.updatedCount} notes`
            : 'Bulk frontmatter update rolled back after a write failure';
      return structuredResponse(result, description, createMetadata(startTime, { tool: toolName, dryRun: result.dryRun, applied: result.applied }));
    },
    'extract-tasks': async (args, startTime, toolName) => {
      const result = await extractTasks(vaultPath, args);
      return structuredResponse(result, `Extracted ${result.total} tasks`, createMetadata(startTime, { tool: toolName }));
    },
    'analyze-links': async (args, startTime, toolName) => {
      const result = await analyzeLinks(vaultPath, args);
      return structuredResponse(result, args.notePath ? `Analyzed links for ${args.notePath}` : `Analyzed link graph for ${result.notes.length} notes`, createMetadata(startTime, { tool: toolName }));
    },
    'collect-task-styles': async (args, startTime, toolName) => {
      const result = await collectTaskStyles(vaultPath, args);
      return structuredResponse(result, `Collected ${result.count} task style markers`, createMetadata(startTime, { tool: toolName }));
    }
  };
}
