'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Layers3,
  LogOut,
  ShieldCheck,
  CircleHelp,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Building2,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function ProductBrand() {
  return (
    <Link href="/" className="public-brand">
      <span>
        <Layers3 size={26} />
      </span>
      <strong>
        Clinical<span>Evidence Twin</span>
      </strong>
    </Link>
  );
}
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error();
            window.location.replace('/sign-in?signedOut=1');
          } catch {
            setError('Sign out failed. Please try again.');
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} />
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? (
        <span role="alert" className="account-error">
          {error}
        </span>
      ) : null}
    </>
  );
}
export function SetupNotice() {
  return (
    <div className="setup-notice">
      <CircleHelp size={21} />
      <div>
        <strong>Hospital accounts are being connected.</strong>
        <p>
          The sample workspace is ready to explore. Account creation and saved team reviews will
          open after the database setup is complete.
        </p>
        <Link href="/demo">
          Explore the sample workspace <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
export function AuthForm({
  mode,
  ready,
  emailEnabled,
}: {
  mode: 'sign-in' | 'sign-up' | 'reset';
  ready: boolean;
  emailEnabled: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const signup = mode === 'sign-up';
  const reset = mode === 'reset';
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!ready) return;
    if (signup && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (reset) {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password',
        });
        if (result.error)
          throw new Error('We could not request a reset right now. Please try again.');
        setNotice(
          'If an account exists for this email, a password reset link will arrive shortly.',
        );
      } else {
        const result = signup
          ? await authClient.signUp.email({ name: name.trim(), email, password })
          : await authClient.signIn.email({ email, password });
        if (result.error)
          throw new Error(
            signup
              ? 'We could not create this account. Try signing in if you already registered, or try again later.'
              : 'We could not sign you in. Check your email and password, or try again in a minute.',
          );
        window.location.assign('/hospital');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-story">
        <ProductBrand />
        <div className="auth-story-body">
          <div className="label-pill">
            <ShieldCheck size={14} /> A workspace for your review team
          </div>
          <h1>
            The full story.
            <br />
            <em>A clearer next step.</em>
          </h1>
          <p>
            Bring records, questions, and review decisions together. Keep the original evidence one
            click away.
          </p>
          <div className="auth-story-card">
            <div className="mini-patient">
              <span>MS</span>
              <div>
                <strong>Mira Sen</strong>
                <small>Fictional training case</small>
              </div>
              <span className="live-dot" />
            </div>
            <div className="mini-source">
              <FileIcon />
              <div>
                <strong>Two records disagree</strong>
                <small>Compare the original statements first.</small>
              </div>
            </div>
            <div className="mini-source">
              <Check size={18} />
              <div>
                <strong>Your review stays connected</strong>
                <small>Who reviewed it, why, and which source.</small>
              </div>
            </div>
          </div>
        </div>
        <p className="auth-caption">Hospital pilot · fictional records only</p>
      </div>
      <div className="auth-form-panel">
        <Link className="back-link" href="/">
          ← Back to the overview
        </Link>
        <div className="auth-form-wrap">
          <div className="eyebrow">YOUR TEAM. YOUR WORKSPACE.</div>
          <h2>
            {reset ? 'Reset your password' : signup ? 'Create your account' : 'Welcome back.'}
          </h2>
          <p>
            {reset
              ? 'We will email you a link to choose a new password.'
              : signup
                ? 'Start with your account. Set up your hospital on the next screen.'
                : 'Sign in to continue your team’s evidence review.'}
          </p>
          {!ready ? <SetupNotice /> : null}
          <form onSubmit={submit}>
            {signup ? (
              <label className="field-label">
                Your full name
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  placeholder="How your team knows you"
                  required
                  disabled={!ready}
                />
              </label>
            ) : null}
            <label className="field-label">
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                placeholder="you@hospital.org"
                required
                disabled={!ready}
              />
            </label>
            {!reset ? (
              <label className="field-label">
                Password
                <div className="password-field">
                  <input
                    type={visible ? 'text' : 'password'}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={signup ? 12 : 1}
                    maxLength={128}
                    placeholder={signup ? 'At least 12 characters' : 'Enter your password'}
                    required
                    disabled={!ready}
                  />
                  <button
                    type="button"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            ) : null}
            {signup ? (
              <>
                <label className="field-label">
                  Confirm password
                  <input
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={!ready}
                  />
                </label>
                <p className="form-hint">
                  This pilot is for fictional training records. Please keep real patient information
                  out of it.
                </p>
              </>
            ) : null}
            {error ? (
              <p className="account-error" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="account-success" role="status">
                {notice}
              </p>
            ) : null}
            <button
              className="button primary wide-button"
              disabled={busy || !ready || (reset && !emailEnabled)}
            >
              {busy ? <LoaderCircle size={18} className="spin" /> : null}
              {reset ? 'Send reset link' : signup ? 'Create account' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          {reset && !emailEnabled ? (
            <p className="form-hint">
              Password reset emails are not connected yet. Your hospital owner cannot see or reset
              your password.
            </p>
          ) : null}
          {!signup && !reset ? (
            <>
              {emailEnabled ? (
                <Link href="/forgot-password" className="text-button">
                  Forgot your password?
                </Link>
              ) : (
                <p className="form-hint">
                  Keep your password safe. Email recovery is not connected in this pilot yet.
                </p>
              )}
            </>
          ) : null}
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to the workspace?'}{' '}
            <Link href={signup ? '/sign-in' : '/sign-up'}>
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <div className="auth-demo-link">
            <span>Just looking around?</span>
            <Link href="/demo">
              Try the demo without an account <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <footer>
          <ShieldCheck size={15} /> Passwords are protected. Hospital access is checked on every
          request.
        </footer>
      </div>
    </main>
  );
}
function FileIcon() {
  return <Building2 size={18} />;
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  return (
    <div className="public-page">
      <header className="public-header">
        <ProductBrand />
      </header>
      <main className="reset-card">
        <h1>Choose a new password</h1>
        <p>Use at least 12 characters. Your existing sessions will be signed out.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirm) {
              setMessage('The passwords do not match.');
              return;
            }
            setBusy(true);
            try {
              const token = new URLSearchParams(window.location.search).get('token');
              if (!token)
                throw new Error('This reset link is missing its token. Request a new link.');
              const r = await authClient.resetPassword({ newPassword: password, token });
              if (r.error)
                throw new Error('This reset link is invalid or expired. Request a new link.');
              setDone(true);
              setMessage('Password updated. You can sign in now.');
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field-label">
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          <p role="status">{message}</p>
          {done ? (
            <Link href="/sign-in" className="button primary">
              Sign in
            </Link>
          ) : (
            <button className="button primary" disabled={busy}>
              Save new password
            </button>
          )}
        </form>
      </main>
    </div>
  );
}
