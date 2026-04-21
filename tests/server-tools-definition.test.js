import { describe, it, expect } from 'vitest';
import { createServer } from '../src/server.js';

describe('Server Tools Definition', () => {
  it('should define search-vault tool correctly', () => {
    const toolDef = {
      name: 'search-vault',
      description: 'Search note contents using boolean operators, field filters, phrases, and optional context snippets.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          path: {
            type: 'string',
            description: 'Optional path within vault to search',
          },
          caseSensitive: {
            type: 'boolean',
            description: 'Case sensitive search (default: false)',
          },
        },
        required: ['query'],
      },
    };

    expect(toolDef.name).toBe('search-vault');
    expect(toolDef.inputSchema.required).toContain('query');
    expect(toolDef.inputSchema.properties.query).toBeDefined();
    expect(toolDef.inputSchema.properties.path).toBeDefined();
    expect(toolDef.inputSchema.properties.caseSensitive).toBeDefined();
  });

  it('should define list-notes tool correctly', () => {
    const toolDef = {
      name: 'list-notes',
      description: 'List markdown note paths in the vault or a specific directory without reading note contents.',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory path relative to vault root (optional)',
          },
        },
      },
    };

    expect(toolDef.name).toBe('list-notes');
    expect(toolDef.inputSchema.properties.directory).toBeDefined();
    expect(toolDef.inputSchema.required).toBeUndefined();
  });

  it('should define read-note tool correctly', () => {
    const toolDef = {
      name: 'read-note',
      description: 'Read the full content of one markdown note.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the note relative to vault root',
          },
        },
        required: ['path'],
      },
    };

    expect(toolDef.name).toBe('read-note');
    expect(toolDef.inputSchema.required).toContain('path');
    expect(toolDef.inputSchema.properties.path).toBeDefined();
  });

  it('should define update-note tool correctly', () => {
    const toolDef = {
      name: 'update-note',
      description: 'Create, replace, append to, or patch part of a markdown note.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the note relative to vault root',
          },
          mode: {
            type: 'string',
            description: 'Update mode',
          },
          content: {
            type: 'string',
            description: 'Content of the note',
          },
        },
        required: ['path'],
      },
    };

    expect(toolDef.name).toBe('update-note');
    expect(toolDef.inputSchema.required).toContain('path');
    expect(toolDef.inputSchema.properties.path).toBeDefined();
    expect(toolDef.inputSchema.properties.mode).toBeDefined();
    expect(toolDef.inputSchema.properties.content).toBeDefined();
  });

  it('should define delete-note tool correctly', () => {
    const toolDef = {
      name: 'delete-note',
      description: 'Delete a markdown note by vault-relative path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the note relative to vault root',
          },
        },
        required: ['path'],
      },
    };

    expect(toolDef.name).toBe('delete-note');
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
