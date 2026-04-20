import { describe, expect, it } from 'vitest';
import { collectTaskStyleVariants, extractTasksFromContent, summarizeTasks } from '../src/task-analysis.js';

describe('task analysis', () => {
  it('should extract markdown tasks with due dates', () => {
    const content = [
      '- [ ] plain task',
      '- [x] finished task due:: 2026-05-01',
      '* [ ] scheduled 📅 2026-05-03'
    ].join('\n');

    const tasks = extractTasksFromContent(content, 'tasks.md');

    expect(tasks).toHaveLength(3);
    expect(tasks[1]).toMatchObject({ completed: true, due: '2026-05-01' });
    expect(tasks[2]).toMatchObject({ completed: false, due: '2026-05-03' });
  });

  it('should summarize tasks by note', () => {
    const summary = summarizeTasks([
      { path: 'a.md', completed: false, due: null },
      { path: 'a.md', completed: true, due: '2026-05-01' },
      { path: 'b.md', completed: false, due: null }
    ]);

    expect(summary[0]).toMatchObject({ path: 'a.md', total: 2, open: 1, completed: 1, dueCount: 1 });
    expect(summary[1]).toMatchObject({ path: 'b.md', total: 1, open: 1, completed: 0, dueCount: 0 });
  });

  it('should collect task style variants', () => {
    const variants = collectTaskStyleVariants('- [ ] todo\n- [x] done\n- [/] partial', 'tasks.md');
    expect(variants.map((variant) => variant.marker)).toEqual([' ', 'x', '/']);
  });
});
