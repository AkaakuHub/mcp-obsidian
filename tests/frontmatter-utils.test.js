import { describe, expect, it } from 'vitest';
import { diffFrontmatter, mergeFrontmatter, serializeFrontmatter, upsertFrontmatter } from '../src/frontmatter.js';
import { extractFrontmatter } from '../src/metadata.js';

describe('frontmatter utilities', () => {
  it('should serialize flat frontmatter values', () => {
    const result = serializeFrontmatter({
      status: 'active',
      done: false,
      tags: ['project', 'next']
    });

    expect(result.startsWith('---\n')).toBe(true);
    expect(result.endsWith('\n---\n')).toBe(true);
    expect(result).toContain('status: "active"');
    expect(result).toContain('done: false');
    expect(extractFrontmatter(result).frontmatter).toEqual({
      status: 'active',
      done: false,
      tags: ['project', 'next']
    });
  });

  it('should upsert frontmatter into markdown content', () => {
    const result = upsertFrontmatter('# Note\n\nBody', { project: 'mcp', due: '2026-04-20' });

    expect(result).toContain('project: "mcp"');
    expect(result).toContain('due: "2026-04-20"');
    expect(result).toContain('# Note');
  });

  it('should merge and diff frontmatter objects', () => {
    const merged = mergeFrontmatter({ status: 'todo', area: 'work' }, { status: 'doing' }, true);
    const diff = diffFrontmatter({ status: 'todo', area: 'work' }, merged);

    expect(merged).toEqual({ status: 'doing', area: 'work' });
    expect(diff).toEqual([{ key: 'status', before: 'todo', after: 'doing' }]);
  });

  it('should preserve existing comments when updating frontmatter', () => {
    const content = `---
# status comment
status: "todo"
owner: "alice"
---

# Note`;

    const result = upsertFrontmatter(content, {
      status: 'doing',
      owner: 'alice'
    });

    expect(result).toContain('# status comment');
    expect(result).toContain('status: "doing"');
    expect(result).toContain('owner: "alice"');
  });
});
