import { describe, it, expect } from 'vitest';
import { toolDefinitions } from '../src/toolDefinitions.js';

describe('Tool Definitions', () => {
  it('should have all required tool names', () => {
    const toolNames = toolDefinitions.map(t => t.name);
    expect(toolNames).toContain('search-vault');
    expect(toolNames).toContain('search-by-filename');
    expect(toolNames).toContain('list-notes');
    expect(toolNames).toContain('read-note');
    expect(toolNames).toContain('update-note');
    expect(toolNames).toContain('move-note');
    expect(toolNames).toContain('delete-note');
    expect(toolNames).toContain('write-frontmatter');
    expect(toolNames).toContain('bulk-write-frontmatter');
    expect(toolNames).toContain('extract-tasks');
    expect(toolNames).toContain('analyze-links');
    expect(toolNames).toContain('bulk-move-note');
  });

  it('should have valid schemas for all tools', () => {
    toolDefinitions.forEach(tool => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema).toHaveProperty('properties');
      expect(tool).toHaveProperty('outputSchema');
    });
  });

  it('should have required fields defined correctly', () => {
    const searchTool = toolDefinitions.find(t => t.name === 'search-vault');
    expect(searchTool.inputSchema.required).toEqual(['query']);

    const updateTool = toolDefinitions.find(t => t.name === 'update-note');
    expect(updateTool.inputSchema.required).toEqual(['path']);
    expect(updateTool.inputSchema.properties.mode).toBeDefined();
    expect(updateTool.inputSchema.properties.patches).toBeDefined();

    const moveTool = toolDefinitions.find(t => t.name === 'move-note');
    expect(moveTool.inputSchema.required).toEqual(['sourcePath', 'destinationPath']);

    const deleteTool = toolDefinitions.find(t => t.name === 'delete-note');
    expect(deleteTool.inputSchema.required).toEqual(['path']);

    const listTool = toolDefinitions.find(t => t.name === 'list-notes');
    expect(listTool.inputSchema.required).toBeUndefined();
    expect(listTool.inputSchema.properties.includeFolders).toBeDefined();
    
    const filenameSearchTool = toolDefinitions.find(t => t.name === 'search-by-filename');
    expect(filenameSearchTool.inputSchema.required).toEqual(['query']);

    const moveManyTool = toolDefinitions.find(t => t.name === 'bulk-move-note');
    expect(moveManyTool.inputSchema.required).toEqual(['moves']);
  });
});
