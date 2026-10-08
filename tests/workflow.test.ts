import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver, Command } from '@langchain/langgraph';
import { makeGraph, sourceFingerprint } from '../lib/workflow';
import { seedWorkspace } from '../data/patients';

test('the actual LangGraph fans out, waits for a human, then resumes from its checkpoint', async () => {
  const graph = makeGraph(new MemorySaver());
  const sources = seedWorkspace().sources.filter((s) => s.patientId === 'demo-mira');
  const config = { configurable: { thread_id: 'test-tenant:demo-mira:run-1' } };
  await graph.invoke({ patientId: 'demo-mira', sources, events: [] }, config);
  const paused = await graph.getState(config);
  assert.deepEqual(paused.next, ['review']);
  assert.equal(paused.values.conflicts.length, 3);
  assert.equal(paused.values.missing.length, 1);
  const nodes = paused.values.events.map((e: { node: string }) => e.node);
  for (const n of ['validate', 'normalize', 'timeline', 'conflicts', 'missing', 'assemble'])
    assert.ok(nodes.includes(n));
  assert.ok(!nodes.includes('finalize'));
  await graph.invoke(
    new Command({
      resume: {
        approved: true,
        note: 'Checked the source-linked brief. Unresolved items remain open.',
        reviewer: 'Test reviewer',
      },
    }),
    config,
  );
  const completed = await graph.getState(config);
  assert.deepEqual(completed.next, []);
  assert.equal(completed.values.approved, true);
  assert.equal(
    completed.values.events.filter((e: { node: string }) => e.node === 'review').length,
    1,
  );
  assert.equal(completed.values.events.at(-1).node, 'finalize');
});
test('separate checkpoint threads cannot read one another’s state', async () => {
  const graph = makeGraph(new MemorySaver());
  const sources = seedWorkspace().sources.filter((s) => s.patientId === 'demo-mira');
  await graph.invoke(
    { patientId: 'demo-mira', sources, events: [] },
    { configurable: { thread_id: 'workspace-a:case' } },
  );
  const other = await graph.getState({ configurable: { thread_id: 'workspace-b:case' } });
  assert.equal(Object.keys(other.values).length, 0);
});
test('source fingerprint changes when evidence changes', () => {
  const sources = seedWorkspace().sources;
  const before = sourceFingerprint(sources);
  sources[0].text += '\nAn additional fictional statement.';
  assert.notEqual(before, sourceFingerprint(sources));
});
