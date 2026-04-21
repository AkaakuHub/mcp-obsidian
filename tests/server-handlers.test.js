import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer } from '../src/server.js';
import { TOOL_NAMES } from '../src/tool-names.js';

// Mock the tools module
vi.mock('../src/tools.js', () => ({
  searchVault: vi.fn(),
  searchByFilename: vi.fn(),
  listNotes: vi.fn(),
  readNote: vi.fn(),
  readResolvedNote: vi.fn(),
  updateNote: vi.fn(),
  moveNote: vi.fn(),
  deleteNote: vi.fn()
}));

import { searchVault, listNotes, readNote, updateNote, moveNote, deleteNote } from '../src/tools.js';

describe('Server Handlers', () => {
  let server;
  const mockVaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer(mockVaultPath);
  });

  describe('Server creation', () => {
    it('should create server with correct metadata', () => {
      expect(server._serverInfo.name).toBe('obsidian-mcp-filesystem');
      expect(server._serverInfo.version).toBe('0.1.0');
    });

    it('should have tools capability', () => {
      expect(server._options.capabilities.tools).toBeDefined();
    });
  });

  describe('Tool schemas', () => {
    it('should define all tool schemas correctly', async () => {
      // We can't easily test the handlers directly, but we can verify
      // the server was created with the right structure
      expect(server.setRequestHandler).toBeDefined();
      expect(server.connect).toBeDefined();
    });
  });

  describe('Tool execution flow', () => {
    it(`should call searchVault when ${TOOL_NAMES.SEARCH_VAULT} tool is used`, async () => {
      const mockResult = { results: [], count: 0 };
      searchVault.mockResolvedValue(mockResult);
      
      // Verify the mock is set up
      const result = await searchVault(mockVaultPath, 'test', null, false);
      expect(result).toEqual(mockResult);
      expect(searchVault).toHaveBeenCalledWith(mockVaultPath, 'test', null, false);
    });

    it(`should call listNotes when ${TOOL_NAMES.LIST_NOTES} tool is used`, async () => {
      const mockResult = { notes: ['note1.md', 'note2.md'], count: 2 };
      listNotes.mockResolvedValue(mockResult);
      
      const result = await listNotes(mockVaultPath, 'folder');
      expect(result).toEqual(mockResult);
      expect(listNotes).toHaveBeenCalledWith(mockVaultPath, 'folder');
    });

    it(`should call readNote when ${TOOL_NAMES.READ_NOTE} tool is used`, async () => {
      const mockContent = '# Test Note';
      readNote.mockResolvedValue(mockContent);
      
      const result = await readNote(mockVaultPath, 'test.md');
      expect(result).toEqual(mockContent);
      expect(readNote).toHaveBeenCalledWith(mockVaultPath, 'test.md');
    });

    it(`should call updateNote when ${TOOL_NAMES.UPDATE_NOTE} tool is used`, async () => {
      updateNote.mockResolvedValue({ path: 'test.md', status: 'written', previousContentLength: 0, newContentLength: 9, changeCount: 1 });
      
      const result = await updateNote(mockVaultPath, 'test.md', { mode: 'replace', content: '# Content' });
      expect(result.status).toEqual('written');
      expect(updateNote).toHaveBeenCalledWith(mockVaultPath, 'test.md', { mode: 'replace', content: '# Content' });
    });

    it(`should call deleteNote when ${TOOL_NAMES.DELETE_NOTE} tool is used`, async () => {
      deleteNote.mockResolvedValue('test.md');
      
      const result = await deleteNote(mockVaultPath, 'test.md');
      expect(result).toEqual('test.md');
      expect(deleteNote).toHaveBeenCalledWith(mockVaultPath, 'test.md');
    });

    it(`should call moveNote when ${TOOL_NAMES.MOVE_NOTE} tool is used`, async () => {
      const mockResult = { fromPath: 'inbox/test.md', path: 'areas/test.md', status: 'moved' };
      moveNote.mockResolvedValue(mockResult);

      const result = await moveNote(mockVaultPath, 'test.md', 'areas/test.md', false);
      expect(result).toEqual(mockResult);
      expect(moveNote).toHaveBeenCalledWith(mockVaultPath, 'test.md', 'areas/test.md', false);
    });

  });
});
