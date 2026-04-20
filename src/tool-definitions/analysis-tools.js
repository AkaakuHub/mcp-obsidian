export const analysisToolDefinitions = [
  {
    name: 'get-vault-structure',
    title: 'Get Vault Structure',
    description: 'Return the folder hierarchy with note counts to understand the vault layout quickly',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'list-notes-detailed',
    title: 'List Notes Detailed',
    description: 'List notes with path, timestamps, tags, size, task count, and link counts',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 500 },
        offset: { type: 'integer', default: 0, minimum: 0 },
        sortBy: { type: 'string', enum: ['path', 'createdAt', 'updatedAt', 'sizeBytes', 'lineCount', 'linkCount', 'backlinkCount', 'taskCount'] },
        order: { type: 'string', enum: ['asc', 'desc'] }
      },
      additionalProperties: false
    }
  },
  {
    name: 'preview-notes',
    title: 'Preview Notes',
    description: 'Return the first few lines of many notes without reading full content in the client',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' },
        limit: { type: 'integer', default: 50, minimum: 1, maximum: 300 },
        offset: { type: 'integer', default: 0, minimum: 0 },
        previewLines: { type: 'integer', default: 20, minimum: 1, maximum: 100 }
      },
      additionalProperties: false
    }
  },
  {
    name: 'read-frontmatter',
    title: 'Read Frontmatter',
    description: 'Read just the frontmatter fields from a note',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', pattern: '\\.md$' }
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    name: 'write-frontmatter',
    title: 'Write Frontmatter',
    description: 'Update frontmatter for a single note with optional dry-run preview',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', pattern: '\\.md$' },
        fields: { type: 'object' },
        merge: { type: 'boolean', default: true },
        dryRun: { type: 'boolean', default: true }
      },
      required: ['path', 'fields'],
      additionalProperties: false
    }
  },
  {
    name: 'bulk-update-frontmatter',
    title: 'Bulk Update Frontmatter',
    description: 'Safely preview or apply frontmatter updates to many notes with dry-run, diff summary, and target counts',
    inputSchema: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string', pattern: '\\.md$' } },
        directory: { type: 'string' },
        fields: { type: 'object' },
        merge: { type: 'boolean', default: true },
        dryRun: { type: 'boolean', default: true },
        limit: { type: 'integer', default: 100, minimum: 1, maximum: 500 }
      },
      required: ['fields'],
      additionalProperties: false
    }
  },
  {
    name: 'extract-tasks',
    title: 'Extract Tasks',
    description: 'Extract markdown tasks from the vault with due date detection and note summaries',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' },
        includeCompleted: { type: 'boolean', default: true },
        limit: { type: 'integer', default: 500, minimum: 1, maximum: 2000 },
        offset: { type: 'integer', default: 0, minimum: 0 }
      },
      additionalProperties: false
    }
  },
  {
    name: 'analyze-links',
    title: 'Analyze Links',
    description: 'Return backlinks, outbound links, orphan notes, and hub notes',
    inputSchema: {
      type: 'object',
      properties: {
        notePath: { type: 'string', pattern: '\\.md$' },
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  }
];
