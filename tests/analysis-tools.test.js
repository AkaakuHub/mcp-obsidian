import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('glob');

import { readFile, stat, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { analyzeLinks, bulkUpdateFrontmatter, extractTasks, writeFrontmatter } from '../src/analysis-tools.js';
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

  it('should dry-run and apply frontmatter updates', async () => {
    readFile.mockResolvedValue('---\nstatus: "todo"\n---\n# Task');
    writeFile.mockResolvedValue();

    const dryRun = await writeFrontmatter(vaultPath, 'task.md', { status: 'doing' }, { dryRun: true });
    const applied = await writeFrontmatter(vaultPath, 'task.md', { status: 'doing' }, { dryRun: false });

    expect(dryRun.written).toBe(false);
    expect(applied.written).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(1);
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
