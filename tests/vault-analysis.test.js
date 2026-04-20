import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('glob');

import { readFile, stat } from 'fs/promises';
import { glob } from 'glob';
import { clearSnapshotCache } from '../src/vault-cache.js';
import { getVaultSnapshot, scanVaultNotes } from '../src/vault-analysis.js';

describe('vault analysis snapshot', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshotCache();
  });

  it('should cache snapshots for identical scan options', async () => {
    glob.mockResolvedValue(['/test/vault/a.md', '/test/vault/b.md']);
    stat.mockResolvedValue({ size: 20, birthtime: new Date('2026-01-01T00:00:00.000Z'), mtime: new Date('2026-01-02T00:00:00.000Z') });
    readFile.mockImplementation(async (file) => `# ${file.endsWith('/a.md') ? 'A' : 'B'}`);

    const first = await getVaultSnapshot(vaultPath, { directory: null });
    const second = await getVaultSnapshot(vaultPath, { directory: null });

    expect(first.notes).toHaveLength(2);
    expect(second.notes).toHaveLength(2);
    expect(glob).toHaveBeenCalledTimes(1);
    expect(stat).toHaveBeenCalledTimes(2);
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it('should paginate from cached snapshots without rescanning', async () => {
    glob.mockResolvedValue([
      '/test/vault/a.md',
      '/test/vault/b.md',
      '/test/vault/c.md'
    ]);
    stat.mockResolvedValue({ size: 20, birthtime: new Date('2026-01-01T00:00:00.000Z'), mtime: new Date('2026-01-02T00:00:00.000Z') });
    readFile.mockImplementation(async (file) => `# ${file.split('/').pop().replace('.md', '').toUpperCase()}`);

    const pageOne = await scanVaultNotes(vaultPath, { limit: 2, offset: 0 });
    const pageTwo = await scanVaultNotes(vaultPath, { limit: 2, offset: 2 });

    expect(pageOne.notes.map((note) => note.path)).toEqual(['a.md', 'b.md']);
    expect(pageTwo.notes.map((note) => note.path)).toEqual(['c.md']);
    expect(glob).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledTimes(3);
  });

  it('should reuse the same snapshot across different preview line requests', async () => {
    glob.mockResolvedValue(['/test/vault/a.md']);
    stat.mockResolvedValue({ size: 20, birthtime: new Date('2026-01-01T00:00:00.000Z'), mtime: new Date('2026-01-02T00:00:00.000Z') });
    readFile.mockResolvedValue('# A\n\nline1\nline2');

    const first = await getVaultSnapshot(vaultPath, { includeContent: true, previewLines: 2 });
    const second = await getVaultSnapshot(vaultPath, { includeContent: true, previewLines: 10 });

    expect(first.notes[0].content).toContain('line1');
    expect(second.notes[0].content).toContain('line2');
    expect(glob).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledTimes(1);
  });
});
