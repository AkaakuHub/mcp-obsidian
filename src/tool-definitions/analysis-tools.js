export const analysisToolDefinitions = [
  {
    name: 'write-frontmatter',
    title: 'Write Frontmatter',
    description: 'Preview or apply a frontmatter update for one note. `dryRun: true` is the safe default.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', pattern: '\\.md$', description: 'Vault-relative markdown path to update.' },
        fields: { type: 'object', description: 'Frontmatter keys and values to write.' },
        merge: { type: 'boolean', default: true, description: 'When true, merge with existing frontmatter. When false, replace it.' },
        dryRun: { type: 'boolean', default: true, description: 'When true, return the diff without writing the note.' }
      },
      required: ['path', 'fields'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        dryRun: { type: 'boolean' },
        written: { type: 'boolean' },
        changes: { type: 'array' },
        before: { type: 'object' },
        after: { type: 'object' }
      },
      required: ['path', 'dryRun', 'written', 'changes', 'before', 'after'],
      additionalProperties: false
    }
  },
  {
    name: 'bulk-write-frontmatter',
    title: 'Bulk Write Frontmatter',
    description: 'Preview or apply frontmatter updates to many notes. If both `paths` and `directory` are given, explicit `paths` win. Validation happens before writes.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string', pattern: '\\.md$' }, description: 'Explicit list of note paths to update. Takes priority over directory scanning.' },
        directory: { type: 'string', description: 'Optional vault-relative directory to scan when `paths` is omitted.' },
        fields: { type: 'object', description: 'Frontmatter keys and values to write.' },
        merge: { type: 'boolean', default: true, description: 'When true, merge with existing frontmatter. When false, replace it.' },
        dryRun: { type: 'boolean', default: true, description: 'When true, return planned changes without writing.' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 500, description: 'Maximum number of notes to include when scanning by directory.' }
      },
      required: ['fields'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        dryRun: { type: 'boolean' },
        applied: { type: 'boolean' },
        validationFailed: { type: 'boolean' },
        rolledBack: { type: 'boolean' },
        targetCount: { type: 'integer', minimum: 0 },
        updatedCount: { type: 'integer', minimum: 0 },
        errors: { type: 'array' },
        rollbackErrors: { type: 'array' },
        results: { type: 'array' }
      },
      required: ['dryRun', 'applied', 'validationFailed', 'targetCount', 'updatedCount', 'errors', 'results'],
      additionalProperties: false
    }
  },
  {
    name: 'extract-tasks',
    title: 'Extract Tasks',
    description: 'Extract markdown tasks across the vault with completion state, due dates, and per-note task summaries.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' },
        includeCompleted: { type: 'boolean', default: true, description: 'Include completed tasks when true.' },
        limit: { type: 'integer', default: 500, minimum: 1, maximum: 2000, description: 'Maximum number of tasks to return.' },
        offset: { type: 'integer', default: 0, minimum: 0, description: 'Number of tasks to skip for pagination.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        tasks: { type: 'array' },
        count: { type: 'integer', minimum: 0 },
        total: { type: 'integer', minimum: 0 },
        summaryByNote: { type: 'array' },
        pagination: { type: 'object' }
      },
      required: ['tasks', 'count', 'total', 'summaryByNote', 'pagination'],
      additionalProperties: false
    }
  },
  {
    name: 'analyze-links',
    title: 'Analyze Links',
    description: 'Inspect link relationships for one note or the whole vault, including backlinks, orphans, and hubs.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notePath: { type: 'string', pattern: '\\.md$', description: 'Optional specific note path. When omitted, returns the full graph summary.' },
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      anyOf: [
        {
          type: 'object',
          properties: {
            path: { type: 'string' },
            outboundCount: { type: 'integer', minimum: 0 },
            inboundCount: { type: 'integer', minimum: 0 },
            outboundLinks: { type: 'array' },
            inboundLinks: { type: 'array' },
            isOrphan: { type: 'boolean' },
            isHub: { type: 'boolean' }
          },
          required: ['path', 'outboundCount', 'inboundCount', 'outboundLinks', 'inboundLinks', 'isOrphan', 'isHub'],
          additionalProperties: false
        },
        {
          type: 'object',
          properties: {
            notes: { type: 'array' },
            orphanCount: { type: 'integer', minimum: 0 },
            hubCount: { type: 'integer', minimum: 0 },
            orphans: { type: 'array', items: { type: 'string' } },
            hubs: { type: 'array', items: { type: 'string' } }
          },
          required: ['notes', 'orphanCount', 'hubCount', 'orphans', 'hubs'],
          additionalProperties: false
        }
      ]
    }
  },
  {
    name: 'bulk-move-note',
    title: 'Bulk Move Note',
    description: 'Preview or apply a batch of note moves with upfront validation and rollback attempts if a write fails mid-run.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        moves: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              sourcePath: { type: 'string', minLength: 1, pattern: '\\.md$' },
              destinationPath: { type: 'string', minLength: 1, pattern: '\\.md$' }
            },
            required: ['sourcePath', 'destinationPath'],
            additionalProperties: false
          },
          description: 'List of note moves to validate or apply.'
        },
        overwrite: { type: 'boolean', default: false, description: 'Replace existing destination notes when true.' },
        dryRun: { type: 'boolean', default: true, description: 'When true, validate and preview without moving files.' }
      },
      required: ['moves'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        dryRun: { type: 'boolean' },
        applied: { type: 'boolean' },
        validationFailed: { type: 'boolean' },
        rolledBack: { type: 'boolean' },
        moveCount: { type: 'integer', minimum: 0 },
        movedCount: { type: 'integer', minimum: 0 },
        errors: { type: 'array' },
        rollbackErrors: { type: 'array' },
        results: { type: 'array' }
      },
      required: ['dryRun', 'applied', 'validationFailed', 'rolledBack', 'moveCount', 'movedCount', 'errors', 'rollbackErrors', 'results'],
      additionalProperties: false
    }
  }
];
