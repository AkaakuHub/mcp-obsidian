import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('glob');
vi.mock('../src/note-io-tools.js', () => ({
  moveNote: vi.fn()
}));

import { readFile, stat } from 'fs/promises';
import { glob } from 'glob';
import { moveNote } from '../src/note-io-tools.js';
import { clearSnapshotCache } from '../src/vault-cache.js';
import {
  listFolders,
  listNotesFull,
  moveMany,
  previewMoveImpact
} from '../src/reorganization-tools.js';

describe('reorganization tools', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshotCache();
    glob.mockResolvedValue([
      '/test/vault/folder/source.md',
      '/test/vault/inbox/ref.md',
      '/test/vault/inbox/stem-ref.md',
      '/test/vault/ref-broken.md'
    ]);
    stat.mockResolvedValue({
      size: 100,
      birthtime: new Date('2026-01-01T00:00:00.000Z'),
      mtime: new Date('2026-01-02T00:00:00.000Z')
    });
    readFile.mockImplementation(async (filePath) => {
      if (filePath.endsWith('/folder/source.md')) {
        return '# Source\n[[other]]';
      }
      if (filePath.endsWith('/inbox/ref.md')) {
        return '# Ref\n[[folder/source]]';
      }
      if (filePath.endsWith('/inbox/stem-ref.md')) {
        return '# Stem Ref\n[[source]]';
      }
      if (filePath.endsWith('/ref-broken.md')) {
        return '# Broken\n[[missing-note]]';
      }
      return '# Note';
    });
  });

  it('lists every note path without pagination', async () => {
    const result = await listNotesFull(vaultPath);

    expect(result.notes).toEqual([
      'folder/source.md',
      'inbox/ref.md',
      'inbox/stem-ref.md',
      'ref-broken.md'
    ]);
    expect(result.count).toBe(4);
  });

  it('lists folders as tree and flattened paths', async () => {
    const result = await listFolders(vaultPath);

    expect(result.folderCount).toBe(2);
    expect(result.paths).toEqual(['folder', 'inbox']);
    expect(result.folders[0].path).toBe('folder');
  });

  it('previews backlinks that would break after moving a note', async () => {
    const result = await previewMoveImpact(vaultPath, {
      sourcePath: 'source.md',
      destinationPath: 'archive/source.md'
    });

    expect(result.resolvedSourcePath).toBe('folder/source.md');
    expect(result.affectedLinkCount).toBe(1);
    expect(result.affectedLinks).toEqual([
      {
        path: 'inbox/ref.md',
        target: 'folder/source',
        futureResolvedPath: null,
        willBreak: true
      }
    ]);
  });

  it('validates batch moves in dry-run mode', async () => {
    const result = await moveMany(vaultPath, {
      moves: [
        { sourcePath: 'source.md', destinationPath: 'archive/source.md' },
        { sourcePath: 'missing.md', destinationPath: 'archive/missing.md' }
      ],
      dryRun: true
    });

    expect(result.validationFailed).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourcePath: 'missing.md' })
      ])
    );
  });

  it('rejects an empty batch move request', async () => {
    await expect(moveMany(vaultPath, { moves: [] }))
      .rejects.toThrow('moves must contain at least one move specification');
  });

  it('applies validated batch moves', async () => {
    moveNote
      .mockResolvedValueOnce({ fromPath: 'folder/source.md', path: 'archive/source.md', status: 'moved' })
      .mockResolvedValueOnce({ fromPath: 'inbox/ref.md', path: 'archive/ref.md', status: 'moved' });

    const result = await moveMany(vaultPath, {
      moves: [
        { sourcePath: 'source.md', destinationPath: 'archive/source.md' },
        { sourcePath: 'ref.md', destinationPath: 'archive/ref.md' }
      ],
      dryRun: false
    });

    expect(result.applied).toBe(true);
    expect(result.movedCount).toBe(2);
    expect(moveNote).toHaveBeenCalledTimes(2);
  });

  it('rolls back completed moves after a failure', async () => {
    moveNote
      .mockResolvedValueOnce({ fromPath: 'folder/source.md', path: 'archive/source.md', status: 'moved' })
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce({ fromPath: 'archive/source.md', path: 'folder/source.md', status: 'moved' });

    const result = await moveMany(vaultPath, {
      moves: [
        { sourcePath: 'source.md', destinationPath: 'archive/source.md' },
        { sourcePath: 'ref.md', destinationPath: 'archive/ref.md' }
      ],
      dryRun: false
    });

    expect(result.applied).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(moveNote).toHaveBeenNthCalledWith(3, vaultPath, 'archive/source.md', 'folder/source.md', true);
  });
});
