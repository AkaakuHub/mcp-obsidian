import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('glob');

import { readFile, stat, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { analyzeLinks, bulkUpdateFrontmatter, extractTasks, getVaultStructure, listNotesDetailed, previewNotes, readFrontmatter, writeFrontmatter } from '../src/analysis-tools.js';
import { clearSnapshotCache } from '../src/vault-cache.js';

describe('analysis tools', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshotCache();
    stat.mockResolvedValue({
      size: 1024,
      birthtime: new Date('2026-04-01T00:00:00Z'),
      mtime: new Date('2026-04-02T00:00:00Z')
    });
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
      '/test/vault/b.md',
      '/test/vault/c.md'
    ]);
    stat
      .mockResolvedValueOnce({ size: 10, birthtime: new Date('2026-04-01T00:00:00Z'), mtime: new Date('2026-04-02T00:00:00Z') })
      .mockResolvedValueOnce({ size: 20, birthtime: new Date('2026-04-03T00:00:00Z'), mtime: new Date('2026-04-04T00:00:00Z') })
      .mockResolvedValueOnce({ size: 30, birthtime: new Date('2026-04-05T00:00:00Z'), mtime: new Date('2026-04-06T00:00:00Z') });
    readFile
      .mockResolvedValueOnce('# A\n\n[[b]]')
      .mockResolvedValueOnce('# B\n\nBody')
      .mockResolvedValueOnce('# C\n\n[[a]]');

    const result = await listNotesDetailed(vaultPath, { sortBy: 'path', order: 'asc', limit: 2, offset: 0 });

    expect(result.notes[0]).toMatchObject({ path: 'a.md', linkCount: 1, backlinkCount: 1 });
    expect(result.notes[1]).toMatchObject({ path: 'b.md', backlinkCount: 1 });
    expect(result.pagination).toMatchObject({ total: 3, returned: 2, hasMore: true });
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

  it('should expose frontmatter parse errors on read', async () => {
    readFile.mockResolvedValue('---\ntags: [broken\n---\n# Task');

    const result = await readFrontmatter(vaultPath, 'task.md');

    expect(result.frontmatter).toEqual({});
    expect(result.parseError).toContain('Flow sequence');
  });

  it('should reject frontmatter writes when existing YAML is invalid', async () => {
    readFile.mockResolvedValue('---\ntags: [broken\n---\n# Task');

    await expect(writeFrontmatter(vaultPath, 'task.md', { status: 'doing' }, { dryRun: false }))
      .rejects
      .toThrow('Invalid frontmatter:');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should reject frontmatter mutations for oversized notes', async () => {
    stat.mockResolvedValue({
      size: 11 * 1024 * 1024,
      birthtime: new Date('2026-04-01T00:00:00Z'),
      mtime: new Date('2026-04-02T00:00:00Z')
    });

    await expect(writeFrontmatter(vaultPath, 'task.md', { status: 'doing' }, { dryRun: true }))
      .rejects
      .toThrow('File too large');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('should invalidate cached snapshots after frontmatter writes', async () => {
    glob.mockResolvedValue(['/test/vault/task.md']);
    stat.mockResolvedValue({ size: 20, birthtime: new Date('2026-04-01T00:00:00Z'), mtime: new Date('2026-04-02T00:00:00Z') });
    readFile
      .mockResolvedValueOnce('---\nstatus: "todo"\n---\n# Task')
      .mockResolvedValueOnce('---\nstatus: "todo"\n---\n# Task')
      .mockResolvedValueOnce('---\nstatus: "doing"\n---\n# Task');
    writeFile.mockResolvedValue();

    const before = await previewNotes(vaultPath, {});
    await writeFrontmatter(vaultPath, 'task.md', { status: 'doing' }, { dryRun: false });
    const after = await previewNotes(vaultPath, {});

    expect(before.notes[0].preview).toBe('# Task');
    expect(after.notes[0].preview).toBe('# Task');
    expect(glob).toHaveBeenCalledTimes(2);
  });

  it('should support bulk frontmatter updates', async () => {
    glob.mockResolvedValue(['/test/vault/a.md', '/test/vault/b.md']);
    readFile.mockResolvedValue('# Note');
    writeFile.mockResolvedValue();

    const result = await bulkUpdateFrontmatter(vaultPath, { directory: '', fields: { area: 'work' }, dryRun: true });

    expect(result.targetCount).toBe(2);
    expect(result.updatedCount).toBe(2);
    expect(result.validationFailed).toBe(false);
  });

  it('should avoid partial apply when bulk validation fails', async () => {
    glob.mockResolvedValue(['/test/vault/a.md', '/test/vault/b.md']);
    readFile
      .mockResolvedValueOnce('# A')
      .mockRejectedValueOnce(new Error('Permission denied'));
    writeFile.mockResolvedValue();

    const result = await bulkUpdateFrontmatter(vaultPath, { directory: '', fields: { area: 'work' }, dryRun: false });

    expect(result.applied).toBe(false);
    expect(result.validationFailed).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should roll back already written notes when bulk apply fails mid-flight', async () => {
    readFile
      .mockResolvedValueOnce('# A')
      .mockResolvedValueOnce('# B');
    writeFile
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Disk full'))
      .mockResolvedValueOnce();

    const result = await bulkUpdateFrontmatter(vaultPath, {
      paths: ['a.md', 'b.md'],
      fields: { area: 'work' },
      dryRun: false
    });

    expect(result.applied).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(writeFile).toHaveBeenCalledTimes(3);
  });

  it('should report rollback errors instead of throwing', async () => {
    readFile
      .mockResolvedValueOnce('# A')
      .mockResolvedValueOnce('# B');
    writeFile
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Disk full'))
      .mockRejectedValueOnce(new Error('Rollback failed'));

    const result = await bulkUpdateFrontmatter(vaultPath, {
      paths: ['a.md', 'b.md'],
      fields: { area: 'work' },
      dryRun: false
    });

    expect(result.applied).toBe(false);
    expect(result.rolledBack).toBe(false);
    expect(result.rollbackErrors).toEqual([{ path: 'a.md', error: 'Rollback failed' }]);
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
