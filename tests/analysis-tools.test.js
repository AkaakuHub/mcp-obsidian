import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('glob');

import { access, readFile, stat, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { extractTasks, listTags, writeFrontmatter, writeTags } from '../src/analysis-tools.js';
import { clearSnapshotCache } from '../src/vault-cache.js';

describe('analysis tools', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshotCache();
    access.mockResolvedValue();
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

  it('should extract tasks', async () => {
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

    expect(tasks.total).toBe(1);
  });

  it('should list aggregated tags and note-level tag details', async () => {
    glob.mockResolvedValue([
      '/test/vault/a.md',
      '/test/vault/b.md'
    ]);
    readFile.mockImplementation(async (file) => {
      if (file.endsWith('/a.md')) {
        return '---\ntags: [project]\n---\n# A\n#urgent';
      }
      return '# B\n#project\n#home';
    });

    const aggregate = await listTags(vaultPath, { includeNotes: true });
    const note = await listTags(vaultPath, { notePath: 'a.md' });

    expect(aggregate.tags).toEqual([
      { tag: 'project', count: 2, notes: ['a.md', 'b.md'] },
      { tag: 'home', count: 1, notes: ['b.md'] },
      { tag: 'urgent', count: 1, notes: ['a.md'] }
    ]);
    expect(note).toEqual({
      path: 'a.md',
      frontmatterTags: ['project'],
      inlineTags: ['urgent'],
      tags: ['project', 'urgent'],
      frontmatterError: null
    });
  });

  it('should merge tag casing case-insensitively and reject invalid write-tags input', async () => {
    readFile.mockResolvedValue('---\ntags: [Project]\n---\n#project\n#タグ');

    const listed = await listTags(vaultPath, { notePath: 'task' });

    expect(listed.frontmatterTags).toEqual(['Project']);
    expect(listed.inlineTags).toEqual(['project', 'タグ']);
    expect(listed.tags).toEqual(['Project', 'タグ']);

    await expect(writeTags(vaultPath, 'task', ['2024'], { dryRun: true }))
      .rejects
      .toThrow('Invalid tag: 2024');
  });

  it('should dry-run and apply frontmatter tag updates', async () => {
    readFile.mockResolvedValue('---\ntags: [project]\n---\nBody with #inline');
    writeFile.mockResolvedValue();

    const dryRun = await writeTags(vaultPath, 'task.md', ['#urgent', 'project'], { mode: 'add', dryRun: true });
    const applied = await writeTags(vaultPath, 'task', ['Project'], { mode: 'add', dryRun: false });

    expect(dryRun.afterFrontmatterTags).toEqual(['project', 'urgent']);
    expect(dryRun.inlineTagsDetected).toEqual(['inline']);
    expect(applied.written).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });
});
