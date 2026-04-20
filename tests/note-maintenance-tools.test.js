import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/note-io-tools.js', () => ({
  readResolvedNote: vi.fn(),
  writeNote: vi.fn(),
  deleteNote: vi.fn()
}));

vi.mock('../src/vault-analysis.js', () => ({
  getVaultSnapshot: vi.fn(),
  buildLinkGraph: vi.fn()
}));

import { appendToNote, deleteNoteSafe } from '../src/note-maintenance-tools.js';
import { deleteNote, readResolvedNote, writeNote } from '../src/note-io-tools.js';
import { buildLinkGraph, getVaultSnapshot } from '../src/vault-analysis.js';

describe('note maintenance tools', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('appendToNote', () => {
    it('appends content with the default separator', async () => {
      readResolvedNote.mockResolvedValue({ path: 'daily.md', content: '# Daily' });
      writeNote.mockResolvedValue('daily.md');

      const result = await appendToNote(vaultPath, 'daily.md', '- [ ] todo');

      expect(writeNote).toHaveBeenCalledWith(vaultPath, 'daily.md', '# Daily\n\n- [ ] todo');
      expect(result).toEqual({
        path: 'daily.md',
        status: 'appended',
        appendedLength: 10,
        newContentLength: 19
      });
    });

    it('appends without adding a separator to an empty note', async () => {
      readResolvedNote.mockResolvedValue({ path: 'inbox.md', content: '' });
      writeNote.mockResolvedValue('inbox.md');

      await appendToNote(vaultPath, 'inbox.md', 'hello');

      expect(writeNote).toHaveBeenCalledWith(vaultPath, 'inbox.md', 'hello');
    });
  });

  describe('deleteNoteSafe', () => {
    it('returns a dry-run preview by default', async () => {
      getVaultSnapshot.mockResolvedValue({
        notes: [{ path: 'note.md', name: 'note.md', stem: 'note' }]
      });
      buildLinkGraph.mockReturnValue({
        nodes: [{
          path: 'note.md',
          inboundCount: 1,
          inboundLinks: [{ path: 'ref.md', target: 'note' }],
          outboundCount: 0,
          outboundLinks: []
        }]
      });

      const result = await deleteNoteSafe(vaultPath, 'note.md');

      expect(deleteNote).not.toHaveBeenCalled();
      expect(result).toEqual({
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
      });
    });

    it('blocks deletion when backlinks exist and force is false', async () => {
      getVaultSnapshot.mockResolvedValue({
        notes: [{ path: 'note.md', name: 'note.md', stem: 'note' }]
      });
      buildLinkGraph.mockReturnValue({
        nodes: [{
          path: 'note.md',
          inboundCount: 2,
          inboundLinks: [{ path: 'ref.md', target: 'note' }],
          outboundCount: 1,
          outboundLinks: [{ target: 'other', resolvedPath: 'other.md' }]
        }]
      });

      const result = await deleteNoteSafe(vaultPath, 'note.md', { dryRun: false });

      expect(deleteNote).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.deleted).toBe(false);
    });

    it('deletes when dryRun is false and backlinks are absent', async () => {
      getVaultSnapshot.mockResolvedValue({
        notes: [{ path: 'note.md', name: 'note.md', stem: 'note' }]
      });
      buildLinkGraph.mockReturnValue({
        nodes: [{
          path: 'note.md',
          inboundCount: 0,
          inboundLinks: [],
          outboundCount: 1,
          outboundLinks: [{ target: 'other', resolvedPath: 'other.md' }]
        }]
      });
      deleteNote.mockResolvedValue('note.md');

      const result = await deleteNoteSafe(vaultPath, 'note.md', { dryRun: false });

      expect(deleteNote).toHaveBeenCalledWith(vaultPath, 'note.md');
      expect(result.deleted).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.dryRun).toBe(false);
    });
  });
});
