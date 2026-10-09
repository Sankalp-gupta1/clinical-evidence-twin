import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Command } from '@langchain/langgraph';
import { makeGraph } from '../lib/workflow';
import { seedWorkspace } from '../data/patients';
import { getAuth } from '../lib/auth';
import { getPool, readWorkspace } from '../lib/store';
import { requirePermission, AccessError, type AccountUser } from '../lib/permissions';
import { hospitalAction, hospitalsFor, withHospital, signedInUser } from '../lib/hospitals';
import { POST as writeAction } from '../app/api/action/route';
import { GET as workspaceRoute } from '../app/api/workspace/route';
import { GET as hospitalRoute } from '../app/api/hospital/route';
import { POST as demoQuestion } from '../app/api/demo/question/route';
import { analyze } from '../lib/evidence';
import { patients } from '../data/patients';

test(
  'hospital accounts: real auth sessions and PostgreSQL authorization',
  { timeout: 60000 },
  async (t) => {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 8 });
    await server.start();
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
    process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.AI_ENABLED = 'false';
    const auth = getAuth();
    const pool = getPool()!;
    const request = (path: string, cookie = '', body?: unknown) =>
      new Request(`http://localhost:3000${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin: 'http://localhost:3000',
          cookie,
          'content-type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    async function signup(name: string, email: string) {
      const password = `Fixture-only-${randomBytes(12).toString('hex')}`;
      const result = await auth.handler(
        request('/api/auth/sign-up/email', '', { name, email, password }),
      );
      assert.equal(result.status, 200, await result.clone().text());
      const cookie = result.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ');
      const session = await signedInUser(new Headers({ cookie }));
      return { user: session, cookie, password };
    }
    try {
      await t.test(
        'deployment migrations use the direct connection and can run twice',
        async () => {
          for (let attempt = 0; attempt < 2; attempt++) {
            const result = await promisify(execFile)(
              process.execPath,
              ['--import', 'tsx', 'scripts/migrate.ts'],
              {
                env: {
                  ...process.env,
                  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/unreachable',
                  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL,
                },
                timeout: 20000,
              },
            );
            assert.match(
              result.stdout,
              /Accounts, hospital access, source storage and workflow checkpoints are ready/,
            );
          }
        },
      );
      const owner = await signup('Pilot Owner', 'owner@example.com');
      const colleague = await signup('Pilot Colleague', 'colleague@example.com');
      const outsider = await signup('Other Hospital Owner', 'other@example.com');
      const a = await hospitalAction(owner.user, {
        type: 'create',
        name: 'Hospital A',
        department: 'Review team',
      });
      const b = await hospitalAction(outsider.user, {
        type: 'create',
        name: 'Hospital B',
        department: 'Review team',
      });
      const hospitalA = 'hospitalId' in a ? a.hospitalId! : '';
      const hospitalB = 'hospitalId' in b ? b.hospitalId! : '';
      await t.test(
        'sign-up creates a real session, hashed password, and no implicit clinical credentials',
        async () => {
          assert.equal(owner.user.emailVerified, false);
          const stored = await pool.query('SELECT password FROM account WHERE "userId"=$1', [
            owner.user.id,
          ]);
          assert.ok(stored.rows[0].password);
          assert.notEqual(stored.rows[0].password, owner.password);
          assert.equal((await hospitalsFor(owner.user.id))[0].role, 'owner');
          const bad = await auth.handler(
            request('/api/auth/sign-in/email', '', {
              email: 'owner@example.com',
              password: 'an-incorrect-fixture-password',
            }),
          );
          assert.equal(bad.status, 401);
          const good = await auth.handler(
            request('/api/auth/sign-in/email', '', {
              email: 'owner@example.com',
              password: owner.password,
            }),
          );
          assert.equal(good.status, 200);
        },
      );
      await t.test(
        'hospital IDs never grant access without membership; unauthenticated API is rejected',
        async () => {
          const denied = await workspaceRoute(
            request(`/api/workspace?hospitalId=${hospitalA}`, outsider.cookie),
          );
          assert.equal(denied.status, 403);
          const none = await workspaceRoute(request(`/api/workspace?hospitalId=${hospitalA}`));
          assert.equal(none.status, 401);
          await assert.rejects(
            withHospital(outsider.user, hospitalA, 'read', async () => true),
            AccessError,
          );
        },
      );
      const code = (
        await pool.query('SELECT join_code FROM cet_hospitals WHERE id=$1', [hospitalA])
      ).rows[0].join_code;
      await hospitalAction(colleague.user, {
        type: 'request',
        code,
        note: 'I am the fictional review team colleague.',
      });
      const req = (
        await pool.query('SELECT id FROM cet_join_requests WHERE user_id=$1', [colleague.user.id])
      ).rows[0].id;
      await t.test(
        'a hospital code creates a pending request, not access; other owners cannot approve it',
        async () => {
          await assert.rejects(
            withHospital(colleague.user, hospitalA, 'read', async () => true),
            AccessError,
          );
          await assert.rejects(
            hospitalAction(outsider.user, {
              type: 'decide',
              hospitalId: hospitalB,
              requestId: req,
              approve: true,
              role: 'reviewer',
            }),
            AccessError,
          );
          await hospitalAction(owner.user, {
            type: 'decide',
            hospitalId: hospitalA,
            requestId: req,
            approve: true,
            role: 'viewer',
          });
          assert.equal(
            await withHospital(colleague.user, hospitalA, 'read', async (_db, h) => h.role),
            'viewer',
          );
        },
      );
      const ws = await readWorkspace(hospitalA);
      const issue = analyze(ws.sources, patients[0]).issues[0];
      const action = {
        type: 'review',
        hospitalId: hospitalA,
        revision: 0,
        data: {
          issueId: issue.id,
          patientId: patients[0].id,
          outcome: 'keep_open',
          note: 'Waiting for a confirmed source in this fictional case.',
          reviewer: 'Spoofed senior clinician',
        },
      };
      await t.test(
        'viewer writes are rejected by the API, not just hidden by the interface',
        async () => {
          const denied = await writeAction(request('/api/action', colleague.cookie, action));
          assert.equal(denied.status, 403);
          await assert.rejects(
            hospitalAction(colleague.user, {
              type: 'role',
              hospitalId: hospitalA,
              memberId: colleague.user.id,
              role: 'reviewer',
            }),
            AccessError,
          );
          const team = await hospitalRoute(
            request(`/api/hospital?id=${hospitalA}`, colleague.cookie),
          );
          const body = await team.json();
          assert.equal(body.joinCode, null);
          assert.deepEqual(body.requests, []);
        },
      );
      await t.test(
        'reviewer writes persist, cannot spoof authorship, and do not appear in a different hospital',
        async () => {
          await hospitalAction(owner.user, {
            type: 'role',
            hospitalId: hospitalA,
            memberId: colleague.user.id,
            role: 'reviewer',
          });
          const saved = await writeAction(request('/api/action', colleague.cookie, action));
          assert.equal(saved.status, 200, await saved.clone().text());
          const workspace = (await saved.json()).workspace;
          assert.equal(workspace.decisions[0].reviewer, colleague.user.name);
          assert.equal(workspace.decisions[0].actorId, colleague.user.id);
          assert.equal(workspace.audit[0].actor, colleague.user.name);
          assert.equal((await readWorkspace(hospitalB)).decisions.length, 0);
          const stale = await writeAction(request('/api/action', colleague.cookie, action));
          assert.equal(stale.status, 409);
          assert.equal((await readWorkspace(hospitalA)).revision, 1);
        },
      );
      await t.test(
        'revocation takes effect on the next request and keeps historical reviews',
        async () => {
          await hospitalAction(owner.user, {
            type: 'remove',
            hospitalId: hospitalA,
            memberId: colleague.user.id,
          });
          const revoked = await workspaceRoute(
            request(`/api/workspace?hospitalId=${hospitalA}`, colleague.cookie),
          );
          assert.equal(revoked.status, 403);
          assert.equal((await readWorkspace(hospitalA)).decisions.length, 1);
          await assert.rejects(
            hospitalAction(owner.user, {
              type: 'remove',
              hospitalId: hospitalA,
              memberId: owner.user.id,
            }),
            AccessError,
          );
        },
      );
      await t.test(
        'public demo uses fixed seed records and cannot reveal a hospital review',
        async () => {
          const demo = await workspaceRoute(request('/api/workspace?demo=true', owner.cookie));
          const body = await demo.json();
          assert.equal(body.runtime.storage, 'Read-only preview');
          assert.equal(body.workspace.decisions.length, 0);
          const question = await demoQuestion(
            request('/api/demo/question', '', {
              patientId: 'demo-mira',
              question: 'Which records disagree?',
            }),
          );
          assert.equal(question.status, 200);
          const answer = (await question.json()).answer;
          assert.equal(answer.mode, 'Evidence search');
          assert.ok(answer.sourceIds.includes('MS-01'));
          const foreign = await writeAction(
            new Request('http://localhost:3000/api/action', {
              method: 'POST',
              headers: { origin: 'https://evil.example', cookie: owner.cookie },
              body: JSON.stringify(action),
            }),
          );
          assert.equal(foreign.status, 400);
        },
      );
      await t.test(
        'a LangGraph run resumes from stored PostgreSQL checkpoints in a fresh graph',
        async () => {
          const saver = new PostgresSaver(pool);
          await saver.setup();
          const config = { configurable: { thread_id: `${hospitalA}:demo-mira:persistent-test` } };
          const graph = makeGraph(saver);
          await graph.invoke(
            {
              patientId: 'demo-mira',
              sources: seedWorkspace().sources.filter((s) => s.patientId === 'demo-mira'),
              events: [],
            },
            config,
          );
          const fresh = makeGraph(new PostgresSaver(pool));
          assert.deepEqual((await fresh.getState(config)).next, ['review']);
          await fresh.invoke(
            new Command({
              resume: {
                approved: true,
                note: 'Read the fictional evidence brief and its remaining open questions.',
                reviewer: owner.user.name,
              },
            }),
            config,
          );
          const complete = await fresh.getState(config);
          assert.equal(complete.values.approved, true);
          assert.deepEqual(complete.next, []);
          assert.equal(
            Object.keys(
              (
                await fresh.getState({
                  configurable: { thread_id: `${hospitalB}:demo-mira:persistent-test` },
                })
              ).values,
            ).length,
            0,
          );
        },
      );
      await t.test('sign-out invalidates the old session cookie in the database', async () => {
        const out = await auth.handler(request('/api/auth/sign-out', owner.cookie, {}));
        assert.equal(out.status, 200);
        await assert.rejects(signedInUser(new Headers({ cookie: owner.cookie })), AccessError);
        assert.throws(() => requirePermission('owner,reviewer', 'manage'), AccessError);
        assert.throws(() => requirePermission(undefined, 'read'), AccessError);
      });
    } finally {
      await pool.end();
      await server.stop();
      await db.close();
    }
  },
);
