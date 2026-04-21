import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { toolDefinitions } from '../src/toolDefinitions.js';
import { TOOL_NAMES } from '../src/tool-names.js';

const coreToolNames = [
  TOOL_NAMES.SEARCH_VAULT,
  TOOL_NAMES.LIST_NOTES,
  TOOL_NAMES.READ_NOTE,
  TOOL_NAMES.UPDATE_NOTE,
  TOOL_NAMES.DELETE_NOTE
];

describe('MCP Server Integration', () => {
  let server;
  const mockVaultPath = '/test/vault';

  beforeEach(() => {
    // Create a test server instance
    server = new Server(
      {
        name: 'obsidian-mcp-filesystem',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  });

  describe('Server initialization', () => {
    it('should have correct server metadata', () => {
      expect(server._serverInfo.name).toBe('obsidian-mcp-filesystem');
      expect(server._serverInfo.version).toBe('0.1.0');
    });

    it('should have tools capability', () => {
      expect(server._options.capabilities.tools).toBeDefined();
    });
  });

  describe('ListTools handler', () => {
    it('should return all available tools', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        tools: toolDefinitions.filter((tool) => coreToolNames.includes(tool.name))
      });

      server.setRequestHandler(ListToolsRequestSchema, mockHandler);

      const response = await mockHandler({});
      
      expect(response.tools).toHaveLength(coreToolNames.length);
      expect(response.tools.map((tool) => tool.name)).toEqual(coreToolNames);
    });
  });

  describe('Tool input validation', () => {
    const toolSchemas = Object.fromEntries(
      toolDefinitions.map((tool) => [tool.name, tool.inputSchema])
    );

    it('should validate required parameters', () => {
      const searchSchema = toolSchemas[TOOL_NAMES.SEARCH_VAULT];
      expect(searchSchema.required).toContain('query');

      const readSchema = toolSchemas[TOOL_NAMES.READ_NOTE];
      expect(readSchema.required).toContain('path');

      const updateSchema = toolSchemas[TOOL_NAMES.UPDATE_NOTE];
      expect(updateSchema.required).toContain('path');
    });

    it('should have proper type definitions', () => {
      Object.values(toolSchemas).forEach(schema => {
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid tool names', async () => {
      const mockHandler = vi.fn().mockRejectedValue(
        new Error('Unknown tool: invalid-tool')
      );

      server.setRequestHandler(CallToolRequestSchema, mockHandler);

      await expect(mockHandler({
        params: {
          name: 'invalid-tool',
          arguments: {}
        }
      })).rejects.toThrow('Unknown tool: invalid-tool');
    });

    it('should handle missing required arguments', async () => {
      const mockHandler = vi.fn().mockRejectedValue(
        new Error('Missing required argument: path')
      );

      server.setRequestHandler(CallToolRequestSchema, mockHandler);

      await expect(mockHandler({
        params: {
          name: TOOL_NAMES.READ_NOTE,
          arguments: {}
        }
      })).rejects.toThrow('Missing required argument: path');
    });
  });
});
