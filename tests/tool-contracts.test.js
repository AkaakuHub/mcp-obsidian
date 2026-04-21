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
  moveMany: vi.fn(),
  listTags: vi.fn(),
  writeTags: vi.fn(),
  bulkDeleteNote: vi.fn()
}));

import { createToolHandlerMap } from '../src/tool-handler-map.js';
import { toolDefinitions } from '../src/toolDefinitions.js';
import { TOOL_NAMES } from '../src/tool-names.js';
import * as tools from '../src/tools.js';
import * as analysisTools from '../src/analysis-tools.js';

const ajv = new Ajv({ strict: false, allErrors: true });

const outputSamples = {
  [TOOL_NAMES.SEARCH_VAULT]: {
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
  [TOOL_NAMES.SEARCH_BY_FILENAME]: {
    results: [{ file: 'folder/note.md', filename: 'note.md', stem: 'note', title: 'Note' }],
    count: 1,
    filesSearched: 1,
    pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false }
  },
  [TOOL_NAMES.LIST_NOTES]: {
    notes: ['note.md'],
    count: 1,
    pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false },
    root: '',
    folderCount: 1,
    folders: [{ name: 'folder', path: 'folder', depth: 1, noteCount: 1, children: [] }],
    folderPaths: ['folder']
  },
  [TOOL_NAMES.READ_NOTE]: {
    path: 'resolved/note.md',
    content: '# Note'
  },
  [TOOL_NAMES.UPDATE_NOTE]: {
    path: 'note.md',
    status: 'patched',
    previousContentLength: 34,
    newContentLength: 42,
    changeCount: 2
  },
  [TOOL_NAMES.MOVE_NOTE]: {
    fromPath: 'inbox/note.md',
    path: 'areas/note.md',
    status: 'moved'
  },
  [TOOL_NAMES.DELETE_NOTE]: {
    path: 'note.md',
    status: 'deleted'
  },
  [TOOL_NAMES.WRITE_FRONTMATTER]: {
    path: 'note.md',
    dryRun: true,
    written: false,
    changes: [{ key: 'status', before: 'todo', after: 'doing' }],
    before: { status: 'todo' },
    after: { status: 'doing' }
  },
  [TOOL_NAMES.BULK_WRITE_FRONTMATTER]: {
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
  [TOOL_NAMES.EXTRACT_TASKS]: {
    tasks: [{ path: 'note.md', line: 3, text: 'todo', completed: false, due: null }],
    count: 1,
    total: 1,
    summaryByNote: [{ path: 'note.md', total: 1, open: 1, completed: 0, dueCount: 0 }],
    pagination: { total: 1, returned: 1, limit: 500, offset: 0, hasMore: false }
  },
  [TOOL_NAMES.BULK_MOVE_NOTE]: {
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
  [TOOL_NAMES.LIST_TAGS]: {
    tags: [{ tag: 'project', count: 2, notes: ['a.md', 'b.md'] }],
    count: 1,
    noteCount: 2
  },
  [TOOL_NAMES.WRITE_TAGS]: {
    path: 'note.md',
    dryRun: true,
    written: false,
    mode: 'add',
    beforeFrontmatterTags: ['project'],
    afterFrontmatterTags: ['project', 'urgent'],
    inlineTagsDetected: ['inline'],
    addedTags: ['urgent'],
    removedTags: [],
    changes: [{ key: 'tags', before: ['project'], after: ['project', 'urgent'] }]
  },
  [TOOL_NAMES.BULK_DELETE_NOTE]: {
    dryRun: true,
    applied: false,
    validationFailed: false,
    targetCount: 1,
    deletedCount: 0,
    deletedAssetCount: 0,
    errors: [],
      results: [{ path: 'a.md', status: 'planned', assetPaths: ['assets/a.png'], errors: [] }]
  }
};

const toolArgs = {
  [TOOL_NAMES.SEARCH_VAULT]: { query: 'match' },
  [TOOL_NAMES.SEARCH_BY_FILENAME]: { query: 'note.md' },
  [TOOL_NAMES.LIST_NOTES]: {},
  [TOOL_NAMES.READ_NOTE]: { path: 'note.md' },
  [TOOL_NAMES.UPDATE_NOTE]: { path: 'note.md', mode: 'patch', patches: [{ match: 'before', replace: 'after' }] },
  [TOOL_NAMES.MOVE_NOTE]: { sourcePath: 'note.md', destinationPath: 'areas/note.md' },
  [TOOL_NAMES.DELETE_NOTE]: { path: 'note.md' },
  [TOOL_NAMES.WRITE_FRONTMATTER]: { path: 'note.md', fields: { status: 'doing' } },
  [TOOL_NAMES.BULK_WRITE_FRONTMATTER]: { fields: { area: 'work' } },
  [TOOL_NAMES.EXTRACT_TASKS]: {},
  [TOOL_NAMES.BULK_MOVE_NOTE]: { moves: [{ sourcePath: 'a.md', destinationPath: 'archive/a.md' }] },
  [TOOL_NAMES.LIST_TAGS]: {},
  [TOOL_NAMES.WRITE_TAGS]: { path: 'note.md', tags: ['urgent'], mode: 'add' },
  [TOOL_NAMES.BULK_DELETE_NOTE]: { paths: ['a.md'], dryRun: true }
};

describe('tool contracts', () => {
  const vaultPath = '/test/vault';
  const handlers = createToolHandlerMap(vaultPath);

  beforeEach(() => {
    vi.clearAllMocks();
    tools.searchVault.mockResolvedValue(outputSamples[TOOL_NAMES.SEARCH_VAULT]);
    tools.searchByFilename.mockResolvedValue(outputSamples[TOOL_NAMES.SEARCH_BY_FILENAME]);
    tools.listNotes.mockResolvedValue(outputSamples[TOOL_NAMES.LIST_NOTES]);
    tools.readResolvedNote.mockResolvedValue(outputSamples[TOOL_NAMES.READ_NOTE]);
    tools.updateNote.mockResolvedValue(outputSamples[TOOL_NAMES.UPDATE_NOTE]);
    tools.moveNote.mockResolvedValue(outputSamples[TOOL_NAMES.MOVE_NOTE]);
    tools.deleteNote.mockResolvedValue('note.md');
    analysisTools.writeFrontmatter.mockResolvedValue(outputSamples[TOOL_NAMES.WRITE_FRONTMATTER]);
    analysisTools.bulkUpdateFrontmatter.mockResolvedValue(outputSamples[TOOL_NAMES.BULK_WRITE_FRONTMATTER]);
    analysisTools.extractTasks.mockResolvedValue(outputSamples[TOOL_NAMES.EXTRACT_TASKS]);
    analysisTools.moveMany.mockResolvedValue(outputSamples[TOOL_NAMES.BULK_MOVE_NOTE]);
    analysisTools.listTags.mockResolvedValue(outputSamples[TOOL_NAMES.LIST_TAGS]);
    analysisTools.writeTags.mockResolvedValue(outputSamples[TOOL_NAMES.WRITE_TAGS]);
    analysisTools.bulkDeleteNote.mockResolvedValue(outputSamples[TOOL_NAMES.BULK_DELETE_NOTE]);
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
