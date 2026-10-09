import { signedInUser, withHospital, hospitalAction, hospitalActionSchema } from '@/lib/hospitals';
import { AccessError } from '@/lib/permissions';
import { verifyOrigin } from '@/lib/session';
import { UnavailableError } from '@/lib/store';
import { ZodError } from 'zod';
export const dynamic = 'force-dynamic';
function failure(e: unknown) {
  if (e instanceof AccessError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof UnavailableError) return Response.json({ error: e.message }, { status: 503 });
  if (e instanceof ZodError)
    return Response.json(
      {
        error: e.issues
          .map((i) => i.message)
          .slice(0, 2)
          .join(' '),
      },
      { status: 400 },
    );
  return Response.json(
    { error: 'The hospital request could not be completed. Please try again.' },
    { status: 400 },
  );
}
export async function GET(request: Request) {
  try {
    const user = await signedInUser(request.headers);
    return await withHospital(
      user,
      new URL(request.url).searchParams.get('id') ?? '',
      'read',
      async (db, hospital) => {
        const members = await db.query(
          'SELECT m.user_id AS id,u.name,u.email,u."emailVerified",m.role,m.created_at AS "joinedAt" FROM cet_members m JOIN "user" u ON u.id=m.user_id WHERE m.hospital_id=$1 ORDER BY m.created_at',
          [hospital.id],
        );
        const requests =
          hospital.role === 'owner'
            ? await db.query(
                'SELECT r.id,u.name,u.email,u."emailVerified",r.note,r.created_at AS "createdAt" FROM cet_join_requests r JOIN "user" u ON u.id=r.user_id WHERE r.hospital_id=$1 AND r.status=\'pending\' ORDER BY r.created_at',
                [hospital.id],
              )
            : { rows: [] };
        const audit =
          hospital.role === 'owner'
            ? await db.query(
                'SELECT id,actor_name AS actor,action,detail,created_at AS at FROM cet_access_audit WHERE hospital_id=$1 ORDER BY created_at DESC LIMIT 50',
                [hospital.id],
              )
            : { rows: [] };
        const code =
          hospital.role === 'owner'
            ? await db.query('SELECT join_code FROM cet_hospitals WHERE id=$1', [hospital.id])
            : { rows: [] };
        return Response.json(
          {
            hospital,
            members: members.rows,
            requests: requests.rows,
            audit: audit.rows,
            joinCode: code.rows[0]?.join_code ?? null,
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await signedInUser(request.headers);
    const raw = await request.text();
    if (raw.length > 5000) throw new AccessError('This request is too large.', 413);
    return Response.json(await hospitalAction(user, hospitalActionSchema.parse(JSON.parse(raw))));
  } catch (e) {
    return failure(e);
  }
}
