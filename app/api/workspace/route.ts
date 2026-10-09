import { patients, seedWorkspace } from '@/data/patients';
import { signedInUser, withHospital } from '@/lib/hospitals';
import { AccessError } from '@/lib/permissions';
import { runtimeInfo } from '@/lib/service';
import { readWorkspace, UnavailableError } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  // The public demo is always read-only, even when the database is connected.
  if (new URL(request.url).searchParams.get('demo') === 'true')
    return Response.json(
      {
        workspace: seedWorkspace(),
        patients,
        runtime: {
          storage: 'Read-only preview',
          ai: false,
          model: null,
          mcp: false,
          checkpoint: 'Sign in to run and save evidence checks',
        },
      },
      { headers },
    );
  try {
    const user = await signedInUser(request.headers);
    const id = new URL(request.url).searchParams.get('hospitalId') ?? '';
    return await withHospital(user, id, 'read', async (db, hospital) =>
      Response.json(
        {
          workspace: await readWorkspace(hospital.id, db),
          patients,
          runtime: runtimeInfo(),
          access: { user, hospital },
        },
        { headers },
      ),
    );
  } catch (e) {
    if (e instanceof AccessError)
      return Response.json({ error: e.message }, { status: e.status, headers });
    if (e instanceof UnavailableError)
      return Response.json({ error: e.message }, { status: 503, headers });
    return Response.json(
      { error: 'The saved workspace could not be loaded. Please try again.' },
      { status: 503, headers },
    );
  }
}
