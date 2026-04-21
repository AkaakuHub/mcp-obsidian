import { createMetadata, structuredResponse } from '../response-formatter.js';
import { analyzeLinks, bulkUpdateFrontmatter, extractTasks, moveMany, writeFrontmatter } from '../analysis-tools.js';
import { TOOL_NAMES } from '../tool-names.js';

function formatLineList(items, emptyMessage) {
  return items.length > 0 ? items.join('\n') : emptyMessage;
}

export function createAnalysisHandlers(vaultPath) {
  return {
    [TOOL_NAMES.WRITE_FRONTMATTER]: async (args, startTime, toolName) => {
      const result = await writeFrontmatter(vaultPath, args.path, args.fields, { merge: args.merge, dryRun: args.dryRun });
      return structuredResponse(result, result.dryRun ? `Dry-run frontmatter diff for ${args.path}` : `Updated frontmatter for ${args.path}`, createMetadata(startTime, { tool: toolName, dryRun: result.dryRun }));
    },
    [TOOL_NAMES.BULK_WRITE_FRONTMATTER]: async (args, startTime, toolName) => {
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
    [TOOL_NAMES.EXTRACT_TASKS]: async (args, startTime, toolName) => {
      const result = await extractTasks(vaultPath, args);
      return structuredResponse(result, `Extracted ${result.total} tasks`, createMetadata(startTime, { tool: toolName }));
    },
    [TOOL_NAMES.ANALYZE_LINKS]: async (args, startTime, toolName) => {
      const result = await analyzeLinks(vaultPath, args);
      return structuredResponse(result, args.notePath ? `Analyzed links for ${args.notePath}` : `Analyzed link graph for ${result.notes.length} notes`, createMetadata(startTime, { tool: toolName }));
    },
    [TOOL_NAMES.BULK_MOVE_NOTE]: async (args, startTime, toolName) => {
      const result = await moveMany(vaultPath, args);
      const description = result.validationFailed
        ? `Batch move validation failed for ${result.errors.length} items`
        : result.dryRun
          ? `Dry-run batch move for ${result.moveCount} notes`
          : result.applied
            ? `Moved ${result.movedCount} notes`
            : 'Batch move stopped after a failure';
      return structuredResponse(result, description, createMetadata(startTime, { tool: toolName, dryRun: result.dryRun, applied: result.applied }));
    }
  };
}
