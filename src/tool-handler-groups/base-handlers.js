import { createMetadata, structuredResponse } from '../response-formatter.js';
import { deleteNote, listNotes, moveNote, readResolvedNote, searchByFilename, searchVault, updateNote } from '../tools.js';

function makeStructuredDescription(title, count, extra = '') {
  const countText = typeof count === 'number' ? `${count} result${count === 1 ? '' : 's'}` : title;
  return extra ? `${countText}\n${extra}` : countText;
}

export function createBaseHandlers(vaultPath) {
  return {
    'search-vault': async (args, startTime, toolName) => {
      const { query, path: searchPath, caseSensitive = false, includeContext = true, contextLines = 2, limit = 100, offset = 0 } = args;
      const result = await searchVault(vaultPath, query, searchPath, caseSensitive, { includeContext, contextLines }, limit, offset);
      return structuredResponse(
        result,
        `Found ${result.totalMatches} matches for "${query}"`,
        createMetadata(startTime, { tool: toolName, filesSearched: result.filesSearched || 0 })
      );
    },
    'search-by-filename': async (args, startTime, toolName) => {
      const { query, path: searchPath, caseSensitive = false, limit = 100, offset = 0 } = args;
      const result = await searchByFilename(vaultPath, query, searchPath, caseSensitive, limit, offset);
      return structuredResponse(result, `Found ${result.count} notes matching filename "${query}"`, createMetadata(startTime, { tool: toolName, filesSearched: result.filesSearched || 0 }));
    },
    'list-notes': async (args, startTime, toolName) => {
      const { directory, includeFolders = false, limit = 100, offset = 0 } = args;
      const result = await listNotes(vaultPath, directory, limit, offset, includeFolders);
      return structuredResponse(result, makeStructuredDescription('Listed notes', result.count), createMetadata(startTime, { tool: toolName }));
    },
    'read-note': async (args, startTime, toolName) => {
      const note = await readResolvedNote(vaultPath, args.path);
      return structuredResponse(
        {
          path: note.path,
          content: note.content
        },
        `Read note ${note.path}`,
        createMetadata(startTime, { tool: toolName, contentLength: note.content.length })
      );
    },
    'update-note': async (args, startTime, toolName) => {
      const result = await updateNote(vaultPath, args.path, {
        mode: args.mode,
        content: args.content,
        separator: args.separator,
        patches: args.patches
      });
      return structuredResponse(
        result,
        `Note ${result.status} successfully: ${result.path}`,
        createMetadata(startTime, { tool: toolName, contentLength: result.newContentLength })
      );
    },
    'move-note': async (args, startTime, toolName) => {
      const result = await moveNote(vaultPath, args.sourcePath, args.destinationPath, args.overwrite ?? false);
      return structuredResponse(
        result,
        `Note moved from ${result.fromPath} to ${result.path}`,
        createMetadata(startTime, { tool: toolName })
      );
    },
    'delete-note': async (args, startTime, toolName) => {
      await deleteNote(vaultPath, args.path);
      return structuredResponse(
        {
          path: args.path,
          status: 'deleted'
        },
        `Note deleted successfully: ${args.path}`,
        createMetadata(startTime, { tool: toolName })
      );
    }
  };
}
