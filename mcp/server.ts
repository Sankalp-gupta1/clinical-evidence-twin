import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createEvidenceServer } from './tools';
import { readWorkspace } from '../lib/store';
const workspaceId = process.env.MCP_WORKSPACE_ID;
const server = createEvidenceServer(workspaceId ? () => readWorkspace(workspaceId) : undefined);
void server.connect(new StdioServerTransport()).catch(() => {
  console.error('MCP server could not start.');
  process.exitCode = 1;
});
