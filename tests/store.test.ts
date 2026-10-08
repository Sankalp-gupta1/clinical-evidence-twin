import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readWorkspace, mutateWorkspace, ConflictError } from '../lib/store';
import { executeAction } from '../lib/service';
import { analyze } from '../lib/evidence';
import { patients } from '../data/patients';
import { verifySession, verifyOrigin } from '../lib/session';

test('local persistence survives reads, separates workspaces, and rejects stale concurrent updates', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'cet-test-'));
  process.env.LOCAL_DATA_DIR = dir;
  const a = randomUUID();
  const b = randomUUID();
  try {
    const start = await readWorkspace(a);
    assert.equal(start.revision, 0);
    const issue = analyze(start.sources, patients[0]).issues[0];
    await mutateWorkspace(a, 0, (ws) =>
      executeAction(ws, a, {
        type: 'review',
        revision: 0,
        data: {
          issueId: issue.id,
          patientId: 'demo-mira',
          outcome: 'keep_open',
          reviewer: 'Test reviewer',
          note: 'Waiting for a signed source record.',
        },
      }),
    );
    const saved = await readWorkspace(a);
    assert.equal(saved.decisions.length, 1);
    assert.equal(saved.revision, 1);
    assert.equal((await readWorkspace(b)).decisions.length, 0);
    await assert.rejects(
      mutateWorkspace(a, 0, async () => null),
      ConflictError,
    );
    const results = await Promise.allSettled([
      mutateWorkspace(a, 1, async () => 1),
      mutateWorkspace(a, 1, async () => 2),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await readWorkspace(a)).revision, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
    delete process.env.LOCAL_DATA_DIR;
  }
});
test('forged or malformed session cookies cannot open an existing workspace', () => {
  assert.equal(verifySession(undefined), null);
  assert.equal(verifySession('bad.payload'), null);
  assert.equal(verifySession(`${randomUUID()}.forged-signature`), null);
});
test('writes reject foreign browser origins', () => {
  assert.doesNotThrow(() =>
    verifyOrigin(
      new Request('https://workspace.example/api/action', {
        headers: { origin: 'https://workspace.example' },
      }),
    ),
  );
  assert.throws(
    () =>
      verifyOrigin(
        new Request('https://workspace.example/api/action', {
          headers: { origin: 'https://other.example' },
        }),
      ),
    /workspace website/,
  );
});
