import { createMetadata, structuredResponse } from '../response-formatter.js';
import { appendToNote, deleteNote, listNotes, moveNote, readResolvedNote, searchByFilename, searchByTags, searchVault, writeNote } from '../tools.js';

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
      const { directory, limit = 100, offset = 0 } = args;
      const result = await listNotes(vaultPath, directory, limit, offset);
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
    'write-note': async (args, startTime, toolName) => {
      await writeNote(vaultPath, args.path, args.content);
      return structuredResponse(
        {
          path: args.path,
          status: 'written'
        },
        `Note written successfully to ${args.path}`,
        createMetadata(startTime, { tool: toolName, contentLength: args.content.length })
      );
    },
    'append-to-note': async (args, startTime, toolName) => {
      const result = await appendToNote(vaultPath, args.path, args.content, { separator: args.separator });
      return structuredResponse(
        result,
        `Appended content to ${result.path}`,
        createMetadata(startTime, { tool: toolName, contentLength: args.content.length })
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
    },
    'search-by-tags': async (args, startTime, toolName) => {
      const { tags, directory, caseSensitive = false } = args;
      const result = await searchByTags(vaultPath, tags, directory, caseSensitive);
      return structuredResponse(result, `Found ${result.count} notes with requested tags`, createMetadata(startTime, { tool: toolName, tagsSearched: tags.length }));
    }
  };
}
