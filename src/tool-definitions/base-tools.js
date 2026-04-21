import { TOOL_NAMES } from '../tool-names.js';

export const baseToolDefinitions = [
  {
    name: TOOL_NAMES.SEARCH_VAULT,
    title: 'Search Vault',
    description: 'Search note contents using boolean operators, field filters, phrases, and optional context snippets. Use `OR` explicitly when any-term matching is desired.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, description: 'Search expression. Space-separated terms default to AND. Supports OR, NOT, title:, content:, tag:, quoted phrases, and parentheses.' },
        path: { type: 'string', description: 'Optional vault-relative directory to limit the search scope.' },
        caseSensitive: { type: 'boolean', default: false, description: 'Match text with exact casing when true.' },
        includeContext: { type: 'boolean', default: true, description: 'Include surrounding lines and a highlighted snippet for each match.' },
        contextLines: { type: 'integer', default: 2, minimum: 0, maximum: 10, description: 'Number of nearby lines to inspect when building the highlighted context snippet.' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 500, description: 'Maximum number of matches to return.' },
        offset: { type: 'integer', default: 0, minimum: 0, description: 'Number of matches to skip for pagination.' }
      },
      required: ['query'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        files: { type: 'array' },
        totalMatches: { type: 'integer', minimum: 0 },
        fileCount: { type: 'integer', minimum: 0 },
        filesSearched: { type: 'integer', minimum: 0 },
        pagination: { type: 'object' }
      },
      required: ['files', 'totalMatches', 'fileCount', 'filesSearched', 'pagination'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.SEARCH_BY_FILENAME,
    title: 'Search by Filename',
    description: 'Search notes by filename, stem, or vault-relative path. Use this when the note name is known but the H1 title may differ.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, description: 'Substring to match against note filename, stem, or path.' },
        path: { type: 'string', description: 'Optional vault-relative directory to limit the search scope.' },
        caseSensitive: { type: 'boolean', default: false, description: 'Match filename casing exactly when true.' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 1000, description: 'Maximum number of notes to return.' },
        offset: { type: 'integer', default: 0, minimum: 0, description: 'Number of matching notes to skip for pagination.' }
      },
      required: ['query'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        results: { type: 'array' },
        count: { type: 'integer' },
        filesSearched: { type: 'integer' },
        pagination: { type: 'object' }
      },
      required: ['results', 'count', 'filesSearched', 'pagination'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.LIST_NOTES,
    title: 'List Notes',
    description: 'List markdown note paths in the vault or a specific directory without reading note contents. Optionally include the folder tree in the same response.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to list from.' },
        includeFolders: { type: 'boolean', default: false, description: 'When true, also return folder tree data and flattened folder paths for the same scope.' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 1000, description: 'Maximum number of note paths to return.' },
        offset: { type: 'integer', default: 0, minimum: 0, description: 'Number of note paths to skip for pagination.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notes: { type: 'array' },
        count: { type: 'integer' },
        pagination: { type: 'object' },
        root: { type: 'string' },
        folderCount: { type: 'integer', minimum: 0 },
        folders: { type: 'array' },
        folderPaths: { type: 'array', items: { type: 'string' } }
      },
      required: ['notes', 'count', 'pagination', 'root', 'folderCount', 'folders', 'folderPaths'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.READ_NOTE,
    title: 'Read Note',
    description: 'Read the full content of one markdown note. Accepts an exact path or a unique filename resolved anywhere in the vault.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Vault-relative markdown path or unique markdown filename.' }
      },
      required: ['path'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.UPDATE_NOTE,
    title: 'Update Note',
    description: 'Create, replace, append to, or patch part of a markdown note. Use `replace` for full writes, `append` for tail additions, and `patch` for exact substring edits.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Vault-relative markdown path, or a unique markdown filename for append and patch operations.' },
        mode: { type: 'string', enum: ['replace', 'append', 'patch'], default: 'replace', description: 'Update strategy. `replace` writes the whole note, `append` adds to the end, `patch` applies exact substring replacements.' },
        content: { type: 'string', description: 'Required for `replace` and `append`. Complete content for `replace`, appended text for `append`.' },
        separator: { type: 'string', default: '\n\n', description: 'Used only for `append`. Inserted between existing content and appended text when the note is not empty.' },
        patches: {
          type: 'array',
          description: 'Used only for `patch`. Applied in order to the current note content.',
          items: {
            type: 'object',
            properties: {
              match: { type: 'string', minLength: 1, description: 'Exact substring to find.' },
              replace: { type: 'string', description: 'Replacement text. Defaults to an empty string.' },
              replaceAll: { type: 'boolean', default: false, description: 'Replace every occurrence when true. Otherwise exactly one occurrence is required unless `expectedMatches` is set.' },
              expectedMatches: { type: 'integer', minimum: 1, description: 'Optional exact match count guard before applying the patch.' }
            },
            required: ['match'],
            additionalProperties: false
          }
        }
      },
      required: ['path'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        status: { type: 'string', enum: ['written', 'appended', 'patched'] },
        previousContentLength: { type: 'integer', minimum: 0 },
        newContentLength: { type: 'integer', minimum: 0 },
        changeCount: { type: 'integer', minimum: 1 }
      },
      required: ['path', 'status', 'previousContentLength', 'newContentLength', 'changeCount'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.MOVE_NOTE,
    title: 'Move Note',
    description: 'Move or rename a markdown note to a new vault-relative path. Source accepts an exact path or a unique filename resolved anywhere in the vault. This automatically follows owned asset files and rewrites supported internal note links that pointed to the moved note. Follow-up writes are best-effort and are not applied transactionally with the rename.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sourcePath: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Existing vault-relative markdown path or unique markdown filename to move.' },
        destinationPath: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'New vault-relative markdown path to move the note to.' },
        overwrite: { type: 'boolean', default: false, description: 'Replace an existing destination note when true.' }
      },
      required: ['sourcePath', 'destinationPath'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        fromPath: { type: 'string' },
        path: { type: 'string' },
        status: { type: 'string', enum: ['moved'] }
      },
      required: ['fromPath', 'path', 'status'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.DELETE_NOTE,
    title: 'Delete Note',
    description: 'Delete a markdown note by vault-relative path. This also removes owned asset files and rewrites supported internal note links in surviving notes so they no longer point at the deleted note. Follow-up writes are best-effort and are not applied transactionally with the delete.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Vault-relative markdown path to delete.' }
      },
      required: ['path'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        status: { type: 'string', enum: ['deleted'] }
      },
      required: ['path', 'status'],
      additionalProperties: false
    }
  }
];
