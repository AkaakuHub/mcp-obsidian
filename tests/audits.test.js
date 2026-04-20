import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/vault-analysis.js', () => ({
  getVaultSnapshot: vi.fn(),
  buildLinkGraph: vi.fn()
}));

import { buildLinkGraph, getVaultSnapshot } from '../src/vault-analysis.js';
import {
  auditTasks,
  buildVaultInventory
} from '../src/audits.js';

describe('audits', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build vault inventory summary', async () => {
    getVaultSnapshot.mockResolvedValue({
      notes: [
        {
          path: 'daily/2026-04-20.md',
          directory: 'daily',
          tags: ['daily', 'log'],
          tasks: [{ text: 'a' }],
          sizeBytes: 100,
          lineCount: 20,
          updatedAt: '2026-04-20T00:00:00.000Z'
        },
        {
          path: 'projects/alpha.md',
          directory: 'projects',
          tags: ['project'],
          tasks: [{ text: 'b' }, { text: 'c' }],
          sizeBytes: 500,
          lineCount: 40,
          updatedAt: '2026-04-21T00:00:00.000Z'
        }
      ]
    });
    buildLinkGraph.mockReturnValue({
      orphans: ['daily/2026-04-20.md']
    });

    const result = await buildVaultInventory(vaultPath);

    expect(result).toMatchObject({
      noteCount: 2,
      folderCount: 2,
      taskCount: 3,
      orphanCount: 1,
      orphans: ['daily/2026-04-20.md']
    });
    expect(result.topTags[0]).toEqual({ tag: 'daily', count: 1 });
    expect(result.largeNotes[0].path).toBe('projects/alpha.md');
    expect(result.recentNotes[0].path).toBe('projects/alpha.md');
  });

  it('should audit tasks for missing due dates, hotspots, and project gaps', async () => {
    getVaultSnapshot.mockResolvedValue({
      notes: [
        {
          path: 'tasks.md',
          taskCount: 3,
          tasks: [
            { path: 'tasks.md', completed: false, due: null, text: 'todo' },
            { path: 'tasks.md', completed: false, due: '2026-05-01', text: 'scheduled' },
            { path: 'tasks.md', completed: true, due: null, text: 'done' }
          ],
          frontmatter: {},
          content: '- [ ] todo\n- [ ] scheduled\n- [x] done'
        },
        {
          path: 'project.md',
          taskCount: 1,
          tasks: [{ path: 'project.md', completed: false, due: null, text: 'next' }],
          frontmatter: { project: 'alpha' },
          content: '- [/] next'
        }
      ]
    });

    const result = await auditTasks(vaultPath, { hotspotThreshold: 2 });

    expect(result.totalTasks).toBe(4);
    expect(result.missingDueCount).toBe(2);
    expect(result.hotspots).toEqual([{ path: 'tasks.md', taskCount: 3 }]);
    expect(result.projectUnclassifiedNotes).toEqual(['tasks.md']);
    expect(result.completionStyles).toEqual([
      { marker: ' ', count: 2 },
      { marker: '/', count: 1 },
      { marker: 'x', count: 1 }
    ]);
  });

});
