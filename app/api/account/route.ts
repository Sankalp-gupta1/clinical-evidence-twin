import { accountsConfigured, emailConfigured } from '@/lib/auth';
import { signedInUser, hospitalsFor } from '@/lib/hospitals';
import { AccessError } from '@/lib/permissions';
import { getPool } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const base = {
    configured: accountsConfigured(),
    emailEnabled: emailConfigured(),
    user: null,
    hospitals: [],
    requests: [],
  };
  const headers = { 'Cache-Control': 'no-store' };
  if (!base.configured) return Response.json(base, { headers });
  try {
    const user = await signedInUser(request.headers);
    const requests = await getPool()!.query(
      'SELECT r.id,h.name AS "hospitalName",r.status,r.created_at AS "createdAt" FROM cet_join_requests r JOIN cet_hospitals h ON h.id=r.hospital_id WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 20',
      [user.id],
    );
    return Response.json(
      { ...base, user, hospitals: await hospitalsFor(user.id), requests: requests.rows },
      { headers },
    );
  } catch (e) {
    if (e instanceof AccessError && e.status === 401) return Response.json(base, { headers });
    return Response.json(
      { error: 'Your account could not be loaded. Please try again.' },
      { status: 503, headers },
    );
  }
}
