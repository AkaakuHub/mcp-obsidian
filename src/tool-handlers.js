import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  analyzeLinks,
  bulkUpdateFrontmatter,
  collectTaskStyles,
  extractTasks,
  getVaultStructure,
  listNotesDetailed,
  previewNotes,
  readFrontmatter,
  writeFrontmatter
} from './analysis-tools.js';
import {
  auditDailyJournal,
  auditTasks,
  buildVaultInventory,
  detectDailyNotes,
  detectLargeNotes,
  detectSimilarNotes,
  detectUnorganizedNotes,
  proposeNoteRefactors
} from './audits.js';
import { Errors, MCPError } from './errors.js';
import { createMetadata, errorResponse, structuredResponse, stripSearchContext, textResponse } from './response-formatter.js';
import { discoverMocs, getNoteMetadata, listNotes, readNote, searchByTags, searchByTitle, searchVault, writeNote, deleteNote } from './tools.js';
import { toolDefinitions } from './toolDefinitions.js';

function makeStructuredDescription(title, count, extra = '') {
  const countText = typeof count === 'number' ? `${count} result${count === 1 ? '' : 's'}` : title;
  return extra ? `${countText}\n${extra}` : countText;
}

export function registerToolHandlers(server, vaultPath) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    try {
      switch (name) {
      case 'search-vault': {
        const { query, path: searchPath, caseSensitive = false, includeContext = true, contextLines = 2, limit = 100, offset = 0 } = args;
        const result = await searchVault(vaultPath, query, searchPath, caseSensitive, { includeContext, contextLines }, limit, offset);
        const structuredContent = stripSearchContext(result);
        return structuredResponse(structuredContent, `Found ${result.totalMatches} matches for "${query}"`, createMetadata(startTime, { tool: name, filesSearched: result.filesSearched || 0 }));
      }

      case 'search-by-title': {
        const { query, path: searchPath, caseSensitive = false, limit = 100, offset = 0 } = args;
        const result = await searchByTitle(vaultPath, query, searchPath, caseSensitive, limit, offset);
        return structuredResponse(result, `Found ${result.count} notes matching title "${query}"`, createMetadata(startTime, { tool: name, filesSearched: result.filesSearched || 0 }));
      }

      case 'list-notes': {
        const { directory, limit = 100, offset = 0 } = args;
        const result = await listNotes(vaultPath, directory, limit, offset);
        return structuredResponse(result, makeStructuredDescription('Listed notes', result.count), createMetadata(startTime, { tool: name }));
      }

      case 'read-note': {
        const content = await readNote(vaultPath, args.path);
        return textResponse(content, createMetadata(startTime, { tool: name, contentLength: content.length }));
      }

      case 'write-note': {
        await writeNote(vaultPath, args.path, args.content);
        return textResponse(`Note written successfully to ${args.path}`, createMetadata(startTime, { tool: name, contentLength: args.content.length }));
      }

      case 'delete-note': {
        await deleteNote(vaultPath, args.path);
        return textResponse(`Note deleted successfully: ${args.path}`, createMetadata(startTime, { tool: name }));
      }

      case 'search-by-tags': {
        const { tags, directory, caseSensitive = false } = args;
        const result = await searchByTags(vaultPath, tags, directory, caseSensitive);
        return structuredResponse(result, `Found ${result.count} notes with requested tags`, createMetadata(startTime, { tool: name, tagsSearched: tags.length }));
      }

      case 'get-note-metadata': {
        const { path: notePath, batch = false, directory, limit = 50, offset = 0 } = args;
        const pathArg = batch && directory ? directory : notePath;
        const result = await getNoteMetadata(vaultPath, pathArg, { batch, limit, offset });
        return structuredResponse(result, batch ? `Retrieved metadata for ${result.count} notes` : `Retrieved metadata for ${notePath}`, createMetadata(startTime, { tool: name, mode: batch ? 'batch' : 'single' }));
      }

      case 'discover-mocs': {
        const result = await discoverMocs(vaultPath, args);
        return structuredResponse(result, `Found ${result.count} MOCs`, createMetadata(startTime, { tool: name, mocsFound: result.count }));
      }

      case 'get-vault-structure': {
        const result = await getVaultStructure(vaultPath, args);
        return structuredResponse(result, `Found ${result.noteCount} notes across ${result.folderCount} top-level folders`, createMetadata(startTime, { tool: name }));
      }

      case 'list-notes-detailed': {
        const result = await listNotesDetailed(vaultPath, args);
        return structuredResponse(result, `Detailed listing for ${result.count} notes`, createMetadata(startTime, { tool: name }));
      }

      case 'preview-notes': {
        const result = await previewNotes(vaultPath, args);
        return structuredResponse(result, `Previewed ${result.count} notes`, createMetadata(startTime, { tool: name }));
      }

      case 'read-frontmatter': {
        const result = await readFrontmatter(vaultPath, args.path);
        return structuredResponse(result, `Read frontmatter for ${args.path}`, createMetadata(startTime, { tool: name }));
      }

      case 'write-frontmatter': {
        const result = await writeFrontmatter(vaultPath, args.path, args.fields, { merge: args.merge, dryRun: args.dryRun });
        return structuredResponse(result, result.dryRun ? `Dry-run frontmatter diff for ${args.path}` : `Updated frontmatter for ${args.path}`, createMetadata(startTime, { tool: name, dryRun: result.dryRun }));
      }

      case 'bulk-update-frontmatter': {
        const result = await bulkUpdateFrontmatter(vaultPath, args);
        return structuredResponse(result, result.dryRun ? `Dry-run bulk frontmatter update for ${result.targetCount} notes` : `Updated frontmatter for ${result.updatedCount} notes`, createMetadata(startTime, { tool: name, dryRun: result.dryRun }));
      }

      case 'extract-tasks': {
        const result = await extractTasks(vaultPath, args);
        return structuredResponse(result, `Extracted ${result.total} tasks`, createMetadata(startTime, { tool: name }));
      }

      case 'analyze-links': {
        const result = await analyzeLinks(vaultPath, args);
        return structuredResponse(result, args.notePath ? `Analyzed links for ${args.notePath}` : `Analyzed link graph for ${result.notes.length} notes`, createMetadata(startTime, { tool: name }));
      }

      case 'detect-daily-notes': {
        const result = await detectDailyNotes(vaultPath, args);
        return structuredResponse(result, `Detected ${result.count} daily or journal style notes`, createMetadata(startTime, { tool: name }));
      }

      case 'detect-similar-notes': {
        const result = await detectSimilarNotes(vaultPath, args);
        return structuredResponse(result, `Detected ${result.count} similar note pairs`, createMetadata(startTime, { tool: name }));
      }

      case 'detect-large-notes': {
        const result = await detectLargeNotes(vaultPath, args);
        return structuredResponse(result, `Detected ${result.count} large notes`, createMetadata(startTime, { tool: name }));
      }

      case 'detect-unorganized-notes': {
        const result = await detectUnorganizedNotes(vaultPath, args);
        return structuredResponse(result, `Detected ${result.count} unorganized notes`, createMetadata(startTime, { tool: name }));
      }

      case 'vault-inventory': {
        const result = await buildVaultInventory(vaultPath, args);
        return structuredResponse(result, `Vault inventory for ${result.noteCount} notes`, createMetadata(startTime, { tool: name }));
      }

      case 'task-audit': {
        const result = await auditTasks(vaultPath, args);
        return structuredResponse(result, `Task audit across ${result.totalTasks} tasks`, createMetadata(startTime, { tool: name }));
      }

      case 'daily-journal-audit': {
        const result = await auditDailyJournal(vaultPath, args);
        return structuredResponse(result, `Daily/journal audit with ${result.entryPoints.length} entry points`, createMetadata(startTime, { tool: name }));
      }

      case 'propose-note-refactors': {
        const result = await proposeNoteRefactors(vaultPath, args);
        return structuredResponse(result, `Generated ${result.suggestionCount} proposal-only refactor suggestions`, createMetadata(startTime, { tool: name, mode: result.mode }));
      }

      case 'collect-task-styles': {
        const result = await collectTaskStyles(vaultPath, args);
        return structuredResponse(result, `Collected ${result.count} task style markers`, createMetadata(startTime, { tool: name }));
      }

      default:
        throw Errors.toolNotFound(name);
      }
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      return errorResponse(error);
    }
  });
}
