import { getAuth, accountsConfigured } from '@/lib/auth';
export const runtime = 'nodejs';
async function handler(request: Request) {
  if (!accountsConfigured())
    return Response.json(
      { error: 'Hospital accounts are still being connected. Please explore the demo.' },
      { status: 503 },
    );
  try {
    if (request.method === 'POST') {
      const raw = await request.clone().text();
      if (raw.length > 10000)
        return Response.json({ error: 'This account request is too large.' }, { status: 413 });
      if (new URL(request.url).pathname.endsWith('/sign-up/email')) {
        const body = JSON.parse(raw);
        if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80)
          return Response.json(
            { error: 'Use a name between 2 and 80 characters.' },
            { status: 400 },
          );
      }
    }
    return await getAuth().handler(request);
  } catch {
    return Response.json(
      { error: 'Account service is temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }
}
export const GET = handler;
export const POST = handler;
