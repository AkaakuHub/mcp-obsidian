export const auditToolDefinitions = [
  {
    name: 'detect-daily-notes',
    title: 'Detect Daily Notes',
    description: 'Detect daily, journal, log, and thino-style notes by path and filename heuristics',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'detect-similar-notes',
    title: 'Detect Similar Notes',
    description: 'Find notes with similar titles to catch duplicates or near-duplicates',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' },
        threshold: { type: 'number', default: 0.6, minimum: 0, maximum: 1 }
      },
      additionalProperties: false
    }
  },
  {
    name: 'detect-large-notes',
    title: 'Detect Large Notes',
    description: 'Find large notes by byte size or line count',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' },
        minSizeBytes: { type: 'integer', default: 50000, minimum: 1 },
        minLineCount: { type: 'integer', default: 800, minimum: 1 }
      },
      additionalProperties: false
    }
  },
  {
    name: 'detect-unorganized-notes',
    title: 'Detect Unorganized Notes',
    description: 'Find notes with missing tags, missing frontmatter, no links, or cluttered root placement',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'vault-inventory',
    title: 'Vault Inventory',
    description: 'Scan the vault and return folder, tag, task, orphan, large-note, and recency inventory in one response',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'task-audit',
    title: 'Task Audit',
    description: 'Audit task-management usage across the vault, including missing due dates and task hotspots',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' },
        hotspotThreshold: { type: 'integer', default: 20, minimum: 1 }
      },
      additionalProperties: false
    }
  },
  {
    name: 'daily-journal-audit',
    title: 'Daily Journal Audit',
    description: 'Audit daily, journal, and memo-style notes and propose likely entry points or migration candidates',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'propose-note-refactors',
    title: 'Propose Note Refactors',
    description: 'Proposal-only safe refactor mode that suggests move, rename, and linking actions without applying them',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' }
      },
      additionalProperties: false
    }
  }
];
