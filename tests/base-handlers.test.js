import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOL_NAMES } from '../src/tool-names.js';

vi.mock('../src/tools.js', () => ({
  listNotes: vi.fn(),
  readNote: vi.fn(),
  readResolvedNote: vi.fn(),
  searchByFilename: vi.fn(),
  searchVault: vi.fn(),
  updateNote: vi.fn(),
  moveNote: vi.fn(),
  deleteNote: vi.fn()
}));

import { createBaseHandlers } from '../src/tool-handler-groups/base-handlers.js';
import { deleteNote, moveNote, readResolvedNote, searchVault, updateNote } from '../src/tools.js';

describe('base handlers', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(`returns structured content for ${TOOL_NAMES.READ_NOTE}`, async () => {
    readResolvedNote.mockResolvedValue({ path: 'resolved/note.md', content: '# Note' });
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers[TOOL_NAMES.READ_NOTE]({ path: 'note.md' }, Date.now(), TOOL_NAMES.READ_NOTE);

    expect(response.structuredContent).toEqual({
      path: 'resolved/note.md',
      content: '# Note'
    });
    expect(response.content[0].text).toContain('Read note resolved/note.md');
  });

  it(`returns structured content for ${TOOL_NAMES.UPDATE_NOTE}`, async () => {
    updateNote.mockResolvedValue({
      path: 'note.md',
      status: 'patched',
      previousContentLength: 10,
      newContentLength: 12,
      changeCount: 1
    });
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers[TOOL_NAMES.UPDATE_NOTE]({ path: 'note.md', mode: 'patch', patches: [{ match: 'a', replace: 'b' }] }, Date.now(), TOOL_NAMES.UPDATE_NOTE);

    expect(response.structuredContent).toEqual({
      path: 'note.md',
      status: 'patched',
      previousContentLength: 10,
      newContentLength: 12,
      changeCount: 1
    });
  });

  it(`returns structured content for ${TOOL_NAMES.DELETE_NOTE}`, async () => {
    deleteNote.mockResolvedValue('note.md');
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers[TOOL_NAMES.DELETE_NOTE]({ path: 'note.md' }, Date.now(), TOOL_NAMES.DELETE_NOTE);

    expect(response.structuredContent).toEqual({
      path: 'note.md',
      status: 'deleted'
    });
  });

  it(`returns structured content for ${TOOL_NAMES.MOVE_NOTE}`, async () => {
    moveNote.mockResolvedValue({ fromPath: 'inbox/note.md', path: 'areas/note.md', status: 'moved' });
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers[TOOL_NAMES.MOVE_NOTE]({ sourcePath: 'note.md', destinationPath: 'areas/note.md' }, Date.now(), TOOL_NAMES.MOVE_NOTE);

    expect(response.structuredContent).toEqual({
      fromPath: 'inbox/note.md',
      path: 'areas/note.md',
      status: 'moved'
    });
  });

  it('preserves full search context in structured content', async () => {
    searchVault.mockResolvedValue({
      files: [
        {
          path: 'note.md',
          matchCount: 1,
          matches: [
            {
              line: 3,
              content: 'match line',
              context: {
                lines: [
                  { number: 2, text: 'before', isMatch: false },
                  { number: 3, text: 'match line', isMatch: true },
                  { number: 4, text: 'after', isMatch: false }
                ],
                highlighted: '**match** line'
              }
            }
          ]
        }
      ],
      totalMatches: 1,
      fileCount: 1,
      filesSearched: 1,
      pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false }
    });
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers[TOOL_NAMES.SEARCH_VAULT]({ query: 'match', includeContext: true }, Date.now(), TOOL_NAMES.SEARCH_VAULT);

    expect(response.structuredContent.files[0].matches[0].context.lines).toHaveLength(3);
    expect(response.structuredContent.files[0].matches[0].context.highlighted).toBe('**match** line');
  });

  it(`passes includeFolders through ${TOOL_NAMES.LIST_NOTES}`, async () => {
    const { listNotes } = await import('../src/tools.js');
    listNotes.mockResolvedValue({
      notes: ['note.md'],
      count: 1,
      pagination: { total: 1, returned: 1, limit: 100, offset: 0, hasMore: false },
      root: '',
      folderCount: 1,
      folders: [{ name: 'folder', path: 'folder', depth: 1, noteCount: 1, children: [] }],
      folderPaths: ['folder']
    });
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers[TOOL_NAMES.LIST_NOTES]({ includeFolders: true }, Date.now(), TOOL_NAMES.LIST_NOTES);

    expect(listNotes).toHaveBeenCalledWith(vaultPath, undefined, 100, 0, true);
    expect(response.structuredContent.folderCount).toBe(1);
  });
});
