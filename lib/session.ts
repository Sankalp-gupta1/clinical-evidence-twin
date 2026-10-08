import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { UnavailableError } from './store';
const COOKIE = 'cet_workspace_v1';
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.VERCEL)
    throw new UnavailableError('Workspace sessions need a server secret before saving is enabled.');
  return 'local-development-only-do-not-use-on-a-hosted-service';
}
function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}
export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const [id, signature] = value.split('.');
  if (!/^[a-f0-9-]{36}$/.test(id ?? '') || !signature) return null;
  const expected = sign(id);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
export async function workspaceSession() {
  const jar = await cookies();
  // A read-only preview has no private state and needs no session secret.
  if (process.env.VERCEL && !process.env.SESSION_SECRET)
    return '00000000-0000-4000-8000-000000000000';
  const existing = verifySession(jar.get(COOKIE)?.value);
  if (existing) return existing;
  const id = randomUUID();
  jar.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}
export function verifyOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error('This change must be made from the workspace website.');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite))
    throw new Error('Cross-site changes are not allowed.');
}
