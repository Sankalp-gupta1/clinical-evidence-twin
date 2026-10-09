import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { getPool, UnavailableError } from './store';

export function accountsConfigured() {
  return !!process.env.DATABASE_URL && (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32;
}
export function emailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}
async function sendAccountEmail(to: string, url: string, kind: 'reset' | 'verify') {
  if (!emailConfigured()) throw new UnavailableError('Account email delivery is not connected.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject:
        kind === 'reset'
          ? 'Reset your Clinical Evidence Twin password'
          : 'Verify your email address',
      text: `${kind === 'reset' ? 'Reset your password' : 'Verify your email address'} using this link:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    }),
  });
  if (!response.ok) throw new Error('Account email could not be sent.');
}
// Lazy construction keeps an unconfigured deployment usable as a public, read-only demo.
function createAuth() {
  if (!accountsConfigured())
    throw new UnavailableError(
      'Hospital accounts are still being connected. You can explore the demo now.',
    );
  return betterAuth({
    appName: 'Clinical Evidence Twin',
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: getPool()!,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      ...(emailConfigured()
        ? {
            sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) =>
              sendAccountEmail(user.email, url, 'reset'),
          }
        : {}),
    },
    ...(emailConfigured()
      ? {
          emailVerification: {
            sendOnSignUp: true,
            sendVerificationEmail: async ({
              user,
              url,
            }: {
              user: { email: string };
              url: string;
            }) => sendAccountEmail(user.email, url, 'verify'),
          },
        }
      : {}),
    // Read every session from the database: signing out/revoking access takes effect immediately.
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 30, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 3600, max: 5 },
        '/request-password-reset': { window: 3600, max: 3 },
      },
    },
    user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    plugins: [nextCookies()],
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
