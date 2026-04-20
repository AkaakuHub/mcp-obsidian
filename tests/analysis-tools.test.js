import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('glob');

import { readFile, stat, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { analyzeLinks, bulkUpdateFrontmatter, extractTasks, getVaultStructure, listNotesDetailed, previewNotes, writeFrontmatter } from '../src/analysis-tools.js';
import { clearSnapshotCache } from '../src/vault-cache.js';

describe('analysis tools', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshotCache();
  });

  it('should build folder hierarchy', async () => {
    glob.mockResolvedValue([
      '/test/vault/projects/a.md',
      '/test/vault/projects/nested/b.md',
      '/test/vault/journal/2026-04-20.md'
    ]);
    stat.mockResolvedValue({ size: 10, birthtime: new Date('2026-04-01T00:00:00Z'), mtime: new Date('2026-04-02T00:00:00Z') });
    readFile.mockResolvedValue('# Note');

    const result = await getVaultStructure(vaultPath);

    expect(result.noteCount).toBe(3);
    expect(result.folders).toEqual([
      expect.objectContaining({ path: 'journal', noteCount: 1 }),
      expect.objectContaining({ path: 'projects', noteCount: 2 })
    ]);
  });

  it('should list note details including backlinks', async () => {
    glob.mockResolvedValue([
      '/test/vault/a.md',
      '/test/vault/b.md'
    ]);
    stat
      .mockResolvedValueOnce({ size: 10, birthtime: new Date('2026-04-01T00:00:00Z'), mtime: new Date('2026-04-02T00:00:00Z') })
      .mockResolvedValueOnce({ size: 20, birthtime: new Date('2026-04-03T00:00:00Z'), mtime: new Date('2026-04-04T00:00:00Z') });
    readFile
      .mockResolvedValueOnce('# A\n\n[[b]]')
      .mockResolvedValueOnce('# B\n\nBody');

    const result = await listNotesDetailed(vaultPath, { sortBy: 'path', order: 'asc' });

    expect(result.notes[0]).toMatchObject({ path: 'a.md', linkCount: 1, backlinkCount: 0 });
    expect(result.notes[1]).toMatchObject({ path: 'b.md', backlinkCount: 1 });
  });

  it('should preview multiple notes', async () => {
    glob.mockResolvedValue(['/test/vault/a.md']);
    stat.mockResolvedValue({ size: 10, birthtime: new Date('2026-04-01T00:00:00Z'), mtime: new Date('2026-04-02T00:00:00Z') });
    readFile.mockResolvedValue('---\nstatus: active\n---\n# A\n\nline1\nline2');

    const result = await previewNotes(vaultPath, { previewLines: 2 });

    expect(result.notes[0].preview).toBe('# A');
  });

  it('should dry-run and apply frontmatter updates', async () => {
    readFile.mockResolvedValue('---\nstatus: "todo"\n---\n# Task');
    writeFile.mockResolvedValue();

    const dryRun = await writeFrontmatter(vaultPath, 'task.md', { status: 'doing' }, { dryRun: true });
    const applied = await writeFrontmatter(vaultPath, 'task.md', { status: 'doing' }, { dryRun: false });

    expect(dryRun.written).toBe(false);
    expect(applied.written).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('should support bulk frontmatter updates', async () => {
    glob.mockResolvedValue(['/test/vault/a.md', '/test/vault/b.md']);
    readFile.mockResolvedValue('# Note');
    writeFile.mockResolvedValue();

    const result = await bulkUpdateFrontmatter(vaultPath, { directory: '', fields: { area: 'work' }, dryRun: true });

    expect(result.targetCount).toBe(2);
    expect(result.updatedCount).toBe(2);
  });

  it('should extract tasks and analyze link graph', async () => {
    glob.mockResolvedValue([
      '/test/vault/a.md',
      '/test/vault/b.md'
    ]);
    stat.mockResolvedValue({ size: 10, birthtime: new Date('2026-04-01T00:00:00Z'), mtime: new Date('2026-04-02T00:00:00Z') });
    readFile.mockImplementation(async (file) => {
      if (file.endsWith('/a.md')) {
        return '- [ ] task due:: 2026-05-01\n[[b]]';
      }
      return '# B';
    });

    const tasks = await extractTasks(vaultPath, {});
    const links = await analyzeLinks(vaultPath, {});

    expect(tasks.total).toBe(1);
    expect(links.orphans).toEqual([]);
    expect(links.notes.find((note) => note.path === 'b.md').inboundCount).toBe(1);
  });
});
