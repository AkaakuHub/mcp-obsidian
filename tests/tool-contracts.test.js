import { beforeEach, describe, expect, it, vi } from 'vitest';
import Ajv from 'ajv';

vi.mock('../src/tools.js', () => ({
  searchVault: vi.fn(),
  searchByFilename: vi.fn(),
  listNotes: vi.fn(),
  readResolvedNote: vi.fn(),
  updateNote: vi.fn(),
  moveNote: vi.fn(),
  deleteNote: vi.fn()
}));

vi.mock('../src/analysis-tools.js', () => ({
  writeFrontmatter: vi.fn(),
  bulkUpdateFrontmatter: vi.fn(),
  extractTasks: vi.fn(),
  analyzeLinks: vi.fn(),
  moveMany: vi.fn()
}));

import { createToolHandlerMap } from '../src/tool-handler-map.js';
import { toolDefinitions } from '../src/toolDefinitions.js';
import * as tools from '../src/tools.js';
import * as analysisTools from '../src/analysis-tools.js';

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
    pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false },
    root: '',
    folderCount: 1,
    folders: [{ name: 'folder', path: 'folder', depth: 1, noteCount: 1, children: [] }],
    folderPaths: ['folder']
  },
  'read-note': {
    path: 'resolved/note.md',
    content: '# Note'
  },
  'update-note': {
    path: 'note.md',
    status: 'patched',
    previousContentLength: 34,
    newContentLength: 42,
    changeCount: 2
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
  }
};

const toolArgs = {
  'search-vault': { query: 'match' },
  'search-by-filename': { query: 'note.md' },
  'list-notes': {},
  'read-note': { path: 'note.md' },
  'update-note': { path: 'note.md', mode: 'patch', patches: [{ match: 'before', replace: 'after' }] },
  'move-note': { sourcePath: 'note.md', destinationPath: 'areas/note.md' },
  'delete-note': { path: 'note.md' },
  'write-frontmatter': { path: 'note.md', fields: { status: 'doing' } },
  'bulk-update-frontmatter': { fields: { area: 'work' } },
  'extract-tasks': {},
  'analyze-links': {},
  'move-many': { moves: [{ sourcePath: 'a.md', destinationPath: 'archive/a.md' }] }
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
    tools.updateNote.mockResolvedValue(outputSamples['update-note']);
    tools.moveNote.mockResolvedValue(outputSamples['move-note']);
    tools.deleteNote.mockResolvedValue('note.md');
    analysisTools.writeFrontmatter.mockResolvedValue(outputSamples['write-frontmatter']);
    analysisTools.bulkUpdateFrontmatter.mockResolvedValue(outputSamples['bulk-update-frontmatter']);
    analysisTools.extractTasks.mockResolvedValue(outputSamples['extract-tasks']);
    analysisTools.analyzeLinks.mockResolvedValue(outputSamples['analyze-links']);
    analysisTools.moveMany.mockResolvedValue(outputSamples['move-many']);
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
