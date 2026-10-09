'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  FileText,
  Home,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { AccountResponse, HospitalSummary, HospitalRole } from '@/lib/permissions';
import { ProductBrand, SetupNotice, SignOutButton } from './account-ui';
import { Modal } from './primitives';
import { authClient } from '@/lib/auth-client';

type Team = {
  hospital: HospitalSummary;
  joinCode: string | null;
  members: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    role: HospitalRole;
  }[];
  requests: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    note: string;
    createdAt: string;
  }[];
  audit: { id: string; actor: string; action: string; detail: string; at: string }[];
};
export default function HospitalHub({ setup = false }: { setup?: boolean }) {
  const teamRequest = useRef(0);
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(!setup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<'workspaces' | 'team' | 'account'>('workspaces');
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Clinical review');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [roles, setRoles] = useState<Record<string, 'viewer' | 'reviewer'>>({});
  const [remove, setRemove] = useState<Team['members'][number] | null>(null);
  async function loadAccount() {
    setLoading(true);
    try {
      const r = await fetch('/api/account', { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (data.configured && !data.user) {
        window.location.assign('/sign-in');
        return;
      }
      setAccount(data);
      setSelected((s) => s ?? data.hospitals[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your account.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!setup) void loadAccount();
  }, [setup]);
  async function loadTeam(id: string) {
    const request = ++teamRequest.current;
    setTeam(null);
    try {
      const r = await fetch(`/api/hospital?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (request === teamRequest.current) setTeam(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the team.');
    }
  }
  useEffect(() => {
    if (selected) void loadTeam(selected);
  }, [selected]);
  async function act(action: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/hospital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setNotice(data.message);
      await loadAccount();
      if (data.hospitalId) setSelected(data.hospitalId);
      else if (selected) await loadTeam(selected);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const hospital = account?.hospitals.find((h) => h.id === selected);
  const firstName = account?.user?.name.split(' ')[0] ?? 'there';
  return (
    <div className="hospital-app">
      <header className="hospital-header">
        <ProductBrand />
        <div>
          <span className="pilot-tag">
            <span /> Hospital pilot
          </span>
          {account?.user ? (
            <SignOutButton />
          ) : (
            <Link href="/sign-in" className="button secondary">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <div className="hospital-layout">
        <aside className="hospital-nav">
          <div className="nav-label">YOUR ORGANIZATION</div>
          {[
            { id: 'workspaces', label: 'My hospitals', icon: Building2 },
            { id: 'team', label: 'Team & access', icon: Users },
            { id: 'account', label: 'My account', icon: ShieldCheck },
          ].map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'selected' : ''}
              onClick={() => setTab(t.id as typeof tab)}
            >
              <t.icon size={19} />
              {t.label}
              {tab === t.id ? <ChevronRight size={16} /> : null}
            </button>
          ))}
          <div className="hospital-nav-note">
            <ShieldCheck size={23} />
            <strong>Start with a practice case.</strong>
            <p>All patients here are fictional. Your team’s notes stay in its own workspace.</p>
            <Link href="/demo">
              Open public demo <ArrowUpRight size={15} />
            </Link>
          </div>
          {account?.user ? (
            <div className="hub-user">
              <span>{account.user.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{account.user.name}</strong>
                <small>Signed in</small>
              </div>
            </div>
          ) : null}
        </aside>
        <main className="hospital-content">
          <div className="hub-heading">
            <div>
              <div className="eyebrow">
                {tab === 'workspaces'
                  ? 'YOUR REVIEW TEAM STARTS HERE'
                  : tab === 'team'
                    ? 'THE RIGHT ACCESS FOR EACH PERSON'
                    : 'YOUR PERSONAL ACCOUNT'}
              </div>
              <h1>
                {tab === 'workspaces'
                  ? `Good to see you, ${firstName}.`
                  : tab === 'team'
                    ? 'Team & access'
                    : 'Account & security'}
              </h1>
              <p>
                {tab === 'workspaces'
                  ? 'Choose your hospital, then open a case and follow the next step.'
                  : tab === 'team'
                    ? 'Manage who can view records and who can save a review.'
                    : 'Your name is attached to the reviews you save.'}
              </p>
            </div>
            {!setup && account?.user ? (
              <button
                className="button secondary"
                onClick={() => void loadAccount()}
                disabled={loading}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            ) : null}
          </div>
          {setup || account?.configured === false ? <SetupNotice /> : null}
          {error ? (
            <p className="account-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="account-success" role="status">
              <CheckCircle2 size={17} />
              {notice}
            </p>
          ) : null}
          {loading ? (
            <div className="hub-loading">
              <LoaderCircle className="spin" />
              Loading your hospital workspaces…
            </div>
          ) : null}
          {tab === 'workspaces' ? (
            <>
              <section className="getting-started">
                <div>
                  <span className="start-icon">
                    <ArrowRight size={23} />
                  </span>
                  <div>
                    <div className="section-kicker">YOUR NEXT STEP</div>
                    <h2>
                      {account?.hospitals.length
                        ? 'Open a case. Start with the differences.'
                        : 'Create or join your hospital.'}
                    </h2>
                    <p>
                      {account?.hospitals.length
                        ? 'Begin with Mira Sen’s practice case. Compare the allergy records, then save a note explaining what needs confirmation.'
                        : 'Set up a workspace if you lead the team. If a colleague has already set one up, ask them for its hospital code.'}
                    </p>
                  </div>
                </div>
                <button
                  className="button primary"
                  disabled={!account?.user}
                  onClick={() =>
                    account?.hospitals.length && selected
                      ? window.location.assign(`/workspace?hospital=${selected}`)
                      : setModal('create')
                  }
                >
                  {account?.hospitals.length ? 'Open workspace' : 'Create a hospital'}
                  <ArrowRight size={17} />
                </button>
              </section>
              <div className="onboarding-steps">
                <div className={account?.user ? 'done' : ''}>
                  <span>{account?.user ? <Check size={16} /> : '1'}</span>
                  <div>
                    <strong>Create your account</strong>
                    <small>Your name follows every review.</small>
                  </div>
                </div>
                <div className={account?.hospitals.length ? 'done' : ''}>
                  <span>{account?.hospitals.length ? <Check size={16} /> : '2'}</span>
                  <div>
                    <strong>Choose a hospital</strong>
                    <small>A separate workspace for your team.</small>
                  </div>
                </div>
                <div>
                  <span>3</span>
                  <div>
                    <strong>Review your first case</strong>
                    <small>The workspace guides you from here.</small>
                  </div>
                </div>
              </div>
              <div className="hub-section-heading">
                <h2>
                  My hospital workspaces <span>{account?.hospitals.length ?? 0}</span>
                </h2>
                <div>
                  <button
                    className="text-button"
                    disabled={!account?.user}
                    onClick={() => setModal('join')}
                  >
                    Join a hospital
                  </button>
                  <button
                    className="button secondary"
                    disabled={!account?.user}
                    onClick={() => setModal('create')}
                  >
                    <Plus size={16} />
                    New hospital
                  </button>
                </div>
              </div>
              <div className="hospital-card-grid">
                {account?.hospitals.map((h) => (
                  <article key={h.id} className="hospital-card">
                    <div className="hospital-card-top">
                      <span>
                        <Building2 size={25} />
                      </span>
                      <span className={`role-badge role-${h.role}`}>{h.role}</span>
                    </div>
                    <h3>{h.name}</h3>
                    <p>{h.department}</p>
                    <div className="hospital-card-note">
                      <ShieldCheck size={15} />
                      Private team workspace · fictional cases
                    </div>
                    <Link className="button primary" href={`/workspace?hospital=${h.id}`}>
                      Open workspace
                      <ArrowRight size={17} />
                    </Link>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelected(h.id);
                        setTab('team');
                      }}
                    >
                      Team & access <ArrowUpRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
              {!account?.hospitals.length ? (
                <div className="hub-empty">
                  <Building2 size={35} />
                  <h3>Your hospital will appear here.</h3>
                  <p>
                    Create a workspace or request access to an existing team. The owner approves
                    every new member.
                  </p>
                </div>
              ) : null}
              {account?.requests.length ? (
                <section className="hub-panel">
                  <h2>My access requests</h2>
                  {account.requests.map((r) => (
                    <div className="request-status" key={r.id}>
                      <Clock3 size={19} />
                      <div>
                        <strong>{r.hospitalName}</strong>
                        <small>
                          {r.status === 'pending'
                            ? 'Waiting for the owner. Use Refresh after they approve.'
                            : r.status === 'approved'
                              ? 'Approved — your hospital is listed above.'
                              : 'The owner declined this request. Contact your team for help.'}
                        </small>
                      </div>
                      <span className="role-badge">{r.status}</span>
                    </div>
                  ))}
                </section>
              ) : null}
            </>
          ) : null}
          {tab === 'team' ? (
            <>
              {account?.hospitals.length ? (
                <>
                  <label className="field-label hospital-select">
                    Hospital
                    <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}>
                      {account.hospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {team && team.hospital.id === selected ? (
                    <>
                      <section className="team-summary">
                        <div>
                          <Building2 size={28} />
                          <div>
                            <h2>{team.hospital.name}</h2>
                            <p>
                              {team.hospital.department} · {team.members.length} team member
                              {team.members.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                        <Link
                          className="button primary"
                          href={`/workspace?hospital=${team.hospital.id}`}
                        >
                          Open workspace
                          <ArrowUpRight size={16} />
                        </Link>
                      </section>
                      {team.joinCode ? (
                        <section className="join-code-card">
                          <div>
                            <h3>Add your colleagues</h3>
                            <p>
                              Share this code yourself. They sign in, choose “Join a hospital”, and
                              request access. The code alone never grants access.
                            </p>
                          </div>
                          <div>
                            <code>{team.joinCode}</code>
                            <button
                              className="button secondary"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(team.joinCode!);
                                  setNotice('Hospital code copied. Share it with your colleague.');
                                } catch {
                                  setError('Could not copy. Select the code and copy it manually.');
                                }
                              }}
                            >
                              <ClipboardCopy size={16} />
                              Copy code
                            </button>
                          </div>
                        </section>
                      ) : null}
                      {team.hospital.role === 'owner' ? (
                        <section className="hub-panel">
                          <div className="hub-section-heading">
                            <h2>
                              Access requests <span>{team.requests.length}</span>
                            </h2>
                            <ShieldCheck size={20} />
                          </div>
                          <p className="form-hint">
                            Confirm each person with your team outside this app before approving. A
                            submitted name or email does not prove their identity.
                          </p>
                          {team.requests.length ? (
                            team.requests.map((r) => (
                              <article className="access-request" key={r.id}>
                                <div>
                                  <strong>{r.name}</strong>
                                  <small>
                                    {r.email} ·{' '}
                                    {r.emailVerified ? 'Email verified' : 'Email not verified'}
                                  </small>
                                  <p>{r.note}</p>
                                </div>
                                <label className="checkbox-line">
                                  <input
                                    type="checkbox"
                                    checked={!!verified[r.id]}
                                    onChange={(e) =>
                                      setVerified({ ...verified, [r.id]: e.target.checked })
                                    }
                                  />
                                  I have confirmed this person is my colleague.
                                </label>
                                <div className="request-actions">
                                  <select
                                    aria-label={`Role for ${r.name}`}
                                    value={roles[r.id] ?? 'viewer'}
                                    onChange={(e) =>
                                      setRoles({
                                        ...roles,
                                        [r.id]: e.target.value as 'viewer' | 'reviewer',
                                      })
                                    }
                                  >
                                    <option value="viewer">Viewer — read and export</option>
                                    <option value="reviewer">Reviewer — save decisions</option>
                                  </select>
                                  <button
                                    className="button secondary"
                                    disabled={busy}
                                    onClick={() =>
                                      void act({
                                        type: 'decide',
                                        hospitalId: team.hospital.id,
                                        requestId: r.id,
                                        approve: false,
                                        role: 'viewer',
                                      })
                                    }
                                  >
                                    Decline
                                  </button>
                                  <button
                                    className="button primary"
                                    disabled={busy || !verified[r.id]}
                                    onClick={() =>
                                      void act({
                                        type: 'decide',
                                        hospitalId: team.hospital.id,
                                        requestId: r.id,
                                        approve: true,
                                        role: roles[r.id] ?? 'viewer',
                                      })
                                    }
                                  >
                                    Approve access
                                    <Check size={16} />
                                  </button>
                                </div>
                              </article>
                            ))
                          ) : (
                            <div className="small-empty">
                              <CheckCircle2 size={22} />
                              <p>No requests waiting. You’re up to date.</p>
                            </div>
                          )}
                        </section>
                      ) : null}
                      <section className="hub-panel">
                        <h2>Team members</h2>
                        <div className="team-table-wrap">
                          <table className="team-table">
                            <thead>
                              <tr>
                                <th>Person</th>
                                <th>Role</th>
                                <th>Access</th>
                                {team.hospital.role === 'owner' ? (
                                  <th>
                                    <span className="sr-only">Manage</span>
                                  </th>
                                ) : null}
                              </tr>
                            </thead>
                            <tbody>
                              {team.members.map((m) => (
                                <tr key={m.id}>
                                  <td>
                                    <strong>
                                      {m.name}
                                      {m.id === account.user?.id ? ' (you)' : ''}
                                    </strong>
                                    <small>{m.email}</small>
                                  </td>
                                  <td>
                                    {team.hospital.role === 'owner' && m.role !== 'owner' ? (
                                      <select
                                        aria-label={`Change role for ${m.name}`}
                                        value={m.role}
                                        disabled={busy}
                                        onChange={(e) =>
                                          void act({
                                            type: 'role',
                                            hospitalId: team.hospital.id,
                                            memberId: m.id,
                                            role: e.target.value,
                                          })
                                        }
                                      >
                                        <option value="viewer">Viewer</option>
                                        <option value="reviewer">Reviewer</option>
                                      </select>
                                    ) : (
                                      <span className={`role-badge role-${m.role}`}>{m.role}</span>
                                    )}
                                  </td>
                                  <td>
                                    {m.role === 'owner'
                                      ? 'Manage team & review'
                                      : m.role === 'reviewer'
                                        ? 'Read, review & export'
                                        : 'Read & export'}
                                  </td>
                                  {team.hospital.role === 'owner' ? (
                                    <td>
                                      {m.role !== 'owner' ? (
                                        <button
                                          className="text-button danger-text"
                                          disabled={busy}
                                          onClick={() => setRemove(m)}
                                        >
                                          Remove
                                        </button>
                                      ) : null}
                                    </td>
                                  ) : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                      {team.audit.length ? (
                        <section className="hub-panel">
                          <h2>Access history</h2>
                          <div className="access-history">
                            {team.audit.map((a) => (
                              <div key={a.id}>
                                <span>
                                  <ShieldCheck size={15} />
                                </span>
                                <div>
                                  <strong>{a.action}</strong>
                                  <p>
                                    {a.actor} · {new Date(a.at).toLocaleString()}
                                  </p>
                                  <small>{a.detail}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </>
                  ) : (
                    <div className="hub-loading">
                      <LoaderCircle className="spin" />
                      Loading your team…
                    </div>
                  )}
                </>
              ) : (
                <div className="hub-empty">
                  <Users size={35} />
                  <h3>Join a hospital first.</h3>
                  <p>Your team and access settings will appear here.</p>
                  <button
                    className="button primary"
                    disabled={!account?.user}
                    onClick={() => {
                      setTab('workspaces');
                      setModal('create');
                    }}
                  >
                    Create a hospital
                  </button>
                </div>
              )}
            </>
          ) : null}
          {tab === 'account' && account?.user ? (
            <>
              <section className="hub-panel account-profile">
                <span className="large-initials">
                  {account.user.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h2>{account.user.name}</h2>
                  <p>{account.user.email}</p>
                  <span className="role-badge">
                    {account.user.emailVerified ? 'Email verified' : 'Email not verified'}
                  </span>
                </div>
              </section>
              <ChangePassword />
              <section className="hub-panel">
                <h2>About this pilot</h2>
                <p>
                  Your hospital records and saved decisions are separated by team membership. Only
                  an owner can approve or remove colleagues. This pilot is limited to fictional
                  records and has not been validated for patient care.
                </p>
                <p className="form-hint">
                  {account.emailEnabled
                    ? 'Email verification and password recovery are connected.'
                    : 'Email delivery is not connected. Team access uses an owner-approved request, not an email invitation. Keep your password in a password manager.'}
                </p>
              </section>
            </>
          ) : null}
          <footer className="hub-footer">
            <ShieldCheck size={15} /> Evidence organization only. Patient care remains with
            qualified clinicians.
          </footer>
        </main>
      </div>
      {modal ? (
        <Modal
          title={modal === 'create' ? 'Create your hospital workspace' : 'Join your hospital'}
          kicker={modal === 'create' ? 'Step 2 · Set up your team' : 'Step 2 · Request access'}
          onClose={() => {
            setModal(null);
            setError('');
          }}
        >
          <p className="modal-intro">
            {modal === 'create'
              ? 'You will be the workspace owner. Your team starts with three fictional practice cases.'
              : 'Ask your hospital owner for the code. They will review your request before you can see the workspace.'}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await act(
                modal === 'create'
                  ? { type: 'create', name, department }
                  : { type: 'request', code: code.trim().toLowerCase(), note },
              );
              if (ok) {
                setModal(null);
                setName('');
                setCode('');
                setNote('');
              }
            }}
          >
            {modal === 'create' ? (
              <>
                <label className="field-label">
                  Hospital or team name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={3}
                    maxLength={80}
                    placeholder="e.g. Riverside review team"
                  />
                </label>
                <label className="field-label">
                  Department
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="field-label">
                  Hospital code
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    minLength={32}
                    maxLength={32}
                    autoComplete="off"
                    placeholder="Paste the code from your hospital owner"
                  />
                </label>
                <label className="field-label">
                  Introduce yourself
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    required
                    minLength={12}
                    maxLength={500}
                    placeholder="Your department and role, so the owner can confirm who you are."
                  />
                </label>
              </>
            )}
            {error ? (
              <p role="alert" className="account-error">
                {error}
              </p>
            ) : null}
            <div className="modal-footer">
              <span>Fictional records only</span>
              <button className="button primary" disabled={busy}>
                {busy ? 'Saving…' : modal === 'create' ? 'Create workspace' : 'Request access'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {remove ? (
        <Modal
          title="Remove team access?"
          kicker="Hospital owner action"
          onClose={() => setRemove(null)}
        >
          <p>
            {remove.name} will no longer be able to open this hospital. Their previous review notes
            will remain in its history.
          </p>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setRemove(null)}>
              Keep access
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (await act({ type: 'remove', hospitalId: selected, memberId: remove.id }))
                  setRemove(null);
              }}
            >
              Remove access
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <section className="hub-panel password-panel">
      <h2>Change password</h2>
      <p>This signs out your other sessions.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (next !== confirm) {
            setMessage('The new passwords do not match.');
            return;
          }
          setBusy(true);
          try {
            const r = await authClient.changePassword({
              currentPassword: current,
              newPassword: next,
              revokeOtherSessions: true,
            });
            if (r.error)
              throw new Error('Password could not be changed. Check your current password.');
            setCurrent('');
            setNext('');
            setConfirm('');
            setMessage('Password updated. Other sessions are signed out.');
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="field-label">
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </label>
        <label className="field-label">
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <p role="status">{message}</p>
        <button className="button primary" disabled={busy}>
          Update password
        </button>
      </form>
    </section>
  );
}
