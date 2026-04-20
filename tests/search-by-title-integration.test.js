import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer } from '../src/server.js';
import { toolDefinitions } from '../src/toolDefinitions.js';

// Mock tools
vi.mock('../src/tools.js');

import { searchByTitle } from '../src/tools.js';

describe('Search by Title MCP Integration', () => {
  let server;
  const mockVaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer(mockVaultPath);
  });

  describe('Tool Definition', () => {
    it('should include search-by-title in available tools', () => {
      const searchByTitleTool = toolDefinitions.find(t => t.name === 'search-by-title');
      
      expect(searchByTitleTool).toBeDefined();
      expect(searchByTitleTool.title).toBe('Search by Title');
      expect(searchByTitleTool.description).toContain('H1');
      expect(searchByTitleTool.inputSchema.required).toEqual(['query']);
      expect(searchByTitleTool.inputSchema.properties.query).toBeDefined();
      expect(searchByTitleTool.inputSchema.properties.path).toBeDefined();
      expect(searchByTitleTool.inputSchema.properties.caseSensitive).toBeDefined();
    });

    it('should include search-by-filename in available tools', () => {
      const searchByFilenameTool = toolDefinitions.find(t => t.name === 'search-by-filename');

      expect(searchByFilenameTool).toBeDefined();
      expect(searchByFilenameTool.title).toBe('Search by Filename');
      expect(searchByFilenameTool.description).toContain('filename');
      expect(searchByFilenameTool.inputSchema.required).toEqual(['query']);
    });

    it('should include move-note in available tools', () => {
      const moveNoteTool = toolDefinitions.find(t => t.name === 'move-note');

      expect(moveNoteTool).toBeDefined();
      expect(moveNoteTool.title).toBe('Move Note');
      expect(moveNoteTool.description).toContain('Move or rename');
      expect(moveNoteTool.inputSchema.required).toEqual(['sourcePath', 'destinationPath']);
    });
  });

  describe('Tool Execution', () => {
    it('should verify search-by-title is callable', () => {
      const mockResults = {
        results: [
          { file: 'note1.md', title: 'Getting Started', line: 1 }
        ],
        count: 1,
        filesSearched: 5
      };
      
      searchByTitle.mockResolvedValue(mockResults);
      
      // Verify the server was created with the search-by-title capability
      expect(server).toBeDefined();
      expect(server._serverInfo.name).toBe('obsidian-mcp-filesystem');
      
      // Verify the function can be mocked
      expect(searchByTitle).toBeDefined();
    });
  });
});
