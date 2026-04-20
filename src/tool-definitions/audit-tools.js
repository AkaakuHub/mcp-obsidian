export const auditToolDefinitions = [
  {
    name: 'detect-daily-notes',
    title: 'Detect Daily Notes',
    description: 'Detect daily, journal, log, and thino-style notes using path and filename heuristics.',
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
        notes: { type: 'array' },
        count: { type: 'integer', minimum: 0 }
      },
      required: ['notes', 'count'],
      additionalProperties: false
    }
  },
  {
    name: 'detect-similar-notes',
    title: 'Detect Similar Notes',
    description: 'Find notes with similar titles to surface duplicates or near-duplicates before merging.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' },
        threshold: { type: 'number', default: 0.6, minimum: 0, maximum: 1, description: 'Minimum title similarity score from 0 to 1.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        pairs: { type: 'array' },
        count: { type: 'integer', minimum: 0 }
      },
      required: ['pairs', 'count'],
      additionalProperties: false
    }
  },
  {
    name: 'detect-large-notes',
    title: 'Detect Large Notes',
    description: 'Find notes that exceed byte-size or line-count thresholds.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' },
        minSizeBytes: { type: 'integer', default: 50000, minimum: 1, description: 'Minimum note size in bytes to flag as large.' },
        minLineCount: { type: 'integer', default: 800, minimum: 1, description: 'Minimum line count to flag as large.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        notes: { type: 'array' },
        count: { type: 'integer', minimum: 0 }
      },
      required: ['notes', 'count'],
      additionalProperties: false
    }
  },
  {
    name: 'detect-unorganized-notes',
    title: 'Detect Unorganized Notes',
    description: 'Find notes with missing tags, missing frontmatter, no links, or cluttered root placement.',
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
        notes: { type: 'array' },
        count: { type: 'integer', minimum: 0 }
      },
      required: ['notes', 'count'],
      additionalProperties: false
    }
  },
  {
    name: 'vault-inventory',
    title: 'Vault Inventory',
    description: 'Return a one-shot inventory summary of folders, top tags, tasks, large notes, orphan notes, and recent notes.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to inventory.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        noteCount: { type: 'integer', minimum: 0 },
        folderCount: { type: 'integer', minimum: 0 },
        taskCount: { type: 'integer', minimum: 0 },
        orphanCount: { type: 'integer', minimum: 0 },
        topTags: { type: 'array' },
        largeNotes: { type: 'array' },
        recentNotes: { type: 'array' },
        orphans: { type: 'array', items: { type: 'string' } }
      },
      required: ['noteCount', 'folderCount', 'taskCount', 'orphanCount', 'topTags', 'largeNotes', 'recentNotes', 'orphans'],
      additionalProperties: false
    }
  },
  {
    name: 'task-audit',
    title: 'Task Audit',
    description: 'Audit task-management usage across the vault, including missing due dates, hotspots, and project classification gaps.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Optional vault-relative directory to scan.' },
        hotspotThreshold: { type: 'integer', default: 20, minimum: 1, description: 'Minimum task count in one note to classify it as a hotspot.' }
      },
      additionalProperties: false
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        totalTasks: { type: 'integer', minimum: 0 },
        missingDueCount: { type: 'integer', minimum: 0 },
        missingDueTasks: { type: 'array' },
        hotspots: { type: 'array' },
        completionStyles: { type: 'array' },
        projectUnclassifiedNotes: { type: 'array', items: { type: 'string' } }
      },
      required: ['totalTasks', 'missingDueCount', 'missingDueTasks', 'hotspots', 'completionStyles', 'projectUnclassifiedNotes'],
      additionalProperties: false
    }
  },
  {
    name: 'daily-journal-audit',
    title: 'Daily Journal Audit',
    description: 'Audit daily, journal, and memo-style notes with heuristic entry points and migration candidates.',
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
        entryPoints: { type: 'array' },
        dailyReadyNotes: { type: 'array', items: { type: 'string' } },
        migrationCandidates: { type: 'array' }
      },
      required: ['entryPoints', 'dailyReadyNotes', 'migrationCandidates'],
      additionalProperties: false
    }
  },
  {
    name: 'propose-note-refactors',
    title: 'Propose Note Refactors',
    description: 'Proposal-only refactor mode that suggests move, rename, and linking actions without applying them.',
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
        mode: { type: 'string' },
        suggestionCount: { type: 'integer', minimum: 0 },
        suggestions: { type: 'array' }
      },
      required: ['mode', 'suggestionCount', 'suggestions'],
      additionalProperties: false
    }
  }
];
