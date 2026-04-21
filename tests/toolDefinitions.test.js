import { describe, it, expect } from 'vitest';
import { toolDefinitions } from '../src/toolDefinitions.js';
import { TOOL_NAMES } from '../src/tool-names.js';

describe('Tool Definitions', () => {
  it('should have all required tool names', () => {
    const toolNames = toolDefinitions.map(t => t.name);
    expect(toolNames).toEqual(expect.arrayContaining(Object.values(TOOL_NAMES)));
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
    const searchTool = toolDefinitions.find(t => t.name === TOOL_NAMES.SEARCH_VAULT);
    expect(searchTool.inputSchema.required).toEqual(['query']);

    const updateTool = toolDefinitions.find(t => t.name === TOOL_NAMES.UPDATE_NOTE);
    expect(updateTool.inputSchema.required).toEqual(['path']);
    expect(updateTool.inputSchema.properties.mode).toBeDefined();
    expect(updateTool.inputSchema.properties.patches).toBeDefined();

    const moveTool = toolDefinitions.find(t => t.name === TOOL_NAMES.MOVE_NOTE);
    expect(moveTool.inputSchema.required).toEqual(['sourcePath', 'destinationPath']);

    const deleteTool = toolDefinitions.find(t => t.name === TOOL_NAMES.DELETE_NOTE);
    expect(deleteTool.inputSchema.required).toEqual(['path']);

    const listTool = toolDefinitions.find(t => t.name === TOOL_NAMES.LIST_NOTES);
    expect(listTool.inputSchema.required).toBeUndefined();
    expect(listTool.inputSchema.properties.includeFolders).toBeDefined();
    
    const filenameSearchTool = toolDefinitions.find(t => t.name === TOOL_NAMES.SEARCH_BY_FILENAME);
    expect(filenameSearchTool.inputSchema.required).toEqual(['query']);

    const moveManyTool = toolDefinitions.find(t => t.name === TOOL_NAMES.BULK_MOVE_NOTE);
    expect(moveManyTool.inputSchema.required).toEqual(['moves']);
  });
});
