import { TOOL_NAMES } from '../tool-names.js';

export const analysisToolDefinitions = [
  {
    name: TOOL_NAMES.WRITE_FRONTMATTER,
    title: 'Write Frontmatter',
    description: 'Preview or apply a frontmatter update for one note. Accepts a vault-relative note path and appends `.md` automatically when omitted. `dryRun: true` is the safe default. For multi-note work, repeat this single-note tool from the MCP client; no bulk variant is published.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Vault-relative note path to update. The `.md` extension may be omitted.' },
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
    name: TOOL_NAMES.LIST_TAGS,
    title: 'List Tags',
    description: 'List tags for one note or aggregate tag usage across the vault or a directory. Note-level output separates `frontmatter.tags` from inline `#tags` instead of merging their sources silently.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notePath: { type: 'string', description: 'Optional specific note path. When provided, returns tags for that note only. The `.md` extension may be omitted.' },
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
    description: 'Preview or apply tag updates for one note by editing only `frontmatter.tags`. Tags are matched case-insensitively, must follow Obsidian tag rules, and inline `#tags` in the note body are never rewritten. Inline tags are reported separately for awareness. For multi-note work, repeat this single-note tool from the MCP client; no bulk variant is published.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Vault-relative note path to update. The `.md` extension may be omitted.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag values to add, remove, or replace in `frontmatter.tags`. Leading `#` is ignored. Tags are case-insensitive and cannot be only numbers.' },
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
  }
];
