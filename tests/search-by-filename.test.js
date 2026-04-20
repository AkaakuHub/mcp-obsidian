import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchByFilename } from '../src/tools.js';

vi.mock('fs/promises');
vi.mock('glob');

import { readFile, stat } from 'fs/promises';
import { glob } from 'glob';
import { clearSnapshotCache } from '../src/vault-cache.js';

describe('searchByFilename', () => {
  const mockVaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshotCache();
    stat.mockResolvedValue({
      size: 1024,
      birthtime: new Date('2026-01-01T00:00:00.000Z'),
      mtime: new Date('2026-01-02T00:00:00.000Z')
    });
  });

  it('finds notes by exact filename', async () => {
    glob.mockResolvedValue([
      '/test/vault/inbox/あったらいいもの.md',
      '/test/vault/other.md'
    ]);
    readFile
      .mockResolvedValueOnce('just content')
      .mockResolvedValueOnce('# Other');

    const result = await searchByFilename(mockVaultPath, 'あったらいいもの.md');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      file: 'inbox/あったらいいもの.md',
      filename: 'あったらいいもの.md',
      stem: 'あったらいいもの'
    });
  });

  it('finds notes by stem without extension', async () => {
    glob.mockResolvedValue(['/test/vault/inbox/あったらいいもの.md']);
    readFile.mockResolvedValue('content');

    const result = await searchByFilename(mockVaultPath, 'あったらいいもの');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].file).toBe('inbox/あったらいいもの.md');
  });

  it('finds notes by relative path fragment', async () => {
    glob.mockResolvedValue(['/test/vault/projects/ideas/alpha.md']);
    readFile.mockResolvedValue('# Alpha');

    const result = await searchByFilename(mockVaultPath, 'ideas/alpha');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].file).toBe('projects/ideas/alpha.md');
  });
});
