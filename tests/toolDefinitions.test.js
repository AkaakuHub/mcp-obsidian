import { describe, it, expect } from 'vitest';
import { toolDefinitions } from '../src/toolDefinitions.js';

describe('Tool Definitions', () => {
  it('should have all required tool names', () => {
    const toolNames = toolDefinitions.map(t => t.name);
    expect(toolNames).toContain('search-vault');
    expect(toolNames).toContain('search-by-filename');
    expect(toolNames).toContain('list-notes');
    expect(toolNames).toContain('read-note');
    expect(toolNames).toContain('write-note');
    expect(toolNames).toContain('append-to-note');
    expect(toolNames).toContain('move-note');
    expect(toolNames).toContain('delete-note');
    expect(toolNames).toContain('delete-note-safe');
    expect(toolNames).toContain('search-by-tags');
    expect(toolNames).toContain('list-notes-detailed');
    expect(toolNames).toContain('list-folders');
    expect(toolNames).toContain('write-frontmatter');
    expect(toolNames).toContain('bulk-update-frontmatter');
    expect(toolNames).toContain('extract-tasks');
    expect(toolNames).toContain('analyze-links');
    expect(toolNames).toContain('preview-move-impact');
    expect(toolNames).toContain('move-many');
    expect(toolNames).toContain('vault-inventory');
    expect(toolNames).toContain('task-audit');
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

    const writeTool = toolDefinitions.find(t => t.name === 'write-note');
    expect(writeTool.inputSchema.required).toEqual(['path', 'content']);

    const appendTool = toolDefinitions.find(t => t.name === 'append-to-note');
    expect(appendTool.inputSchema.required).toEqual(['path', 'content']);

    const moveTool = toolDefinitions.find(t => t.name === 'move-note');
    expect(moveTool.inputSchema.required).toEqual(['sourcePath', 'destinationPath']);

    const deleteTool = toolDefinitions.find(t => t.name === 'delete-note');
    expect(deleteTool.inputSchema.required).toEqual(['path']);

    const safeDeleteTool = toolDefinitions.find(t => t.name === 'delete-note-safe');
    expect(safeDeleteTool.inputSchema.required).toEqual(['path']);

    const listTool = toolDefinitions.find(t => t.name === 'list-notes');
    expect(listTool.inputSchema.required).toBeUndefined();

    const tagSearchTool = toolDefinitions.find(t => t.name === 'search-by-tags');
    expect(tagSearchTool.inputSchema.required).toEqual(['tags']);
    
    const filenameSearchTool = toolDefinitions.find(t => t.name === 'search-by-filename');
    expect(filenameSearchTool.inputSchema.required).toEqual(['query']);

    const previewMoveTool = toolDefinitions.find(t => t.name === 'preview-move-impact');
    expect(previewMoveTool.inputSchema.required).toEqual(['sourcePath', 'destinationPath']);

    const moveManyTool = toolDefinitions.find(t => t.name === 'move-many');
    expect(moveManyTool.inputSchema.required).toEqual(['moves']);
  });
});
