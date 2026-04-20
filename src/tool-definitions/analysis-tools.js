export const analysisToolDefinitions = [
  {
    name: 'get-vault-structure',
    title: 'Get Vault Structure',
    description: 'Return a folder tree with note counts for quick structural orientation before deeper searches.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to treat as the root of the returned tree.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        root: { type: 'string' },
        folderCount: { type: 'integer', minimum: 0 },
        noteCount: { type: 'integer', minimum: 0 },
        folders: { type: 'array' }
      },
      required: ['root', 'folderCount', 'noteCount', 'folders'],
      additionalProperties: false
    }
  },
  {
    name: 'list-notes-detailed',
    title: 'List Notes Detailed',
    description: 'List notes with timestamps, size, tags, task counts, link counts, and backlinks for triage and cleanup.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 500, description: 'Maximum number of notes to return.' },
        offset: { type: 'integer', default: 0, minimum: 0, description: 'Number of notes to skip for pagination.' },
        sortBy: { type: 'string', enum: ['path', 'createdAt', 'updatedAt', 'sizeBytes', 'lineCount', 'linkCount', 'backlinkCount', 'taskCount'], description: 'Field to sort by before pagination.' },
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notes: { type: 'array' },
        count: { type: 'integer', minimum: 0 },
        errors: { type: 'array' },
        pagination: { type: 'object' }
      },
      required: ['notes', 'count', 'errors', 'pagination'],
      additionalProperties: false
    }
  },
  {
    name: 'list-notes-full',
    title: 'List Notes Full',
    description: 'Return the full note path list for a vault or directory without pagination so batch reorganizations can target exact files.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' },
        sort: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction for returned paths.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        root: { type: 'string' },
        notes: { type: 'array', items: { type: 'string' } },
        count: { type: 'integer', minimum: 0 },
        errors: { type: 'array' }
      },
      required: ['root', 'notes', 'count', 'errors'],
      additionalProperties: false
    }
  },
  {
    name: 'list-folders',
    title: 'List Folders',
    description: 'Return the folder tree and flattened folder paths for structural cleanup without reading note bodies.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to treat as the root of the returned tree.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        root: { type: 'string' },
        folderCount: { type: 'integer', minimum: 0 },
        folders: { type: 'array' },
        paths: { type: 'array', items: { type: 'string' } }
      },
      required: ['root', 'folderCount', 'folders', 'paths'],
      additionalProperties: false
    }
  },
  {
    name: 'preview-notes',
    title: 'Preview Notes',
    description: 'Return a trimmed preview from the first N body lines of many notes without sending full documents.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' },
        limit: { type: 'integer', default: 50, minimum: 1, maximum: 300, description: 'Maximum number of note previews to return.' },
        offset: { type: 'integer', default: 0, minimum: 0, description: 'Number of note previews to skip for pagination.' },
        previewLines: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Number of body lines to include per note.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notes: { type: 'array' },
        count: { type: 'integer', minimum: 0 },
        errors: { type: 'array' },
        pagination: { type: 'object' }
      },
      required: ['notes', 'count', 'errors', 'pagination'],
      additionalProperties: false
    }
  },
  {
    name: 'read-frontmatter',
    title: 'Read Frontmatter',
    description: 'Return a note frontmatter block and any parse error without mutating the note.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', pattern: '\\.md$', description: 'Vault-relative markdown path to inspect.' }
      },
      required: ['path'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        frontmatter: { type: 'object' },
        parseError: { type: ['string', 'null'] }
      },
      required: ['path', 'frontmatter', 'parseError'],
      additionalProperties: false
    }
  },
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
    name: 'bulk-update-frontmatter',
    title: 'Bulk Update Frontmatter',
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
    name: 'search-links-to',
    title: 'Search Links To',
    description: 'Return the notes that link to one target note, including the raw wikilink targets that resolve there.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        targetPath: { type: 'string', minLength: 1, description: 'Target note path or unique filename to inspect backlinks for.' },
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' }
      },
      required: ['targetPath'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        targetPath: { type: 'string' },
        resolvedPath: { type: 'string' },
        inboundCount: { type: 'integer', minimum: 0 },
        links: { type: 'array' }
      },
      required: ['targetPath', 'resolvedPath', 'inboundCount', 'links'],
      additionalProperties: false
    }
  },
  {
    name: 'preview-move-impact',
    title: 'Preview Move Impact',
    description: 'Preview backlinks that would stop resolving after moving or renaming a note before applying the move.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sourcePath: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Existing note path or unique markdown filename to move.' },
        destinationPath: { type: 'string', minLength: 1, pattern: '\\.md$', description: 'Proposed vault-relative destination path.' }
      },
      required: ['sourcePath', 'destinationPath'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sourcePath: { type: 'string' },
        resolvedSourcePath: { type: 'string' },
        destinationPath: { type: 'string' },
        renameDetected: { type: 'boolean' },
        inboundLinkCount: { type: 'integer', minimum: 0 },
        affectedLinkCount: { type: 'integer', minimum: 0 },
        affectedLinks: { type: 'array' },
        sourceOutboundLinks: { type: 'array' }
      },
      required: ['sourcePath', 'resolvedSourcePath', 'destinationPath', 'renameDetected', 'inboundLinkCount', 'affectedLinkCount', 'affectedLinks', 'sourceOutboundLinks'],
      additionalProperties: false
    }
  },
  {
    name: 'move-many',
    title: 'Move Many',
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
  },
  {
    name: 'find-broken-links',
    title: 'Find Broken Links',
    description: 'Return unresolved wikilinks across the vault so move or rename accidents can be audited quickly.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        links: { type: 'array' },
        count: { type: 'integer', minimum: 0 },
        summaryByNote: { type: 'array' }
      },
      required: ['links', 'count', 'summaryByNote'],
      additionalProperties: false
    }
  },
  {
    name: 'collect-task-styles',
    title: 'Collect Task Styles',
    description: 'Scan notes for task marker variants to spot completion-style drift before normalizing task syntax.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        variants: { type: 'array' },
        count: { type: 'integer', minimum: 0 }
      },
      required: ['variants', 'count'],
      additionalProperties: false
    }
  }
];
