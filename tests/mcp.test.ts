import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEvidenceServer } from '../mcp/tools';

test('MCP advertises five read-only tools and refuses source access across patient IDs',async()=>{
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  const server=createEvidenceServer();const client=new Client({name:'verification-client',version:'1.0.0'});
  await server.connect(serverTransport);await client.connect(clientTransport);
  try{
    const listing=await client.listTools();assert.equal(listing.tools.length,5);assert.ok(listing.tools.every(t=>t.annotations?.readOnlyHint===true));
    const valid=await client.callTool({name:'read_source',arguments:{patientId:'demo-mira',sourceId:'MS-03'}});assert.ok(!valid.isError);assert.match(JSON.stringify(valid.content),/Discharge summary/);
    const wrong=await client.callTool({name:'read_source',arguments:{patientId:'demo-arjun',sourceId:'MS-03'}});assert.equal(wrong.isError,true);assert.doesNotMatch(JSON.stringify(wrong.content),/Medication A/);
  }finally{await client.close();await server.close();}
});
