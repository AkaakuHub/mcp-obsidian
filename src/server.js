import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerToolHandlers } from './tool-handlers.js';

export function createServer(vaultPath) {
  const server = new Server(
    {
      name: 'obsidian-mcp-filesystem',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {
          listChanged: false
        },
      },
    }
  );

  registerToolHandlers(server, vaultPath);
  return server;
}
