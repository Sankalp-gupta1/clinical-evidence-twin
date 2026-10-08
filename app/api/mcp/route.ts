import { timingSafeEqual } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createEvidenceServer } from '@/mcp/tools';
import { readWorkspace } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const expected = process.env.MCP_ACCESS_TOKEN;
  if (!expected) return Response.json({ error: 'MCP access is not configured.' }, { status: 503 });
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > 24000)
    return Response.json({ error: 'Request too large' }, { status: 413 });
  const text = await request.text();
  if (text.length > 24000) return Response.json({ error: 'Request too large' }, { status: 413 });
  const server = createEvidenceServer(
    process.env.MCP_WORKSPACE_ID ? () => readWorkspace(process.env.MCP_WORKSPACE_ID!) : undefined,
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(
      new Request(request.url, { method: 'POST', headers: request.headers, body: text }),
    );
  } finally {
    await server.close();
  }
}
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
