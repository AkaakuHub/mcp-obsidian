import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/tools.js', () => ({
  discoverMocs: vi.fn(),
  getNoteMetadata: vi.fn(),
  listNotes: vi.fn(),
  readNote: vi.fn(),
  readResolvedNote: vi.fn(),
  searchByFilename: vi.fn(),
  searchByTags: vi.fn(),
  searchByTitle: vi.fn(),
  searchVault: vi.fn(),
  writeNote: vi.fn(),
  moveNote: vi.fn(),
  deleteNote: vi.fn()
}));

import { createBaseHandlers } from '../src/tool-handler-groups/base-handlers.js';
import { deleteNote, moveNote, readResolvedNote, searchVault, writeNote } from '../src/tools.js';

describe('base handlers', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns structured content for read-note', async () => {
    readResolvedNote.mockResolvedValue({ path: 'resolved/note.md', content: '# Note' });
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers['read-note']({ path: 'note.md' }, Date.now(), 'read-note');

    expect(response.structuredContent).toEqual({
      path: 'resolved/note.md',
      content: '# Note'
    });
    expect(response.content[0].text).toContain('Read note resolved/note.md');
  });

  it('returns structured content for write-note', async () => {
    writeNote.mockResolvedValue('note.md');
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers['write-note']({ path: 'note.md', content: '# Note' }, Date.now(), 'write-note');

    expect(response.structuredContent).toEqual({
      path: 'note.md',
      status: 'written'
    });
  });

  it('returns structured content for delete-note', async () => {
    deleteNote.mockResolvedValue('note.md');
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers['delete-note']({ path: 'note.md' }, Date.now(), 'delete-note');

    expect(response.structuredContent).toEqual({
      path: 'note.md',
      status: 'deleted'
    });
  });

  it('returns structured content for move-note', async () => {
    moveNote.mockResolvedValue({ fromPath: 'inbox/note.md', path: 'areas/note.md', status: 'moved' });
    const handlers = createBaseHandlers(vaultPath);

    const response = await handlers['move-note']({ sourcePath: 'note.md', destinationPath: 'areas/note.md' }, Date.now(), 'move-note');

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

    const response = await handlers['search-vault']({ query: 'match', includeContext: true }, Date.now(), 'search-vault');

    expect(response.structuredContent.files[0].matches[0].context.lines).toHaveLength(3);
    expect(response.structuredContent.files[0].matches[0].context.highlighted).toBe('**match** line');
  });
});
