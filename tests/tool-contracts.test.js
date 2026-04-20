import { beforeEach, describe, expect, it, vi } from 'vitest';
import Ajv from 'ajv';

vi.mock('../src/tools.js', () => ({
  searchVault: vi.fn(),
  searchByFilename: vi.fn(),
  listNotes: vi.fn(),
  readResolvedNote: vi.fn(),
  writeNote: vi.fn(),
  appendToNote: vi.fn(),
  moveNote: vi.fn(),
  deleteNote: vi.fn(),
  deleteNoteSafe: vi.fn(),
  searchByTags: vi.fn()
}));

vi.mock('../src/analysis-tools.js', () => ({
  listNotesDetailed: vi.fn(),
  listFolders: vi.fn(),
  writeFrontmatter: vi.fn(),
  bulkUpdateFrontmatter: vi.fn(),
  extractTasks: vi.fn(),
  analyzeLinks: vi.fn(),
  previewMoveImpact: vi.fn(),
  moveMany: vi.fn()
}));

vi.mock('../src/audits.js', () => ({
  buildVaultInventory: vi.fn(),
  auditTasks: vi.fn()
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
  'search-by-filename': {
    results: [{ file: 'folder/note.md', filename: 'note.md', stem: 'note', title: 'Note' }],
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
  'append-to-note': {
    path: 'note.md',
    status: 'appended',
    appendedLength: 8,
    newContentLength: 42
  },
  'move-note': {
    fromPath: 'inbox/note.md',
    path: 'areas/note.md',
    status: 'moved'
  },
  'delete-note': {
    path: 'note.md',
    status: 'deleted'
  },
  'delete-note-safe': {
    path: 'note.md',
    requestedPath: 'note.md',
    dryRun: true,
    force: false,
    blocked: true,
    deleted: false,
    inboundLinkCount: 1,
    inboundLinks: [{ path: 'ref.md', target: 'note' }],
    outboundLinkCount: 0,
    outboundLinks: []
  },
  'search-by-tags': {
    notes: [{ path: 'note.md', tags: ['tag'] }],
    count: 1
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
  'list-folders': {
    root: '',
    folderCount: 2,
    folders: [{ name: 'folder', path: 'folder', depth: 1, noteCount: 1, children: [] }],
    paths: ['folder', 'folder/sub']
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
  'preview-move-impact': {
    sourcePath: 'note.md',
    resolvedSourcePath: 'notes/note.md',
    destinationPath: 'archive/note.md',
    renameDetected: false,
    inboundLinkCount: 2,
    affectedLinkCount: 1,
    affectedLinks: [{ path: 'ref.md', target: 'notes/note', futureResolvedPath: null, willBreak: true }],
    sourceOutboundLinks: [{ target: 'other', resolvedPath: 'other.md' }]
  },
  'move-many': {
    dryRun: true,
    applied: false,
    validationFailed: false,
    rolledBack: false,
    moveCount: 2,
    movedCount: 0,
    errors: [],
    rollbackErrors: [],
    results: [{ sourcePath: 'a.md', destinationPath: 'archive/a.md', resolvedSourcePath: 'a.md', status: 'planned', errors: [] }]
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
  }
};

const toolArgs = {
  'search-vault': { query: 'match' },
  'search-by-filename': { query: 'note.md' },
  'list-notes': {},
  'read-note': { path: 'note.md' },
  'write-note': { path: 'note.md', content: '# Note' },
  'append-to-note': { path: 'note.md', content: '\n- [ ] todo' },
  'move-note': { sourcePath: 'note.md', destinationPath: 'areas/note.md' },
  'delete-note': { path: 'note.md' },
  'delete-note-safe': { path: 'note.md' },
  'search-by-tags': { tags: ['tag'] },
  'list-notes-detailed': {},
  'list-folders': {},
  'write-frontmatter': { path: 'note.md', fields: { status: 'doing' } },
  'bulk-update-frontmatter': { fields: { area: 'work' } },
  'extract-tasks': {},
  'analyze-links': {},
  'preview-move-impact': { sourcePath: 'note.md', destinationPath: 'archive/note.md' },
  'move-many': { moves: [{ sourcePath: 'a.md', destinationPath: 'archive/a.md' }] },
  'vault-inventory': {},
  'task-audit': {}
};

describe('tool contracts', () => {
  const vaultPath = '/test/vault';
  const handlers = createToolHandlerMap(vaultPath);

  beforeEach(() => {
    vi.clearAllMocks();
    tools.searchVault.mockResolvedValue(outputSamples['search-vault']);
    tools.searchByFilename.mockResolvedValue(outputSamples['search-by-filename']);
    tools.listNotes.mockResolvedValue(outputSamples['list-notes']);
    tools.readResolvedNote.mockResolvedValue(outputSamples['read-note']);
    tools.writeNote.mockResolvedValue('note.md');
    tools.appendToNote.mockResolvedValue(outputSamples['append-to-note']);
    tools.moveNote.mockResolvedValue(outputSamples['move-note']);
    tools.deleteNote.mockResolvedValue('note.md');
    tools.deleteNoteSafe.mockResolvedValue(outputSamples['delete-note-safe']);
    tools.searchByTags.mockResolvedValue(outputSamples['search-by-tags']);

    analysisTools.listNotesDetailed.mockResolvedValue(outputSamples['list-notes-detailed']);
    analysisTools.listFolders.mockResolvedValue(outputSamples['list-folders']);
    analysisTools.writeFrontmatter.mockResolvedValue(outputSamples['write-frontmatter']);
    analysisTools.bulkUpdateFrontmatter.mockResolvedValue(outputSamples['bulk-update-frontmatter']);
    analysisTools.extractTasks.mockResolvedValue(outputSamples['extract-tasks']);
    analysisTools.analyzeLinks.mockResolvedValue(outputSamples['analyze-links']);
    analysisTools.previewMoveImpact.mockResolvedValue(outputSamples['preview-move-impact']);
    analysisTools.moveMany.mockResolvedValue(outputSamples['move-many']);

    audits.buildVaultInventory.mockResolvedValue(outputSamples['vault-inventory']);
    audits.auditTasks.mockResolvedValue(outputSamples['task-audit']);
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
