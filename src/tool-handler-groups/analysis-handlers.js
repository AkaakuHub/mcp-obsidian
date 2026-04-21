import { createMetadata, structuredResponse } from '../response-formatter.js';
import { analyzeLinks, auditAssets, bulkDeleteNote, bulkUpdateFrontmatter, extractTasks, listTags, moveMany, writeFrontmatter, writeTags } from '../analysis-tools.js';
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
    },
    [TOOL_NAMES.LIST_TAGS]: async (args, startTime, toolName) => {
      const result = await listTags(vaultPath, args);
      const description = args.notePath
        ? `Listed tags for ${result.path}`
        : `Listed ${result.count} tags across ${result.noteCount} notes`;
      return structuredResponse(result, description, createMetadata(startTime, { tool: toolName }));
    },
    [TOOL_NAMES.WRITE_TAGS]: async (args, startTime, toolName) => {
      const result = await writeTags(vaultPath, args.path, args.tags, { mode: args.mode, dryRun: args.dryRun });
      const description = result.dryRun
        ? `Dry-run tag update for ${result.path}`
        : `Updated tags for ${result.path}`;
      return structuredResponse(result, description, createMetadata(startTime, { tool: toolName, dryRun: result.dryRun }));
    },
    [TOOL_NAMES.BULK_DELETE_NOTE]: async (args, startTime, toolName) => {
      const result = await bulkDeleteNote(vaultPath, args);
      const description = result.validationFailed
        ? `Batch delete validation failed for ${result.errors.length} items`
        : result.dryRun
          ? `Dry-run batch delete for ${result.targetCount} notes`
          : result.applied
            ? `Deleted ${result.deletedCount} notes`
            : `Deleted ${result.deletedCount} notes with ${result.errors.length} errors`;
      return structuredResponse(result, description, createMetadata(startTime, { tool: toolName, dryRun: result.dryRun, applied: result.applied }));
    },
    [TOOL_NAMES.AUDIT_ASSETS]: async (args, startTime, toolName) => {
      const result = await auditAssets(vaultPath, args);
      return structuredResponse(
        result,
        `Audited ${result.assetCount} assets across ${result.noteCount} notes`,
        createMetadata(startTime, { tool: toolName })
      );
    }
  };
}
