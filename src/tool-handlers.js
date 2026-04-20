import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { Errors, MCPError } from './errors.js';
import { errorResponse } from './response-formatter.js';
import { createToolHandlerMap } from './tool-handler-map.js';
import { toolDefinitions } from './toolDefinitions.js';

export function registerToolHandlers(server, vaultPath) {
  const handlers = createToolHandlerMap(vaultPath);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    try {
      const handler = handlers[name];
      if (!handler) {
        throw Errors.toolNotFound(name);
      }

      return await handler(args, startTime, name);
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      return errorResponse(error);
    }
  });
}
