import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchVault } from '../src/tools.js';
import { readFile, stat } from 'fs/promises';
import { glob } from 'glob';
import { clearSnapshotCache } from '../src/vault-cache.js';

vi.mock('fs/promises');
vi.mock('glob');

describe('searchVault with operators', () => {
  const mockVaultPath = '/test/vault';
  
  beforeEach(() => {
    vi.clearAllMocks();
    clearSnapshotCache();
    stat.mockResolvedValue({
      size: 1000,
      birthtime: new Date('2026-01-01T00:00:00.000Z'),
      mtime: new Date('2026-01-02T00:00:00.000Z')
    });
  });

  it('should handle NOT operator correctly', async () => {
    // Mock files
    glob.mockResolvedValue([
      '/test/vault/note1.md',
      '/test/vault/note2.md'
    ]);
    
    // Mock file contents
    readFile
      .mockResolvedValueOnce('This note is about mcp and caas')
      .mockResolvedValueOnce('This note is about mcp only');
    
    const result = await searchVault(mockVaultPath, 'mcp NOT caas');
    
    // Should only find the second note
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.fileCount).toBe(1);
    expect(result.files[0].path).toBe('note2.md');
  });

  it('should handle minus operator correctly', async () => {
    // Mock files
    glob.mockResolvedValue([
      '/test/vault/note1.md',
      '/test/vault/note2.md'
    ]);
    
    // Mock file contents
    readFile
      .mockResolvedValueOnce('This note is about mcp and caas')
      .mockResolvedValueOnce('This note is about mcp only');
    
    const result = await searchVault(mockVaultPath, 'mcp -caas');
    
    // Should only find the second note
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.fileCount).toBe(1);
    expect(result.files[0].path).toBe('note2.md');
  });

  it('should show what evaluateExpression returns', async () => {
    // Mock files
    glob.mockResolvedValue([
      '/test/vault/note1.md'
    ]);
    
    // Mock file contents
    readFile.mockResolvedValueOnce('This note is about mcp and caas');
    
    // Test both queries
    const result1 = await searchVault(mockVaultPath, 'mcp NOT caas');
    const result2 = await searchVault(mockVaultPath, 'mcp -caas');
    
    // Both should exclude the note with caas
    expect(result1.totalMatches).toBe(0);
    expect(result2.totalMatches).toBe(0);
  });
});
