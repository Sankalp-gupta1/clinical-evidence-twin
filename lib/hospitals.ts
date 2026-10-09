import { randomUUID, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { getAuth } from './auth';
import { getPool, UnavailableError } from './store';
import {
  AccessError,
  requirePermission,
  type AccountUser,
  type HospitalSummary,
  type HospitalPermission,
} from './permissions';

export async function signedInUser(requestHeaders?: Headers): Promise<AccountUser> {
  const session = await getAuth().api.getSession({ headers: requestHeaders ?? (await headers()) });
  if (!session) throw new AccessError('Please sign in to open your hospital workspace.', 401);
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  };
}
export async function hospitalsFor(userId: string): Promise<HospitalSummary[]> {
  const result = await getPool()!.query(
    `SELECT h.id,h.name,h.department,h.created_at AS "createdAt",m.role FROM cet_hospitals h JOIN cet_members m ON m.hospital_id=h.id WHERE m.user_id=$1 ORDER BY h.created_at`,
    [userId],
  );
  return result.rows;
}
// A membership row stays locked through each write. Removing a member cannot race a saved decision.
export async function withHospital<T>(
  user: AccountUser,
  hospitalId: string,
  permission: HospitalPermission,
  work: (db: PoolClient, hospital: HospitalSummary) => Promise<T>,
): Promise<T> {
  if (!z.string().uuid().safeParse(hospitalId).success)
    throw new AccessError('Choose a hospital you belong to.', 400);
  const db = await getPool()!.connect();
  try {
    await db.query('BEGIN');
    const member = await db.query(
      `SELECT h.id,h.name,h.department,h.created_at AS "createdAt",m.role FROM cet_hospitals h JOIN cet_members m ON m.hospital_id=h.id WHERE h.id=$1 AND m.user_id=$2 ${permission === 'manage' ? 'FOR UPDATE OF m' : 'FOR SHARE OF m'}`,
      [hospitalId, user.id],
    );
    const hospital = member.rows[0] as HospitalSummary | undefined;
    requirePermission(hospital?.role, permission);
    const result = await work(db, hospital!);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
export const hospitalActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create'),
    name: z.string().trim().min(3).max(80),
    department: z.string().trim().min(2).max(80),
  }),
  z.object({
    type: z.literal('request'),
    code: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{32}$/),
    note: z.string().trim().min(12).max(500),
  }),
  z.object({
    type: z.literal('decide'),
    hospitalId: z.string().uuid(),
    requestId: z.string().uuid(),
    approve: z.boolean(),
    role: z.enum(['reviewer', 'viewer']),
  }),
  z.object({
    type: z.literal('role'),
    hospitalId: z.string().uuid(),
    memberId: z.string(),
    role: z.enum(['reviewer', 'viewer']),
  }),
  z.object({ type: z.literal('remove'), hospitalId: z.string().uuid(), memberId: z.string() }),
]);
export async function hospitalAction(
  user: AccountUser,
  action: z.infer<typeof hospitalActionSchema>,
) {
  const pool = getPool();
  if (!pool) throw new UnavailableError('Hospital storage is not connected.');
  if (action.type === 'create') {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // Lock the user row to serialize simultaneous organization creation requests.
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user.id]);
      const count = await db.query(
        "SELECT count(*)::int AS n FROM cet_members WHERE user_id=$1 AND role='owner'",
        [user.id],
      );
      if (count.rows[0].n >= 3)
        throw new AccessError('You can create up to three pilot workspaces.', 400);
      const id = randomUUID();
      await db.query(
        'INSERT INTO cet_hospitals(id,name,department,join_code) VALUES($1,$2,$3,$4)',
        [id, action.name, action.department, randomBytes(16).toString('hex')],
      );
      await db.query("INSERT INTO cet_members(hospital_id,user_id,role) VALUES($1,$2,'owner')", [
        id,
        user.id,
      ]);
      await accessAudit(db, id, user, 'Workspace created', action.name);
      await db.query('COMMIT');
      return { message: 'Your hospital workspace is ready.', hospitalId: id };
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }
  if (action.type === 'request') {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user.id]);
      const pending = await db.query(
        "SELECT count(*)::int AS n FROM cet_join_requests WHERE user_id=$1 AND created_at>now()-interval '1 day'",
        [user.id],
      );
      if (pending.rows[0].n >= 10)
        throw new AccessError('Please wait before sending another access request.', 429);
      const h = await db.query('SELECT id FROM cet_hospitals WHERE join_code=$1', [action.code]);
      if (!h.rows[0])
        throw new AccessError(
          'That hospital code was not found. Check it with your hospital owner.',
          400,
        );
      const id = h.rows[0].id;
      const member = await db.query(
        'SELECT 1 FROM cet_members WHERE hospital_id=$1 AND user_id=$2',
        [id, user.id],
      );
      if (member.rowCount) throw new AccessError('You already belong to this hospital.', 400);
      await db.query(
        `INSERT INTO cet_join_requests(id,hospital_id,user_id,note) VALUES($1,$2,$3,$4) ON CONFLICT(hospital_id,user_id) DO UPDATE SET note=excluded.note,status='pending',created_at=now()`,
        [randomUUID(), id, user.id, action.note],
      );
      await accessAudit(db, id, user, 'Access requested', action.note);
      await db.query('COMMIT');
      return { message: 'Request sent. The hospital owner needs to approve your access.' };
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }
  return withHospital(user, action.hospitalId, 'manage', async (db, hospital) => {
    if (action.type === 'decide') {
      const req = await db.query(
        "SELECT * FROM cet_join_requests WHERE id=$1 AND hospital_id=$2 AND status='pending' FOR UPDATE",
        [action.requestId, hospital.id],
      );
      if (!req.rows[0])
        throw new AccessError(
          'This request has already been handled or is not in this hospital.',
          404,
        );
      if (action.approve) {
        const count = await db.query(
          'SELECT count(*)::int AS n FROM cet_members WHERE hospital_id=$1',
          [hospital.id],
        );
        if (count.rows[0].n >= 20)
          throw new AccessError('This pilot supports up to 20 team members.', 400);
        await db.query(
          'INSERT INTO cet_members(hospital_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [hospital.id, req.rows[0].user_id, action.role],
        );
      }
      await db.query('UPDATE cet_join_requests SET status=$2 WHERE id=$1', [
        action.requestId,
        action.approve ? 'approved' : 'declined',
      ]);
      await accessAudit(
        db,
        hospital.id,
        user,
        action.approve ? 'Access approved' : 'Access declined',
        `${req.rows[0].user_id} · ${action.approve ? action.role : 'declined'}`,
      );
      return { message: action.approve ? 'Team member approved.' : 'Access request declined.' };
    }
    const member = await db.query(
      'SELECT role FROM cet_members WHERE hospital_id=$1 AND user_id=$2 FOR UPDATE',
      [hospital.id, action.memberId],
    );
    if (!member.rows[0] || member.rows[0].role === 'owner' || action.memberId === user.id)
      throw new AccessError('The owner account cannot be changed here.');
    if (action.type === 'remove')
      await db.query('DELETE FROM cet_members WHERE hospital_id=$1 AND user_id=$2', [
        hospital.id,
        action.memberId,
      ]);
    else
      await db.query('UPDATE cet_members SET role=$3 WHERE hospital_id=$1 AND user_id=$2', [
        hospital.id,
        action.memberId,
        action.role,
      ]);
    await accessAudit(
      db,
      hospital.id,
      user,
      action.type === 'remove' ? 'Member access removed' : 'Member role changed',
      `${action.memberId}${action.type === 'role' ? ` · ${action.role}` : ''}`,
    );
    return {
      message: action.type === 'remove' ? 'Member access removed.' : 'Member role updated.',
    };
  });
}
async function accessAudit(
  db: PoolClient,
  hospitalId: string,
  user: AccountUser,
  action: string,
  detail: string,
) {
  await db.query(
    'INSERT INTO cet_access_audit(id,hospital_id,actor_id,actor_name,action,detail) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), hospitalId, user.id, user.name, action, detail],
  );
}
