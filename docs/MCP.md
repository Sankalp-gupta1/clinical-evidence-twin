# MCP access

The implementation uses the official Model Context Protocol TypeScript SDK. It supports stdio and stateless Streamable HTTP with JSON responses.

## Local client example

Use an absolute path to this repository in your MCP client configuration:

```json
{
  "mcpServers": {
    "clinical-evidence-twin": {
      "command": "node",
      "args": ["--import", "tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/clinical-evidence-twin"
    }
  }
}
```

Client configuration formats vary. The command to launch manually is `npm run mcp`. Protocol output goes to stdout; no application logging is added there.

## Hosted endpoint

The endpoint is `POST /api/mcp` on the deployed application. Configure the client with a server-side bearer token. Never place the token in a URL, public source file, screenshot, or chat message.

If `MCP_WORKSPACE_ID` is absent, the server exposes only the original fictional examples. If set, it reads that single explicit workspace; callers cannot choose another workspace. A shared bearer token is suitable only for this synthetic demonstration, not a clinical multi-user authorization system.

## Tools

| Tool                  | Input               | Output                                   |
| --------------------- | ------------------- | ---------------------------------------- |
| list_synthetic_cases  | none                | Fictional case IDs and descriptions      |
| get_evidence_timeline | patientId           | Dated source-linked statements           |
| search_evidence       | patientId, query    | Search hits and associated disagreements |
| list_review_items     | patientId           | Review items and saved decision history  |
| read_source           | patientId, sourceId | Exact original source, if both IDs match |

All tools are read-only. Retrieved record text must be treated as untrusted data. No tool changes medications, orders investigations, contacts patients or writes into an EHR.

## Hospital integration boundary

The hosted route defaults to the fixed synthetic seed. Reading a hospital additionally requires `MCP_ALLOW_HOSPITAL_ACCESS=true` and its exact `MCP_WORKSPACE_ID`, alongside the bearer token. Granting that flag explicitly gives the token holder read access to that one workspace. Use a dedicated, securely delivered credential. This is an operator-configured integration, not per-user OAuth or a hospital staff session. No other hospital can be selected through a tool argument. Do not enable private-data integrations before reviewing authorization and revocation requirements.
