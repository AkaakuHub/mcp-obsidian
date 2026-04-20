export const baseToolDefinitions = [
  {
    name: 'search-vault',
    title: 'Search Vault',
    description: 'Search for content in Obsidian vault notes. CRITICAL: Multiple space-separated terms default to AND (all required). Use OR for better results: "git OR repository OR backup" finds notes with ANY term. Search progressively: start broad (single key term), then narrow down. Don\'t give up after one try! Supports: boolean operators (AND, OR, NOT), field specifiers (title:, content:, tag:), quoted phrases, parentheses.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        path: { type: 'string' },
        caseSensitive: { type: 'boolean', default: false },
        includeContext: { type: 'boolean', default: true },
        contextLines: { type: 'integer', default: 2, minimum: 0, maximum: 10 },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 500 },
        offset: { type: 'integer', default: 0, minimum: 0 }
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
    name: 'search-by-title',
    title: 'Search by Title',
    description: 'Search for notes by their H1 title',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        path: { type: 'string' },
        caseSensitive: { type: 'boolean', default: false },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 1000 },
        offset: { type: 'integer', default: 0, minimum: 0 }
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
    description: 'List all notes in the vault or a specific directory',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 1000 },
        offset: { type: 'integer', default: 0, minimum: 0 }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notes: { type: 'array' },
        count: { type: 'integer' },
        pagination: { type: 'object' }
      },
      required: ['notes', 'count', 'pagination'],
      additionalProperties: false
    }
  },
  {
    name: 'read-note',
    title: 'Read Note',
    description: 'Read the content of a specific note',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$' }
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    name: 'write-note',
    title: 'Write Note',
    description: 'Create or update a note',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$' },
        content: { type: 'string' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    }
  },
  {
    name: 'delete-note',
    title: 'Delete Note',
    description: 'Delete a note',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\.md$' }
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    name: 'search-by-tags',
    title: 'Search by Tags',
    description: 'Search for notes by tags (supports both frontmatter and inline tags)',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
        directory: { type: 'string' },
        caseSensitive: { type: 'boolean', default: false }
      },
      required: ['tags'],
      additionalProperties: false
    }
  },
  {
    name: 'get-note-metadata',
    title: 'Get Note Metadata',
    description: 'Get metadata for a specific note or all notes in the vault',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        batch: { type: 'boolean', default: false },
        directory: { type: 'string' },
        limit: { type: 'integer', default: 50, minimum: 1, maximum: 500 },
        offset: { type: 'integer', default: 0, minimum: 0 }
      },
      additionalProperties: false
    }
  },
  {
    name: 'discover-mocs',
    title: 'Discover MOCs',
    description: 'Discover Maps of Content and their outgoing links',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        mocName: { type: 'string' },
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  }
];
