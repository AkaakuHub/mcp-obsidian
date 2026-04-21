import { describe, it, expect } from 'vitest';
import { createServer } from '../src/server.js';
import { toolDefinitions } from '../src/toolDefinitions.js';
import { TOOL_NAMES } from '../src/tool-names.js';

function getToolDefinition(name) {
  return toolDefinitions.find((tool) => tool.name === name);
}

describe('Server Tools Definition', () => {
  it(`should define ${TOOL_NAMES.SEARCH_VAULT} tool correctly`, () => {
    const toolDef = getToolDefinition(TOOL_NAMES.SEARCH_VAULT);

    expect(toolDef.name).toBe(TOOL_NAMES.SEARCH_VAULT);
    expect(toolDef.description).toContain('Search note contents');
    expect(toolDef.inputSchema.required).toContain('query');
    expect(toolDef.inputSchema.properties.query).toBeDefined();
    expect(toolDef.inputSchema.properties.path).toBeDefined();
    expect(toolDef.inputSchema.properties.caseSensitive).toBeDefined();
  });

  it(`should define ${TOOL_NAMES.LIST_NOTES} tool correctly`, () => {
    const toolDef = getToolDefinition(TOOL_NAMES.LIST_NOTES);

    expect(toolDef.name).toBe(TOOL_NAMES.LIST_NOTES);
    expect(toolDef.description).toContain('List markdown note paths');
    expect(toolDef.inputSchema.properties.directory).toBeDefined();
    expect(toolDef.inputSchema.required).toBeUndefined();
  });

  it(`should define ${TOOL_NAMES.READ_NOTE} tool correctly`, () => {
    const toolDef = getToolDefinition(TOOL_NAMES.READ_NOTE);

    expect(toolDef.name).toBe(TOOL_NAMES.READ_NOTE);
    expect(toolDef.description).toContain('Read the full content');
    expect(toolDef.inputSchema.required).toContain('path');
    expect(toolDef.inputSchema.properties.path).toBeDefined();
  });

  it(`should define ${TOOL_NAMES.UPDATE_NOTE} tool correctly`, () => {
    const toolDef = getToolDefinition(TOOL_NAMES.UPDATE_NOTE);

    expect(toolDef.name).toBe(TOOL_NAMES.UPDATE_NOTE);
    expect(toolDef.description).toContain('Create, replace, append to, or patch');
    expect(toolDef.inputSchema.required).toContain('path');
    expect(toolDef.inputSchema.properties.path).toBeDefined();
    expect(toolDef.inputSchema.properties.mode).toBeDefined();
    expect(toolDef.inputSchema.properties.content).toBeDefined();
  });

  it(`should define ${TOOL_NAMES.DELETE_NOTE} tool correctly`, () => {
    const toolDef = getToolDefinition(TOOL_NAMES.DELETE_NOTE);

    expect(toolDef.name).toBe(TOOL_NAMES.DELETE_NOTE);
    expect(toolDef.description).toContain('Delete a markdown note');
    expect(toolDef.inputSchema.required).toContain('path');
    expect(toolDef.inputSchema.properties.path).toBeDefined();
  });

  it('should create server instance with all handlers', () => {
    const server = createServer('/test/vault');
    
    // Verify server is created
    expect(server).toBeDefined();
    expect(server._serverInfo).toBeDefined();
    expect(server._serverInfo.name).toBe('obsidian-mcp-filesystem');
    expect(server._serverInfo.version).toBe('0.1.0');
    
    // Verify server has required methods
    expect(server.setRequestHandler).toBeDefined();
    expect(server.connect).toBeDefined();
  });
});
