import { beforeEach, describe, expect, it, vi } from 'vitest';
import Ajv from 'ajv';

vi.mock('../src/tools.js', () => ({
  searchVault: vi.fn(),
  searchByTitle: vi.fn(),
  listNotes: vi.fn(),
  readResolvedNote: vi.fn(),
  writeNote: vi.fn(),
  deleteNote: vi.fn(),
  searchByTags: vi.fn(),
  getNoteMetadata: vi.fn(),
  discoverMocs: vi.fn()
}));

vi.mock('../src/analysis-tools.js', () => ({
  getVaultStructure: vi.fn(),
  listNotesDetailed: vi.fn(),
  previewNotes: vi.fn(),
  readFrontmatter: vi.fn(),
  writeFrontmatter: vi.fn(),
  bulkUpdateFrontmatter: vi.fn(),
  extractTasks: vi.fn(),
  analyzeLinks: vi.fn(),
  collectTaskStyles: vi.fn()
}));

vi.mock('../src/audits.js', () => ({
  detectDailyNotes: vi.fn(),
  detectSimilarNotes: vi.fn(),
  detectLargeNotes: vi.fn(),
  detectUnorganizedNotes: vi.fn(),
  buildVaultInventory: vi.fn(),
  auditTasks: vi.fn(),
  auditDailyJournal: vi.fn(),
  proposeNoteRefactors: vi.fn()
}));

import { createToolHandlerMap } from '../src/tool-handler-map.js';
import { toolDefinitions } from '../src/toolDefinitions.js';
import * as tools from '../src/tools.js';
import * as analysisTools from '../src/analysis-tools.js';
import * as audits from '../src/audits.js';

const ajv = new Ajv({ strict: false, allErrors: true });

const outputSamples = {
  'search-vault': {
    files: [{
      path: 'note.md',
      matchCount: 1,
      matches: [{
        line: 3,
        content: 'matched line',
        context: {
          lines: [
            { number: 2, text: 'before', isMatch: false },
            { number: 3, text: 'matched line', isMatch: true },
            { number: 4, text: 'after', isMatch: false }
          ],
          highlighted: '**matched** line'
        }
      }]
    }],
    totalMatches: 1,
    fileCount: 1,
    filesSearched: 1,
    pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false }
  },
  'search-by-title': {
    results: [{ file: 'note.md', title: 'Note', line: 1 }],
    count: 1,
    filesSearched: 1,
    pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false }
  },
  'list-notes': {
    notes: ['note.md'],
    count: 1,
    pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false }
  },
  'read-note': {
    path: 'resolved/note.md',
    content: '# Note'
  },
  'write-note': {
    path: 'note.md',
    status: 'written'
  },
  'delete-note': {
    path: 'note.md',
    status: 'deleted'
  },
  'search-by-tags': {
    notes: [{ path: 'note.md', tags: ['tag'] }],
    count: 1
  },
  'get-note-metadata': {
    path: 'note.md',
    frontmatter: { status: 'active' },
    frontmatterError: null,
    title: 'Note',
    titleLine: 1,
    hasContent: true,
    contentLength: 42,
    contentPreview: 'Preview',
    inlineTags: ['inline'],
    tags: ['tag', 'inline']
  },
  'discover-mocs': {
    mocs: [{
      path: 'MOC.md',
      title: 'MOC',
      tags: ['moc'],
      linkedNotes: ['topic-a'],
      linkCount: 1,
      linkedMocs: []
    }],
    count: 1
  },
  'get-vault-structure': {
    root: '',
    folderCount: 2,
    noteCount: 3,
    folders: [{ name: 'projects', path: 'projects', depth: 0, noteCount: 2, children: [] }]
  },
  'list-notes-detailed': {
    notes: [{
      path: 'note.md',
      title: 'Note',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      sizeBytes: 100,
      lineCount: 10,
      tags: ['tag'],
      linkCount: 1,
      backlinkCount: 2,
      taskCount: 1
    }],
    count: 1,
    errors: [],
    pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false }
  },
  'preview-notes': {
    notes: [{ path: 'note.md', title: 'Note', preview: '# Note\nBody' }],
    count: 1,
    errors: [],
    pagination: { total: 1, returned: 1, limit: 50, offset: 0, hasMore: false }
  },
  'read-frontmatter': {
    path: 'note.md',
    frontmatter: { status: 'active' },
    parseError: null
  },
  'write-frontmatter': {
    path: 'note.md',
    dryRun: true,
    written: false,
    changes: [{ key: 'status', before: 'todo', after: 'doing' }],
    before: { status: 'todo' },
    after: { status: 'doing' }
  },
  'bulk-update-frontmatter': {
    dryRun: true,
    applied: false,
    validationFailed: false,
    rolledBack: true,
    targetCount: 2,
    updatedCount: 2,
    errors: [],
    rollbackErrors: [],
    results: [{
      path: 'a.md',
      dryRun: true,
      written: false,
      changes: [{ key: 'area', before: null, after: 'work' }],
      before: {},
      after: { area: 'work' }
    }]
  },
  'extract-tasks': {
    tasks: [{ path: 'note.md', line: 3, text: 'todo', completed: false, due: null }],
    count: 1,
    total: 1,
    summaryByNote: [{ path: 'note.md', total: 1, open: 1, completed: 0, dueCount: 0 }],
    pagination: { total: 1, returned: 1, limit: 500, offset: 0, hasMore: false }
  },
  'analyze-links': {
    notes: [{
      path: 'note.md',
      outboundCount: 1,
      inboundCount: 0,
      outboundLinks: [{ target: 'other', resolvedPath: 'other.md' }],
      inboundLinks: [],
      isOrphan: false,
      isHub: false
    }],
    orphanCount: 0,
    hubCount: 0,
    orphans: [],
    hubs: []
  },
  'collect-task-styles': {
    variants: [{ path: 'note.md', line: 1, marker: 'x', raw: '- [x] done' }],
    count: 1
  },
  'detect-daily-notes': {
    notes: [{ path: 'Daily/2026-01-01.md', title: '2026-01-01', category: 'daily' }],
    count: 1
  },
  'detect-similar-notes': {
    pairs: [{ left: 'a.md', right: 'b.md', score: 0.8 }],
    count: 1
  },
  'detect-large-notes': {
    notes: [{ path: 'big.md', sizeBytes: 60000, lineCount: 900, taskCount: 3 }],
    count: 1
  },
  'detect-unorganized-notes': {
    notes: [{ path: 'note.md', reasons: ['missing-tags', 'root-level'] }],
    count: 1
  },
  'vault-inventory': {
    noteCount: 10,
    folderCount: 3,
    taskCount: 4,
    orphanCount: 2,
    topTags: [{ tag: 'work', count: 4 }],
    largeNotes: [{ path: 'big.md', sizeBytes: 60000, lineCount: 900 }],
    recentNotes: [{ path: 'note.md', updatedAt: '2026-01-02T00:00:00.000Z' }],
    orphans: ['orphan.md']
  },
  'task-audit': {
    totalTasks: 4,
    missingDueCount: 2,
    missingDueTasks: [{ path: 'tasks.md', completed: false, due: null, text: 'todo' }],
    hotspots: [{ path: 'tasks.md', taskCount: 10 }],
    completionStyles: [{ marker: 'x', count: 3 }],
    projectUnclassifiedNotes: ['tasks.md']
  },
  'daily-journal-audit': {
    entryPoints: [{ path: 'Daily/2026-01-01.md', category: 'daily', updatedAt: '2026-01-01T00:00:00.000Z', title: '2026-01-01' }],
    dailyReadyNotes: ['Daily/2026-01-01.md'],
    migrationCandidates: [{ path: 'memo.md', suggestedCategory: 'journal' }]
  },
  'propose-note-refactors': {
    mode: 'proposal-only',
    suggestionCount: 1,
    suggestions: [{ type: 'rename', path: 'old.md', proposedPath: 'new.md', reason: 'title-file-mismatch' }]
  }
};

const toolArgs = {
  'search-vault': { query: 'match' },
  'search-by-title': { query: 'note' },
  'list-notes': {},
  'read-note': { path: 'note.md' },
  'write-note': { path: 'note.md', content: '# Note' },
  'delete-note': { path: 'note.md' },
  'search-by-tags': { tags: ['tag'] },
  'get-note-metadata': { path: 'note.md' },
  'discover-mocs': {},
  'get-vault-structure': {},
  'list-notes-detailed': {},
  'preview-notes': {},
  'read-frontmatter': { path: 'note.md' },
  'write-frontmatter': { path: 'note.md', fields: { status: 'doing' } },
  'bulk-update-frontmatter': { fields: { area: 'work' } },
  'extract-tasks': {},
  'analyze-links': {},
  'collect-task-styles': {},
  'detect-daily-notes': {},
  'detect-similar-notes': {},
  'detect-large-notes': {},
  'detect-unorganized-notes': {},
  'vault-inventory': {},
  'task-audit': {},
  'daily-journal-audit': {},
  'propose-note-refactors': {}
};

describe('tool contracts', () => {
  const vaultPath = '/test/vault';
  const handlers = createToolHandlerMap(vaultPath);

  beforeEach(() => {
    vi.clearAllMocks();
    tools.searchVault.mockResolvedValue(outputSamples['search-vault']);
    tools.searchByTitle.mockResolvedValue(outputSamples['search-by-title']);
    tools.listNotes.mockResolvedValue(outputSamples['list-notes']);
    tools.readResolvedNote.mockResolvedValue(outputSamples['read-note']);
    tools.writeNote.mockResolvedValue('note.md');
    tools.deleteNote.mockResolvedValue('note.md');
    tools.searchByTags.mockResolvedValue(outputSamples['search-by-tags']);
    tools.getNoteMetadata.mockResolvedValue(outputSamples['get-note-metadata']);
    tools.discoverMocs.mockResolvedValue(outputSamples['discover-mocs']);

    analysisTools.getVaultStructure.mockResolvedValue(outputSamples['get-vault-structure']);
    analysisTools.listNotesDetailed.mockResolvedValue(outputSamples['list-notes-detailed']);
    analysisTools.previewNotes.mockResolvedValue(outputSamples['preview-notes']);
    analysisTools.readFrontmatter.mockResolvedValue(outputSamples['read-frontmatter']);
    analysisTools.writeFrontmatter.mockResolvedValue(outputSamples['write-frontmatter']);
    analysisTools.bulkUpdateFrontmatter.mockResolvedValue(outputSamples['bulk-update-frontmatter']);
    analysisTools.extractTasks.mockResolvedValue(outputSamples['extract-tasks']);
    analysisTools.analyzeLinks.mockResolvedValue(outputSamples['analyze-links']);
    analysisTools.collectTaskStyles.mockResolvedValue(outputSamples['collect-task-styles']);

    audits.detectDailyNotes.mockResolvedValue(outputSamples['detect-daily-notes']);
    audits.detectSimilarNotes.mockResolvedValue(outputSamples['detect-similar-notes']);
    audits.detectLargeNotes.mockResolvedValue(outputSamples['detect-large-notes']);
    audits.detectUnorganizedNotes.mockResolvedValue(outputSamples['detect-unorganized-notes']);
    audits.buildVaultInventory.mockResolvedValue(outputSamples['vault-inventory']);
    audits.auditTasks.mockResolvedValue(outputSamples['task-audit']);
    audits.auditDailyJournal.mockResolvedValue(outputSamples['daily-journal-audit']);
    audits.proposeNoteRefactors.mockResolvedValue(outputSamples['propose-note-refactors']);
  });

  for (const toolDefinition of toolDefinitions) {
    it(`${toolDefinition.name} structuredContent conforms to outputSchema`, async () => {
      const validate = ajv.compile(toolDefinition.outputSchema);
      const response = await handlers[toolDefinition.name](toolArgs[toolDefinition.name], Date.now(), toolDefinition.name);
      const valid = validate(response.structuredContent);

      expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
    });
  }
});
