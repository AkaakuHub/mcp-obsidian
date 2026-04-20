export const baseToolDefinitions = [
  {
    name: 'search-vault',
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
    name: 'search-by-filename',
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
    name: 'list-notes',
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
    name: 'read-note',
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
    name: 'write-note',
    title: 'Write Note',
    description: 'Create or replace a markdown note. Parent directories are created automatically.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Vault-relative markdown path to create or replace.' },
        content: { type: 'string', description: 'Complete markdown content to write.' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        status: { type: 'string', enum: ['written'] }
      },
      required: ['path', 'status'],
      additionalProperties: false
    }
  },
  {
    name: 'append-to-note',
    title: 'Append to Note',
    description: 'Append content to an existing markdown note without replacing the rest of the file. Resolves a unique filename anywhere in the vault.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Existing vault-relative markdown path or unique markdown filename.' },
        content: { type: 'string', description: 'Markdown content to append.' },
        separator: { type: 'string', default: '\n\n', description: 'String inserted between existing content and appended content when the note is not empty.' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        status: { type: 'string', enum: ['appended'] },
        appendedLength: { type: 'integer', minimum: 0 },
        newContentLength: { type: 'integer', minimum: 0 }
      },
      required: ['path', 'status', 'appendedLength', 'newContentLength'],
      additionalProperties: false
    }
  },
  {
    name: 'move-note',
    title: 'Move Note',
    description: 'Move or rename a markdown note to a new vault-relative path. Source accepts an exact path or a unique filename resolved anywhere in the vault.',
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
    name: 'delete-note',
    title: 'Delete Note',
    description: 'Delete a markdown note by vault-relative path.',
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
  },
  {
    name: 'search-by-tags',
    title: 'Search by Tags',
    description: 'Find notes that contain all requested tags. Searches inline `#tags` and common frontmatter `tags` forms.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, description: 'Tags to require. Matching uses AND semantics across the list.' },
        directory: { type: 'string', description: 'Optional vault-relative directory to limit the scan scope.' },
        caseSensitive: { type: 'boolean', default: false, description: 'Match tags with exact casing when true.' }
      },
      required: ['tags'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notes: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['path', 'tags'], additionalProperties: false } },
        count: { type: 'integer', minimum: 0 }
      },
      required: ['notes', 'count'],
      additionalProperties: false
    }
  }
];
