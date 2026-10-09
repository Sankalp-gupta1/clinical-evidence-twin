import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { seedWorkspace } from '@/data/patients';
import type { Workspace } from './types';

let pool: Pool | undefined;
let supportPool: Pool | undefined;
// Graph checkpoints and AI budget writes must not wait for a connection held by
// the enclosing workspace transaction. Otherwise concurrent runs can exhaust it.
export function getSupportPool() {
  if (!process.env.DATABASE_URL) return undefined;
  return (supportPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 20000,
  }));
}
export function getPool() {
  if (!process.env.DATABASE_URL) return undefined;
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 20000,
  });
  return pool;
}
export function storageMode() {
  if (
    ((process.env.VERCEL || process.env.NODE_ENV === 'production') &&
      Math.max(
        process.env.SESSION_SECRET?.length ?? 0,
        process.env.BETTER_AUTH_SECRET?.length ?? 0,
      ) < 32) ||
    (process.env.VERCEL && !process.env.DATABASE_URL)
  )
    return 'Read-only preview' as const;
  return process.env.DATABASE_URL
    ? ('PostgreSQL' as const)
    : process.env.VERCEL
      ? ('Read-only preview' as const)
      : ('Local file' as const);
}
function assertWorkspace(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid workspace.');
}
const locks = new Map<string, Promise<unknown>>();
async function localLock<T>(id: string, fn: () => Promise<T>) {
  const prior = locks.get(id) ?? Promise.resolve();
  const job = prior.catch(() => undefined).then(fn);
  locks.set(id, job);
  try {
    return await job;
  } finally {
    if (locks.get(id) === job) locks.delete(id);
  }
}
function localPath(id: string) {
  return path.join(process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), '.data'), `${id}.json`);
}
async function readLocal(id: string): Promise<Workspace> {
  try {
    return JSON.parse(await readFile(localPath(id), 'utf8')) as Workspace;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return seedWorkspace();
    throw error;
  }
}
export async function readWorkspace(id: string, transaction?: PoolClient): Promise<Workspace> {
  assertWorkspace(id);
  if (storageMode() === 'Read-only preview') return seedWorkspace();
  const db = getPool();
  if (!db) return process.env.VERCEL ? seedWorkspace() : readLocal(id);
  const result = await (transaction ?? db).query('SELECT data FROM cet_workspaces WHERE id=$1', [
    id,
  ]);
  return result.rows[0]?.data ?? seedWorkspace();
}
export async function mutateWorkspace<T>(
  id: string,
  expectedRevision: number,
  mutate: (workspace: Workspace) => Promise<T>,
  transaction?: PoolClient,
): Promise<{ workspace: Workspace; result: T }> {
  assertWorkspace(id);
  if (storageMode() === 'Read-only preview')
    throw new UnavailableError(
      'Saving is not connected yet. The deployment needs its database and session secret.',
    );
  const db = getPool();
  const update = async (workspace: Workspace) => {
    if (workspace.revision !== expectedRevision)
      throw new ConflictError('This workspace changed in another tab. Refresh and try again.');
    const result = await mutate(workspace);
    workspace.revision += 1;
    return { workspace, result };
  };
  if (!db) {
    if (process.env.VERCEL)
      throw new UnavailableError(
        'Saving is not connected yet. Add the database connection to enable edits.',
      );
    return localLock(id, async () => {
      const next = await update(await readLocal(id));
      const file = localPath(id);
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(next.workspace), { mode: 0o600 });
      await rename(tmp, file);
      return next;
    });
  }
  const connection = transaction ?? (await db.connect());
  try {
    if (!transaction) await connection.query('BEGIN');
    await connection.query(
      'INSERT INTO cet_workspaces (id,data) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [id, JSON.stringify(seedWorkspace())],
    );
    const current = await connection.query(
      'SELECT data FROM cet_workspaces WHERE id=$1 FOR UPDATE',
      [id],
    );
    const next = await update(current.rows[0].data);
    await connection.query('UPDATE cet_workspaces SET data=$2, updated_at=now() WHERE id=$1', [
      id,
      JSON.stringify(next.workspace),
    ]);
    if (!transaction) await connection.query('COMMIT');
    return next;
  } catch (error) {
    if (!transaction) await connection.query('ROLLBACK');
    throw error;
  } finally {
    if (!transaction) connection.release();
  }
}
export class ConflictError extends Error {}
export class UnavailableError extends Error {}
