import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/analysis-tools.js', () => ({
  analyzeLinks: vi.fn()
}));

vi.mock('../src/vault-analysis.js', () => ({
  scanVaultNotes: vi.fn(),
  buildLinkGraph: vi.fn()
}));

import { analyzeLinks } from '../src/analysis-tools.js';
import { buildLinkGraph, scanVaultNotes } from '../src/vault-analysis.js';
import {
  auditDailyJournal,
  auditTasks,
  buildVaultInventory,
  detectDailyNotes,
  detectLargeNotes,
  detectSimilarNotes,
  detectUnorganizedNotes,
  proposeNoteRefactors
} from '../src/audits.js';

describe('audits', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect daily and journal style notes', async () => {
    scanVaultNotes.mockResolvedValue({
      notes: [
        { path: 'daily/2026-04-20.md', title: 'Daily', stem: '2026-04-20' },
        { path: 'journal/logbook.md', title: 'Journal', stem: 'logbook' },
        { path: 'thino-capture.md', title: 'Capture', stem: 'thino-capture' },
        { path: 'notes/idea.md', title: 'Idea', stem: 'idea' }
      ]
    });

    const result = await detectDailyNotes(vaultPath);

    expect(result.count).toBe(3);
    expect(result.notes).toEqual([
      expect.objectContaining({ path: 'daily/2026-04-20.md', category: 'daily' }),
      expect.objectContaining({ path: 'journal/logbook.md', category: 'journal' }),
      expect.objectContaining({ path: 'thino-capture.md', category: 'thino' })
    ]);
  });

  it('should detect similar notes by title tokens', async () => {
    scanVaultNotes.mockResolvedValue({
      notes: [
        { path: 'a.md', title: 'Project Alpha Plan', stem: 'a' },
        { path: 'b.md', title: 'Project Alpha Notes', stem: 'b' },
        { path: 'c.md', title: 'Cooking Ideas', stem: 'c' }
      ]
    });

    const result = await detectSimilarNotes(vaultPath, { threshold: 0.5 });

    expect(result.count).toBe(1);
    expect(result.pairs[0]).toMatchObject({ left: 'a.md', right: 'b.md', score: 0.5 });
  });

  it('should detect large notes by size or line count', async () => {
    scanVaultNotes.mockResolvedValue({
      notes: [
        { path: 'big.md', sizeBytes: 80000, lineCount: 100, taskCount: 5 },
        { path: 'long.md', sizeBytes: 1000, lineCount: 1200, taskCount: 2 },
        { path: 'small.md', sizeBytes: 1000, lineCount: 10, taskCount: 0 }
      ]
    });

    const result = await detectLargeNotes(vaultPath, { minSizeBytes: 50000, minLineCount: 800 });

    expect(result.count).toBe(2);
    expect(result.notes.map((note) => note.path)).toEqual(['big.md', 'long.md']);
  });

  it('should detect unorganized notes from metadata and link graph', async () => {
    scanVaultNotes.mockResolvedValue({
      notes: [
        { path: 'root.md', directory: '', hasFrontmatter: false, tags: [], linkCount: 0, stem: 'root', links: [] },
        { path: 'projects/linked.md', directory: 'projects', hasFrontmatter: true, tags: ['project'], linkCount: 1, stem: 'linked', links: ['root'] }
      ]
    });
    buildLinkGraph.mockReturnValue({
      nodes: [
        { path: 'root.md', inboundCount: 0 },
        { path: 'projects/linked.md', inboundCount: 0 }
      ]
    });

    const result = await detectUnorganizedNotes(vaultPath);

    expect(result.count).toBe(1);
    expect(result.notes[0]).toEqual({
      path: 'root.md',
      reasons: ['missing-frontmatter', 'missing-tags', 'isolated', 'root-level']
    });
  });

  it('should build vault inventory summary', async () => {
    scanVaultNotes.mockResolvedValue({
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
    scanVaultNotes.mockResolvedValue({
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

  it('should audit daily journal entry points and memo migration candidates', async () => {
    scanVaultNotes.mockResolvedValue({
      notes: [
        {
          path: 'daily/2026-04-20.md',
          stem: '2026-04-20',
          updatedAt: '2026-04-20T00:00:00.000Z',
          title: 'Daily',
          tags: ['daily']
        },
        {
          path: 'notes/memo-capture.md',
          stem: 'memo-capture',
          updatedAt: '2026-04-19T00:00:00.000Z',
          title: 'Memo',
          tags: []
        },
        {
          path: 'journal/weekly.md',
          stem: 'weekly',
          updatedAt: '2026-04-18T00:00:00.000Z',
          title: 'Weekly',
          tags: ['journal']
        }
      ]
    });

    const result = await auditDailyJournal(vaultPath);

    expect(result.entryPoints).toEqual([
      expect.objectContaining({ path: 'daily/2026-04-20.md', category: 'daily' }),
      expect.objectContaining({ path: 'journal/weekly.md', category: 'journal' })
    ]);
    expect(result.dailyReadyNotes).toEqual(['daily/2026-04-20.md', 'journal/weekly.md']);
    expect(result.migrationCandidates).toEqual([{ path: 'notes/memo-capture.md', suggestedCategory: 'journal' }]);
  });

  it('should propose refactors without applying changes', async () => {
    scanVaultNotes.mockResolvedValue({
      notes: [
        {
          path: 'Idea.md',
          directory: '',
          frontmatter: { area: 'areas/work' },
          title: 'Better Idea',
          tags: []
        },
        {
          path: 'projects/alpha.md',
          directory: 'projects',
          frontmatter: {},
          title: 'Alpha Plan',
          tags: []
        }
      ]
    });
    analyzeLinks.mockResolvedValue({
      orphans: ['Idea.md']
    });

    const result = await proposeNoteRefactors(vaultPath);

    expect(result.mode).toBe('proposal-only');
    expect(result.suggestionCount).toBe(4);
    expect(result.suggestions).toEqual([
      expect.objectContaining({ type: 'move', path: 'Idea.md', proposedPath: 'areas/work/Idea.md' }),
      expect.objectContaining({ type: 'rename', path: 'Idea.md', proposedPath: 'Better Idea.md' }),
      expect.objectContaining({ type: 'link', path: 'Idea.md', reason: 'isolated-note' }),
      expect.objectContaining({ type: 'rename', path: 'projects/alpha.md', proposedPath: 'projects/Alpha Plan.md' })
    ]);
  });
});
