import { TOOL_NAMES } from '../tool-names.js';

export const analysisToolDefinitions = [
  {
    name: TOOL_NAMES.WRITE_FRONTMATTER,
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
    name: TOOL_NAMES.BULK_WRITE_FRONTMATTER,
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
    name: TOOL_NAMES.EXTRACT_TASKS,
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
    name: TOOL_NAMES.ANALYZE_LINKS,
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
    name: TOOL_NAMES.BULK_MOVE_NOTE,
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
  },
  {
    name: TOOL_NAMES.LIST_TAGS,
    title: 'List Tags',
    description: 'List tags for one note or aggregate tag usage across the vault or a directory. Note-level output separates `frontmatter.tags` from inline `#tags` instead of merging their sources silently.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notePath: { type: 'string', pattern: '\\.md$', description: 'Optional specific note path. When provided, returns tags for that note only.' },
        directory: { type: 'string', description: 'Optional vault-relative directory to scan for aggregated tag usage.' },
        includeNotes: { type: 'boolean', default: false, description: 'When true, include note paths for each aggregated tag.' }
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
            frontmatterTags: { type: 'array', items: { type: 'string' } },
            inlineTags: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            frontmatterError: { type: ['string', 'null'] }
          },
          required: ['path', 'frontmatterTags', 'inlineTags', 'tags', 'frontmatterError'],
          additionalProperties: false
        },
        {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tag: { type: 'string' },
                  count: { type: 'integer', minimum: 0 },
                  notes: { type: 'array', items: { type: 'string' } }
                },
                required: ['tag', 'count', 'notes'],
                additionalProperties: false
              }
            },
            count: { type: 'integer', minimum: 0 },
            noteCount: { type: 'integer', minimum: 0 }
          },
          required: ['tags', 'count', 'noteCount'],
          additionalProperties: false
        }
      ]
    }
  },
  {
    name: TOOL_NAMES.WRITE_TAGS,
    title: 'Write Tags',
    description: 'Preview or apply tag updates for one note by editing only `frontmatter.tags`. Inline `#tags` in the note body are never rewritten and are reported separately for awareness.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', pattern: '\\.md$', description: 'Vault-relative markdown path to update.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag values to add, remove, or replace in `frontmatter.tags`. Leading `#` is ignored.' },
        mode: { type: 'string', enum: ['replace', 'add', 'remove'], default: 'replace', description: 'Tag update mode for `frontmatter.tags` only. This does not modify inline `#tags`.' },
        dryRun: { type: 'boolean', default: true, description: 'When true, return the planned changes without writing.' }
      },
      required: ['path', 'tags'],
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string' },
        dryRun: { type: 'boolean' },
        written: { type: 'boolean' },
        mode: { type: 'string', enum: ['replace', 'add', 'remove'] },
        beforeFrontmatterTags: { type: 'array', items: { type: 'string' } },
        afterFrontmatterTags: { type: 'array', items: { type: 'string' } },
        inlineTagsDetected: { type: 'array', items: { type: 'string' } },
        addedTags: { type: 'array', items: { type: 'string' } },
        removedTags: { type: 'array', items: { type: 'string' } },
        changes: { type: 'array' }
      },
      required: ['path', 'dryRun', 'written', 'mode', 'beforeFrontmatterTags', 'afterFrontmatterTags', 'inlineTagsDetected', 'addedTags', 'removedTags', 'changes'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.BULK_DELETE_NOTE,
    title: 'Bulk Delete Note',
    description: 'Preview or apply deletion of many notes. Optional asset cleanup deletes only assets referenced exclusively by the targeted note set; shared assets are left in place.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string', pattern: '\\.md$' }, description: 'Explicit note paths to delete. Takes priority over directory scanning.' },
        directory: { type: 'string', description: 'Optional vault-relative directory to delete from when `paths` is omitted.' },
        dryRun: { type: 'boolean', default: true, description: 'When true, validate and preview without deleting.' },
        deleteOwnedAssets: { type: 'boolean', default: false, description: 'When true, also delete assets whose known note references all come from the targeted note set. Shared assets are not deleted.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        dryRun: { type: 'boolean' },
        applied: { type: 'boolean' },
        validationFailed: { type: 'boolean' },
        targetCount: { type: 'integer', minimum: 0 },
        deletedCount: { type: 'integer', minimum: 0 },
        deletedAssetCount: { type: 'integer', minimum: 0 },
        errors: { type: 'array' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              status: { type: 'string', enum: ['planned', 'deleted', 'failed'] },
              assetPaths: { type: 'array', items: { type: 'string' } },
              errors: { type: 'array', items: { type: 'string' } }
            },
            required: ['path', 'status', 'assetPaths', 'errors'],
            additionalProperties: false
          }
        }
      },
      required: ['dryRun', 'applied', 'validationFailed', 'targetCount', 'deletedCount', 'deletedAssetCount', 'errors', 'results'],
      additionalProperties: false
    }
  },
  {
    name: TOOL_NAMES.AUDIT_ASSETS,
    title: 'Audit Assets',
    description: 'Audit vault assets for unreferenced files, missing references, shared assets, and note-owned assets.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to audit.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        assetCount: { type: 'integer', minimum: 0 },
        referencedAssetCount: { type: 'integer', minimum: 0 },
        unreferencedAssets: { type: 'array', items: { type: 'string' } },
        missingAssets: { type: 'array' },
        sharedAssets: { type: 'array' },
        ownedAssetsByNote: { type: 'array' },
        noteCount: { type: 'integer', minimum: 0 }
      },
      required: ['assetCount', 'referencedAssetCount', 'unreferencedAssets', 'missingAssets', 'sharedAssets', 'ownedAssetsByNote', 'noteCount'],
      additionalProperties: false
    }
  }
];
