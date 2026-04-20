export const auditToolDefinitions = [
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
  }
];
