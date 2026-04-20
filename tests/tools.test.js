import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appendToNote, searchVault, listNotes, readNote, writeNote, moveNote, deleteNote } from '../src/tools.js';

// Mock fs and glob
vi.mock('fs/promises');
vi.mock('glob');

import { readFile, writeFile, mkdir, unlink, access, rename, stat } from 'fs/promises';
import { glob } from 'glob';
import { clearSnapshotCache } from '../src/vault-cache.js';
import { getVaultSnapshot } from '../src/vault-analysis.js';

describe('Tools module', () => {
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

  describe('searchVault', () => {
    it('should find matches in markdown files', async () => {
      const mockFiles = [
        '/test/vault/note1.md',
        '/test/vault/folder/note2.md'
      ];

      glob.mockResolvedValue(mockFiles);
      // Mock file sizes to be within limit
      // After sorting: folder/note2.md comes before note1.md
      readFile
        .mockResolvedValueOnce('Another file\nWith TEST here\nAnd TEST again')
        .mockResolvedValueOnce('Line 1\nThis contains TEST\nLine 3');

      const result = await searchVault(mockVaultPath, 'test', null, false);

      expect(glob).toHaveBeenCalledWith('/test/vault/**/*.md');
      expect(readFile).toHaveBeenCalledTimes(2);
      expect(result.totalMatches).toBe(3);
      expect(result.fileCount).toBe(2);
      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual({
        path: 'folder/note2.md',
        matchCount: 2,
        matches: [{
          line: 2,
          content: 'With TEST here'
        }, {
          line: 3,
          content: 'And TEST again'
        }]
      });
    });

    it('should handle case-sensitive search', async () => {
      const mockFiles = ['/test/vault/note.md'];
      glob.mockResolvedValue(mockFiles);
      readFile.mockResolvedValue('test\nTest\nTEST');

      const result = await searchVault(mockVaultPath, 'Test', null, true);

      expect(result.totalMatches).toBe(1);
      expect(result.files[0].matches[0].line).toBe(2);
    });

    it('should search within specific path', async () => {
      glob.mockResolvedValue([]);
      
      await searchVault(mockVaultPath, 'query', 'subfolder', false);

      expect(glob).toHaveBeenCalledWith('/test/vault/subfolder/**/*.md');
    });

    it('should handle empty results', async () => {
      glob.mockResolvedValue(['/test/vault/note.md']);
      readFile.mockResolvedValue('No matches here');

      const result = await searchVault(mockVaultPath, 'notfound', null, false);

      expect(result.totalMatches).toBe(0);
      expect(result.files).toHaveLength(0);
    });

    it('should handle file read errors', async () => {
      glob.mockResolvedValue(['/test/vault/note.md']);
      // File is skipped if too large, so it won't cause error
      stat.mockRejectedValue(new Error('File too large'));

      const result = await searchVault(mockVaultPath, 'test', null, false);
      
      // Should return empty results since file was skipped
      expect(result.totalMatches).toBe(0);
      expect(result.files).toHaveLength(0);
    });
  });

  describe('listNotes', () => {
    it('should list all markdown files sorted', async () => {
      const mockFiles = [
        '/test/vault/zebra.md',
        '/test/vault/alpha.md',
        '/test/vault/folder/beta.md'
      ];
      
      glob.mockResolvedValue(mockFiles);

      const result = await listNotes(mockVaultPath);

      expect(glob).toHaveBeenCalledWith('/test/vault/**/*.md');
      expect(result.count).toBe(3);
      expect(result.notes).toEqual([
        'alpha.md',
        'folder/beta.md',
        'zebra.md'
      ]);
    });

    it('should list notes in specific directory', async () => {
      const mockFiles = [
        '/test/vault/projects/project1.md',
        '/test/vault/projects/project2.md'
      ];
      
      glob.mockResolvedValue(mockFiles);

      const result = await listNotes(mockVaultPath, 'projects');

      expect(glob).toHaveBeenCalledWith('/test/vault/projects/**/*.md');
      expect(result.count).toBe(2);
    });

    it('should handle empty vault', async () => {
      glob.mockResolvedValue([]);

      const result = await listNotes(mockVaultPath);

      expect(result.count).toBe(0);
      expect(result.notes).toEqual([]);
    });

    it('should handle glob errors', async () => {
      glob.mockRejectedValue(new Error('Access denied'));

      await expect(listNotes(mockVaultPath))
        .rejects.toThrow('Access denied');
    });
  });

  describe('readNote', () => {
    it('should read note content', async () => {
      const noteContent = '# Test Note\n\nThis is the content';
      access.mockResolvedValue();
      readFile.mockResolvedValue(noteContent);

      const result = await readNote(mockVaultPath, 'test.md');

      expect(readFile).toHaveBeenCalledWith('/test/vault/test.md', 'utf-8');
      expect(result).toBe(noteContent);
    });

    it('should handle nested paths', async () => {
      access.mockResolvedValue();
      readFile.mockResolvedValue('Content');

      await readNote(mockVaultPath, 'folder/subfolder/note.md');

      expect(readFile).toHaveBeenCalledWith(
        '/test/vault/folder/subfolder/note.md',
        'utf-8'
      );
    });

    it('should propagate read errors', async () => {
      access.mockResolvedValue();
      readFile.mockRejectedValue(new Error('File not found'));

      await expect(readNote(mockVaultPath, 'missing.md'))
        .rejects.toThrow('Failed to read note');
    });

    it('should resolve note by filename when exact path not found (wikilink-style)', async () => {
      // Exact path fails, but glob finds the file elsewhere
      access.mockRejectedValueOnce(new Error('ENOENT'));
      glob.mockResolvedValue(['/test/vault/projects/note.md']);
      readFile.mockResolvedValue('# Found Note');

      const result = await readNote(mockVaultPath, 'note.md');

      expect(glob).toHaveBeenCalledWith('/test/vault/**/note.md');
      expect(result).toBe('# Found Note');
    });

    it('should throw ambiguity error when multiple matches found', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT'));
      glob.mockResolvedValue([
        '/test/vault/folder1/note.md',
        '/test/vault/folder2/note.md'
      ]);

      await expect(readNote(mockVaultPath, 'note.md'))
        .rejects.toThrow(/Ambiguous path.*matches multiple notes/);
    });

    it('should throw resource not found when no matches', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT'));
      glob.mockResolvedValue([]);

      await expect(readNote(mockVaultPath, 'nonexistent.md'))
        .rejects.toThrow('Resource not found');
    });
  });

  describe('writeNote', () => {
    it('should write note with directory creation', async () => {
      mkdir.mockResolvedValue();
      writeFile.mockResolvedValue();

      const result = await writeNote(mockVaultPath, 'new/folder/note.md', '# New Note');

      expect(mkdir).toHaveBeenCalledWith('/test/vault/new/folder', { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        '/test/vault/new/folder/note.md',
        '# New Note',
        'utf-8'
      );
      expect(result).toBe('new/folder/note.md');
    });

    it('should handle existing directory', async () => {
      // mkdir succeeds (directory already exists is not an error with recursive: true)
      mkdir.mockResolvedValue();
      writeFile.mockResolvedValue();

      const result = await writeNote(mockVaultPath, 'note.md', 'Content');

      expect(result).toBe('note.md');
      expect(writeFile).toHaveBeenCalled();
    });

    it('should propagate write errors', async () => {
      mkdir.mockResolvedValue();
      writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(writeNote(mockVaultPath, 'note.md', 'Content'))
        .rejects.toThrow('Failed to write note');
    });

    it('should write to root directory', async () => {
      mkdir.mockResolvedValue();
      writeFile.mockResolvedValue();

      await writeNote(mockVaultPath, 'root-note.md', 'Content');

      expect(mkdir).toHaveBeenCalledWith('/test/vault', { recursive: true });
    });

    it('should reject oversized content before writing', async () => {
      const oversizedContent = 'a'.repeat(11 * 1024 * 1024);

      await expect(writeNote(mockVaultPath, 'note.md', oversizedContent))
        .rejects.toThrow('File too large');

      expect(mkdir).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should invalidate cached snapshots after writing', async () => {
      glob.mockResolvedValue(['/test/vault/note.md']);
      stat.mockResolvedValue({ size: 20, birthtime: new Date('2026-01-01T00:00:00.000Z'), mtime: new Date('2026-01-02T00:00:00.000Z') });
      readFile
        .mockResolvedValueOnce('# Before')
        .mockResolvedValueOnce('# After');
      mkdir.mockResolvedValue();
      writeFile.mockResolvedValue();

      const before = await getVaultSnapshot(mockVaultPath, {});
      await writeNote(mockVaultPath, 'note.md', '# After');
      const after = await getVaultSnapshot(mockVaultPath, {});

      expect(before.notes[0].title).toBe('Before');
      expect(after.notes[0].title).toBe('After');
      expect(glob).toHaveBeenCalledTimes(2);
    });
  });

  describe('appendToNote', () => {
    it('should append content with the default separator', async () => {
      access.mockResolvedValue();
      readFile.mockResolvedValue('# Daily');
      writeFile.mockResolvedValue();
      mkdir.mockResolvedValue();

      const result = await appendToNote(mockVaultPath, 'daily.md', '- [ ] todo');

      expect(writeFile).toHaveBeenCalledWith('/test/vault/daily.md', '# Daily\n\n- [ ] todo', 'utf-8');
      expect(result).toEqual({
        path: 'daily.md',
        status: 'appended',
        appendedLength: 10,
        newContentLength: 19
      });
    });

    it('should append without adding a separator to an empty note', async () => {
      access.mockResolvedValue();
      readFile.mockResolvedValue('');
      writeFile.mockResolvedValue();
      mkdir.mockResolvedValue();

      await appendToNote(mockVaultPath, 'inbox.md', 'hello');

      expect(writeFile).toHaveBeenCalledWith('/test/vault/inbox.md', 'hello', 'utf-8');
    });
  });

  describe('deleteNote', () => {
    it('should delete note', async () => {
      access.mockResolvedValue();
      unlink.mockResolvedValue();

      const result = await deleteNote(mockVaultPath, 'delete-me.md');

      expect(unlink).toHaveBeenCalledWith('/test/vault/delete-me.md');
      expect(result).toBe('delete-me.md');
    });

    it('should handle nested paths', async () => {
      access.mockResolvedValue();
      unlink.mockResolvedValue();

      await deleteNote(mockVaultPath, 'folder/note.md');

      expect(unlink).toHaveBeenCalledWith('/test/vault/folder/note.md');
    });

    it('should propagate delete errors', async () => {
      unlink.mockRejectedValue(new Error('Permission denied'));

      await expect(deleteNote(mockVaultPath, 'protected.md'))
        .rejects.toThrow('Permission denied');
    });

    it('should invalidate cached snapshots after deleting', async () => {
      glob
        .mockResolvedValueOnce(['/test/vault/delete-me.md'])
        .mockResolvedValueOnce([]);
      stat.mockResolvedValue({ size: 20, birthtime: new Date('2026-01-01T00:00:00.000Z'), mtime: new Date('2026-01-02T00:00:00.000Z') });
      readFile.mockResolvedValue('# Delete Me');
      access.mockResolvedValue();
      unlink.mockResolvedValue();

      const before = await getVaultSnapshot(mockVaultPath, {});
      await deleteNote(mockVaultPath, 'delete-me.md');
      const after = await getVaultSnapshot(mockVaultPath, {});

      expect(before.notes).toHaveLength(1);
      expect(after.notes).toHaveLength(0);
      expect(glob).toHaveBeenCalledTimes(2);
    });
  });

  describe('moveNote', () => {
    it('should move note to a new path with directory creation', async () => {
      access.mockImplementation(async (targetPath) => {
        if (targetPath === '/test/vault/source.md') {
          return;
        }
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      });
      mkdir.mockResolvedValue();
      rename.mockResolvedValue();

      const result = await moveNote(mockVaultPath, 'source.md', 'archive/source.md');

      expect(mkdir).toHaveBeenCalledWith('/test/vault/archive', { recursive: true });
      expect(rename).toHaveBeenCalledWith('/test/vault/source.md', '/test/vault/archive/source.md');
      expect(result).toEqual({
        fromPath: 'source.md',
        path: 'archive/source.md',
        status: 'moved'
      });
    });

    it('should resolve a unique basename before moving', async () => {
      access.mockImplementation(async (targetPath) => {
        if (targetPath === '/test/vault/areas/source.md') {
          const error = new Error('missing');
          error.code = 'ENOENT';
          throw error;
        }
        throw new Error('not found');
      });
      glob.mockResolvedValue(['/test/vault/inbox/source.md']);
      mkdir.mockResolvedValue();
      rename.mockResolvedValue();

      const result = await moveNote(mockVaultPath, 'source.md', 'areas/source.md');

      expect(glob).toHaveBeenCalledWith('/test/vault/**/source.md');
      expect(rename).toHaveBeenCalledWith('/test/vault/inbox/source.md', '/test/vault/areas/source.md');
      expect(result.fromPath).toBe('inbox/source.md');
    });

    it('should reject an existing destination by default', async () => {
      access.mockImplementation(async (targetPath) => {
        if (targetPath === '/test/vault/source.md') {
          return;
        }
        if (targetPath === '/test/vault/archive/source.md') {
          return;
        }
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      });

      await expect(moveNote(mockVaultPath, 'source.md', 'archive/source.md'))
        .rejects.toThrow('Destination already exists');

      expect(rename).not.toHaveBeenCalled();
    });

    it('should invalidate cached snapshots after moving', async () => {
      glob
        .mockResolvedValueOnce(['/test/vault/source.md'])
        .mockResolvedValueOnce(['/test/vault/archive/source.md']);
      stat.mockResolvedValue({ size: 20, birthtime: new Date('2026-01-01T00:00:00.000Z'), mtime: new Date('2026-01-02T00:00:00.000Z') });
      readFile
        .mockResolvedValueOnce('# Source')
        .mockResolvedValueOnce('# Source');
      access.mockImplementation(async (targetPath) => {
        if (targetPath === '/test/vault/source.md') {
          return;
        }
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      });
      mkdir.mockResolvedValue();
      rename.mockResolvedValue();

      const before = await getVaultSnapshot(mockVaultPath, {});
      await moveNote(mockVaultPath, 'source.md', 'archive/source.md');
      const after = await getVaultSnapshot(mockVaultPath, {});

      expect(before.notes[0].path).toBe('source.md');
      expect(after.notes[0].path).toBe('archive/source.md');
      expect(glob).toHaveBeenCalledTimes(2);
    });
  });
});
