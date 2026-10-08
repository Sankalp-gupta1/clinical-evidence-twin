'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  GitBranch,
  HelpCircle,
  Layers3,
  LayoutDashboard,
  Link2,
  ListChecks,
  LoaderCircle,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Waypoints,
  X,
} from 'lucide-react';
import { patients as initialPatients, seedWorkspace } from '@/data/patients';
import { analyze } from '@/lib/evidence';
import type { Analysis, Issue, Patient, Source, WorkspaceResponse, Run } from '@/lib/types';
import { Badge, Empty, Modal, Notice, SourceButton, SourceModal, formatDate } from './primitives';
import QuestionPanel from './question-panel';
import ReviewModal from './review-modal';
import ImportModal, { downloadText } from './import-modal';

type View = 'overview' | 'timeline' | 'records' | 'review' | 'memory' | 'workflow' | 'about';
const views: { id: View; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'timeline', label: 'Patient timeline', icon: Activity },
  { id: 'records', label: 'Source records', icon: FileText },
  { id: 'review', label: 'Needs review', icon: ListChecks },
  { id: 'memory', label: 'Saved memory', icon: Database },
  { id: 'workflow', label: 'Evidence workflow', icon: GitBranch },
];
const initial: WorkspaceResponse = {
  workspace: seedWorkspace(),
  patients: initialPatients,
  runtime: {
    storage: 'Read-only preview',
    ai: false,
    model: null,
    mcp: false,
    checkpoint: 'Checking connection…',
  },
};
export default function WorkspaceApp() {
  const [data, setData] = useState<WorkspaceResponse>(initial);
  const [patientId, setPatientId] = useState('demo-mira');
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [modal, setModal] = useState<'import' | 'guide' | 'export' | 'approve' | null>(null);
  const [source, setSource] = useState<{ record: Source; highlight?: string } | null>(null);
  const [review, setReview] = useState<Issue | null>(null);
  const [filter, setFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewer, setReviewer] = useState('Demo reviewer');
  const patient = data.patients.find((p) => p.id === patientId)!;
  const records = data.workspace.sources.filter((s) => s.patientId === patientId);
  const analysis = useMemo(
    () => analyze(data.workspace.sources, patient, data.workspace.decisions),
    [data.workspace.sources, data.workspace.decisions, patient],
  );
  const openIssues = analysis.issues.filter((i) => i.status === 'open');
  const runs = data.workspace.runs.filter((r) => r.patientId === patientId);
  const lastRun = runs.at(-1);
  const answers = data.workspace.answers[patientId] ?? [];
  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch('/api/workspace', { cache: 'no-store' });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      setData(next);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the saved workspace.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(next: View) {
    setView(next);
    setFilter('all');
    setNavOpen(false);
  }
  function selectPatient(id: string) {
    setPatientId(id);
    setFilter('all');
    setSearch('');
    setNavOpen(false);
    setReview(null);
    setSource(null);
    setModal(null);
    setView('overview');
  }
  function openSource(id: string, highlight?: string) {
    const record = data.workspace.sources.find((s) => s.id === id && s.patientId === patientId);
    if (record) setSource({ record, highlight });
  }
  async function act(action: Record<string, unknown>): Promise<boolean> {
    if (busy || loading) return false;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...action, revision: data.workspace.revision }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await refresh();
        throw new Error(result.error ?? 'The action could not be saved.');
      }
      setData((prev) => ({ ...prev, workspace: result.workspace, runtime: result.runtime }));
      setToast(result.result.message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || loading;
  const exportBrief = () =>
    `# Evidence review — ${patient.name}\n\nSynthetic demonstration case · ${patient.id}\nExported ${new Date().toISOString()}\n\n## Scope\nEvidence organization only. No diagnosis, prescription, or treatment recommendation.\n\n## Record coverage\n${records.length} records; ${analysis.evidence.length} statements; ${openIssues.length} open review items.\n\n## Review items\n${analysis.issues.map((issue) => `### ${issue.title}\nStatus: ${issue.status}\n${issue.detail}\n${issue.evidence.map((e) => `- [${e.sourceId}] ${e.excerpt}`).join('\n')}`).join('\n\n')}\n\n## Reviewer notes\n${
      data.workspace.decisions
        .filter((d) => d.patientId === patientId)
        .map(
          (d) =>
            `- ${d.createdAt}: ${d.reviewer} — ${d.note} (${d.outcome}). Sources: ${d.sourceIds.join(', ')}`,
        )
        .join('\n') || 'No reviewer decisions recorded.'
    }\n\n## Sources\n${records.map((s) => `### ${s.id} — ${s.title}\n${s.organization} · entered ${s.recordedAt}\n\n${s.text}`).join('\n\n')}`;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? 'is-open' : ''}`}>
        <a className="brand" href="/" aria-label="Clinical Evidence Twin home">
          <span className="brand-mark">
            <Layers3 size={25} />
          </span>
          <span>
            Clinical<span>Evidence Twin</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            <Users size={18} />
          </span>
          <div>
            <strong>Research workspace</strong>
            <small>Synthetic cases only</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace pages">
          {views.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={view === id ? 'active' : ''}
              aria-current={view === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'review' && openIssues.length ? (
                <b className="nav-count">{openIssues.length}</b>
              ) : null}
              {view === id ? <span className="active-dot" /> : null}
            </button>
          ))}
        </nav>
        <div className="nav-label patient-nav-heading">
          DEMO PATIENTS <Badge>{data.patients.length}</Badge>
        </div>
        <div className="patient-nav">
          {data.patients.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPatient(p.id)}
              className={patientId === p.id ? 'selected' : ''}
            >
              <span className={`patient-avatar avatar-${p.color}`}>{p.initials}</span>
              <span>
                <strong>{p.name}</strong>
                <small>{p.age} years · fictional case</small>
              </span>
              {patientId === p.id ? <Check size={15} /> : null}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={19} />
            <strong>Built for a second look.</strong>
            <p>
              Keep the evidence close.
              <br />
              Keep a human in charge.
            </p>
          </div>
          <button
            className={view === 'about' ? 'bottom-link active' : 'bottom-link'}
            onClick={() => navigate('about')}
          >
            <HelpCircle size={18} />
            How this workspace works
            <ArrowUpRight size={14} />
          </button>
          <div className="profile">
            <span>DR</span>
            <div>
              <strong>Demo reviewer</strong>
              <small>Your browser workspace</small>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>
      {navOpen ? (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setNavOpen(!navOpen)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {view === 'about' ? 'How it works' : views.find((v) => v.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={16} />
              <input
                aria-label="Find a patient or record"
                placeholder="Find a patient or record…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearch('');
                }}
              />
              {search ? (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
              {search ? (
                <div className="search-results">
                  <small>SEARCH RESULTS</small>
                  {data.patients
                    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                    .map((p) => (
                      <button key={p.id} onClick={() => selectPatient(p.id)}>
                        <Users size={16} />
                        <span>
                          {p.name}
                          <small>Fictional patient</small>
                        </span>
                      </button>
                    ))}
                  {data.workspace.sources
                    .filter((s) =>
                      `${s.title} ${s.id}`.toLowerCase().includes(search.toLowerCase()),
                    )
                    .slice(0, 8)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setPatientId(s.patientId);
                          setSource({ record: s });
                          setSearch('');
                        }}
                      >
                        <FileText size={16} />
                        <span>
                          {s.title}
                          <small>
                            {s.id} · {data.patients.find((p) => p.id === s.patientId)?.name}
                          </small>
                        </span>
                      </button>
                    ))}
                  {!data.patients.some((p) =>
                    p.name.toLowerCase().includes(search.toLowerCase()),
                  ) &&
                  !data.workspace.sources.some((s) =>
                    `${s.title} ${s.id}`.toLowerCase().includes(search.toLowerCase()),
                  ) ? (
                    <p>No matching patient or record.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="demo-pill">
              <span />
              Demo environment
            </span>
            <button
              className="icon-button help-button"
              aria-label="Open quick guide"
              onClick={() => setModal('guide')}
            >
              <HelpCircle size={20} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLARITY STARTS WITH THE SOURCE</div>
              <h1>
                {view === 'about'
                  ? 'A workspace you can understand.'
                  : view === 'overview'
                    ? 'Patient workspace'
                    : views.find((v) => v.id === view)?.label}
              </h1>
              <p>
                {view === 'overview'
                  ? 'See the story. Spot the gaps. Review with the evidence in front of you.'
                  : view === 'timeline'
                    ? 'Follow what happened—and see when each record was written.'
                    : view === 'records'
                      ? 'Every source stays intact. Every statement leads back to its original text.'
                      : view === 'review'
                        ? 'Compare the evidence before recording a decision.'
                        : view === 'memory'
                          ? 'Source-linked facts, uncertainty, and reviewer decisions in one place.'
                          : view === 'workflow'
                            ? 'Follow each check, then pause for a human review.'
                            : 'What works, what is connected, and where the boundaries are.'}
              </p>
            </div>
            <div className="page-actions">
              <button className="button secondary" onClick={() => setModal('export')}>
                <ArrowDownToLine size={16} />
                Export brief
              </button>
              <button
                className="button primary"
                onClick={() => setModal('import')}
                disabled={loading}
              >
                <Plus size={17} />
                Add record
              </button>
            </div>
          </div>
          {error ? (
            <div className="error-strip">
              <Notice error>{error}</Notice>
              <button className="text-button" onClick={() => void refresh()}>
                Refresh workspace
              </button>
            </div>
          ) : null}
          {loading ? (
            <div className="loading-strip">
              <LoaderCircle className="spin" size={15} />
              Loading your saved workspace…
            </div>
          ) : null}
          <section className="patient-banner">
            <div className="patient-identity">
              <span className={`patient-large avatar-${patient.color}`}>
                {patient.initials}
                <span />
              </span>
              <div>
                <div className="patient-name">
                  <h2>{patient.name}</h2>
                  <Badge tone="green">Synthetic patient</Badge>
                </div>
                <p>
                  {patient.age} years<span>·</span>
                  {patient.id}
                  <span>·</span>
                  {patient.subtitle}
                </p>
              </div>
            </div>
            <div className="patient-banner-right">
              <span className="case-state">
                <span />
                {openIssues.length ? 'Review in progress' : 'Review items documented'}
              </span>
              <small>
                {records.length} records · last entered{' '}
                {formatDate(
                  records
                    .map((r) => r.recordedAt)
                    .sort()
                    .at(-1)!,
                  true,
                )}
              </small>
            </div>
          </section>
          <div className="workspace-columns">
            <main className="workspace-content">
              {view === 'overview' ? (
                <>
                  <section className="stats-grid">
                    <Stat
                      icon={FileText}
                      value={records.length}
                      label="Source records"
                      detail="Original text, always available"
                      tone="blue"
                      onClick={() => navigate('records')}
                    />
                    <Stat
                      icon={ListChecks}
                      value={openIssues.length}
                      label="Items to review"
                      detail={`${analysis.issues.filter((i) => i.type === 'conflict' && i.status === 'open').length} differences · ${analysis.issues.filter((i) => i.type === 'missing' && i.status === 'open').length} missing item${analysis.issues.filter((i) => i.type === 'missing' && i.status === 'open').length === 1 ? '' : 's'}`}
                      tone="amber"
                      onClick={() => navigate('review')}
                    />
                    <Stat
                      icon={Link2}
                      value={analysis.evidence.length}
                      label="Linked statements"
                      detail="Every statement has a source"
                      tone="green"
                      onClick={() => navigate('memory')}
                    />
                  </section>
                  <section className="focus-card">
                    <div className="focus-visual">
                      <Waypoints size={38} />
                      <span className="focus-dot one" />
                      <span className="focus-dot two" />
                    </div>
                    <div>
                      <Badge tone="green">THE BIG PICTURE</Badge>
                      <h2>A clearer view of {patient.name.split(' ')[0]}’s story.</h2>
                      <p>
                        {patient.focus}{' '}
                        {openIssues.length
                          ? `${openIssues.length} items still need a second look.`
                          : 'All current review items have a documented decision.'}
                      </p>
                      <button className="text-button" onClick={() => navigate('review')}>
                        See what needs review <ArrowRight size={16} />
                      </button>
                    </div>
                  </section>
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">START HERE</span>
                      <h2>
                        What needs a second look <span>{openIssues.length}</span>
                      </h2>
                    </div>
                    <button className="text-button" onClick={() => navigate('review')}>
                      View all
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="issue-list">
                    {openIssues.slice(0, 3).map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onReview={() => setReview(issue)}
                        onSource={openSource}
                        compact
                      />
                    ))}
                    {!openIssues.length ? (
                      <Empty title="Every current item has a review note.">
                        New records can reveal new differences. Original statements and review
                        history remain available.
                      </Empty>
                    ) : null}
                  </div>
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">THE RECORD OVER TIME</span>
                      <h2>Recent timeline</h2>
                    </div>
                    <button className="text-button" onClick={() => navigate('timeline')}>
                      Open timeline
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <Timeline analysis={analysis} onSource={openSource} limit={3} />
                  <div className="inline-boundary">
                    <ShieldCheck size={16} />
                    <p>
                      All people and records in this workspace are fictional. Evidence checks do not
                      make clinical decisions.
                    </p>
                  </div>
                </>
              ) : null}
              {view === 'timeline' ? (
                <>
                  <div className="panel-toolbar">
                    <div>
                      <Badge tone="blue">{analysis.timeline.length} event dates</Badge>
                      <span>Newest first</span>
                    </div>
                    <label className="select-wrap">
                      <span className="sr-only">Filter timeline</span>
                      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">All statements</option>
                        <option value="event">Events</option>
                        <option value="measurement">Measurements</option>
                        <option value="medication">Medications</option>
                        <option value="fact">Other facts</option>
                      </select>
                    </label>
                  </div>
                  <div className="notice notice-soft">
                    <Clock3 size={17} />
                    <span>
                      <strong>Two dates, two meanings.</strong> The timeline uses the event date.
                      “Entered” shows when the source was written.
                    </span>
                  </div>
                  <Timeline analysis={analysis} onSource={openSource} filter={filter} />
                  {analysis.conversions.length ? (
                    <section className="conversion-panel">
                      <div className="section-heading">
                        <h2>Units made comparable</h2>
                        <Badge tone="green">Originals preserved</Badge>
                      </div>
                      {analysis.conversions.map((f) => (
                        <div key={f.id}>
                          <span>
                            <strong>{f.label}</strong>
                            <small>{f.conversion}</small>
                          </span>
                          <SourceButton id={f.sourceId} onOpen={openSource} />
                        </div>
                      ))}
                    </section>
                  ) : null}
                </>
              ) : null}
              {view === 'records' ? (
                <>
                  <div className="panel-toolbar">
                    <div>
                      <strong>{records.length} source records</strong>
                      <span>Stored without overwriting originals</span>
                    </div>
                    <select
                      aria-label="Filter source type"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All record types</option>
                      {[...new Set(records.map((r) => r.type))].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="record-grid">
                    {records
                      .filter((r) => filter === 'all' || r.type === filter)
                      .map((record) => (
                        <button
                          className="record-card"
                          key={record.id}
                          onClick={() => openSource(record.id)}
                        >
                          <div className="record-top">
                            <span className="record-icon">
                              <FileText size={23} />
                            </span>
                            <Badge>{record.id}</Badge>
                            <ArrowUpRight size={16} />
                          </div>
                          <Badge tone="blue">{record.type}</Badge>
                          <h3>{record.title}</h3>
                          <p>{record.organization}</p>
                          <div className="record-preview">
                            {record.claims[0]?.excerpt ?? 'No extracted statements.'}
                          </div>
                          <div className="record-bottom">
                            <span>{formatDate(record.recordedAt, true)}</span>
                            <span>
                              <Link2 size={12} />
                              {record.claims.length} linked statements
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                  <button className="add-record-card" onClick={() => setModal('import')}>
                    <Upload size={20} />
                    <span>
                      <strong>Add another piece of the story</strong>
                      <small>Import a synthetic JSON record with its source text.</small>
                    </span>
                    <Plus size={19} />
                  </button>
                </>
              ) : null}
              {view === 'review' ? (
                <>
                  <div className="tabs" role="tablist" aria-label="Review status">
                    {[
                      ['all', `All items (${analysis.issues.length})`],
                      ['open', `Open (${openIssues.length})`],
                      ['reviewed', `Reviewed (${analysis.issues.length - openIssues.length})`],
                    ].map(([id, label]) => (
                      <button
                        role="tab"
                        aria-selected={filter === id}
                        className={filter === id ? 'selected' : ''}
                        onClick={() => setFilter(id)}
                        key={id}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="issue-list">
                    {analysis.issues
                      .filter((i) => filter === 'all' || i.status === filter)
                      .map((issue) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          onReview={() => setReview(issue)}
                          onSource={openSource}
                        />
                      ))}
                    {!analysis.issues.some((i) => filter === 'all' || i.status === filter) ? (
                      <Empty title="No items in this view.">
                        Review notes will appear here as you work through the evidence.
                      </Empty>
                    ) : null}
                  </div>
                  <div className="inline-boundary">
                    <BookOpen size={16} />
                    <p>
                      A reviewed issue means a human documented a decision. It does not make either
                      source automatically correct.
                    </p>
                  </div>
                </>
              ) : null}
              {view === 'memory' ? (
                <>
                  <div className="memory-intro">
                    <Database size={24} />
                    <div>
                      <h2>Memory with a paper trail.</h2>
                      <p>
                        Each statement keeps its source and event date. Corrections are added as
                        review notes, so the original history stays visible.
                      </p>
                    </div>
                  </div>
                  <div className="panel-toolbar">
                    <strong>{analysis.memory.length} source-linked statements</strong>
                    <select
                      aria-label="Filter memory status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All memory</option>
                      <option>Needs review</option>
                      <option>Source recorded</option>
                      <option>Reviewer selected</option>
                    </select>
                  </div>
                  <div className="memory-list">
                    {analysis.memory
                      .filter((m) => filter === 'all' || m.status === filter)
                      .map((memory) => (
                        <article className="memory-card" key={memory.id}>
                          <div className="memory-card-head">
                            <span className="memory-node">
                              <Link2 size={16} />
                            </span>
                            <strong>{memory.label}</strong>
                            <Badge
                              tone={
                                memory.status === 'Needs review'
                                  ? 'amber'
                                  : memory.status === 'Reviewer selected'
                                    ? 'green'
                                    : 'blue'
                              }
                            >
                              {memory.status}
                            </Badge>
                          </div>
                          <p>{memory.value}</p>
                          <div className="memory-bottom">
                            <span>
                              Recorded for {formatDate(memory.effectiveAt, true)}
                              {memory.validUntil
                                ? ` · valid until ${formatDate(memory.validUntil, true)}`
                                : ''}
                            </span>
                            <div>
                              {memory.sourceIds.map((id) => (
                                <SourceButton id={id} key={id} onOpen={openSource} />
                              ))}
                            </div>
                          </div>
                          {memory.decisionId ? (
                            <small className="memory-review-note">
                              A reviewer note is linked. See Needs review for the decision history.
                            </small>
                          ) : null}
                        </article>
                      ))}
                  </div>
                  {!analysis.memory.some((m) => filter === 'all' || m.status === filter) ? (
                    <Empty title="Nothing with this status yet.">
                      Select a source statement in the review panel to record a reviewer preference.
                    </Empty>
                  ) : null}
                  <div className="section-heading">
                    <h2>Activity trail</h2>
                    <Badge>
                      {data.workspace.audit.filter((a) => a.patientId === patientId).length} events
                    </Badge>
                  </div>
                  <div className="audit-list">
                    {data.workspace.audit
                      .filter((a) => a.patientId === patientId)
                      .slice(-15)
                      .reverse()
                      .map((event) => (
                        <div key={event.id}>
                          <span className="audit-dot" />
                          <div>
                            <strong>{event.action}</strong>
                            <p>{event.detail}</p>
                            <small>
                              {event.actor} · {formatDate(event.at, true)}
                            </small>
                          </div>
                        </div>
                      ))}
                    {!data.workspace.audit.some((a) => a.patientId === patientId) ? (
                      <p className="muted">
                        Your saved actions will appear here. Nothing has been changed yet.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
              {view === 'workflow' ? (
                <Workflow
                  run={lastRun}
                  runs={runs}
                  busy={disabled}
                  onStart={() => void act({ type: 'run', patientId })}
                  onApprove={() => {
                    setReviewNote('');
                    setModal('approve');
                  }}
                  checkpoint={data.runtime.checkpoint}
                />
              ) : null}
              {view === 'about' ? <About runtime={data.runtime} /> : null}
            </main>
            {view !== 'about' ? (
              <QuestionPanel
                key={patientId}
                patientName={patient.name}
                answers={answers}
                ai={data.runtime.ai}
                busy={disabled}
                onAsk={(question) => act({ type: 'question', patientId, question })}
                onSource={openSource}
              />
            ) : null}
          </div>
          <footer className="page-footer">
            <span>
              <Layers3 size={14} />
              Clinical Evidence Twin
            </span>
            <span>Evidence, with context. Decisions, with care.</span>
            <span className="storage-indicator">
              <span
                className={
                  data.runtime.storage === 'Read-only preview' ? 'status-dot amber' : 'status-dot'
                }
              />
              {loading
                ? 'Connecting…'
                : data.runtime.storage === 'PostgreSQL'
                  ? 'Saved to database'
                  : data.runtime.storage === 'Local file'
                    ? 'Saved on this server'
                    : 'Read-only preview'}
            </span>
          </footer>
        </div>
      </div>
      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button onClick={() => setToast('')} aria-label="Dismiss message">
            <X size={15} />
          </button>
        </div>
      ) : null}
      {review ? (
        <ReviewModal
          issue={review}
          history={data.workspace.decisions.filter(
            (d) => d.issueId === review.id && d.patientId === patientId,
          )}
          onClose={() => setReview(null)}
          onSource={openSource}
          onSave={(data) => act({ type: 'review', data })}
          busy={busy}
        />
      ) : null}
      {source ? (
        <SourceModal
          source={source.record}
          highlight={source.highlight}
          onClose={() => setSource(null)}
        />
      ) : null}
      {modal === 'import' ? (
        <ImportModal
          patient={patient}
          onClose={() => setModal(null)}
          onImport={(record) => act({ type: 'import', patientId, record })}
          busy={busy}
        />
      ) : null}
      {modal === 'guide' ? (
        <Modal
          title="Make sense of the story, one step at a time."
          kicker="A two-minute guide"
          onClose={() => setModal(null)}
        >
          <div className="guide-steps">
            {[
              [
                '1',
                'Start with a patient',
                'Choose a fictional case in the left sidebar. Each case has its own records, questions, and review notes.',
              ],
              [
                '2',
                'Look at the evidence',
                'Open any source label, such as MS-03. You will see the original text and the exact statement being used.',
              ],
              [
                '3',
                'Review what does not line up',
                'Open Needs review. Compare both sides, explain your decision, and save it. You can keep an item open.',
              ],
              [
                '4',
                'Ask and check',
                'Ask a record-based question. Open the linked sources to verify the answer.',
              ],
              [
                '5',
                'Save the paper trail',
                'Run the evidence workflow and review its brief. Export the case when you want a copy.',
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <section>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </section>
              </div>
            ))}
          </div>
          <button className="button primary full" onClick={() => setModal(null)}>
            Got it. Open the workspace
            <ArrowRight size={17} />
          </button>
        </Modal>
      ) : null}
      {modal === 'export' ? (
        <Modal
          title="Take the evidence with you."
          kicker="Export this case"
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            The brief includes open issues, reviewer notes, and original source text for{' '}
            {patient.name}. It is a demonstration export, not a clinical report.
          </p>
          <button
            className="export-option"
            onClick={() => {
              downloadText(`${patient.id}-evidence-brief.md`, exportBrief(), 'text/markdown');
              setToast('Evidence brief downloaded.');
              setModal(null);
            }}
          >
            <FileText size={24} />
            <span>
              <strong>Readable review brief</strong>
              <small>Markdown · opens in a text editor</small>
            </span>
            <ArrowDownToLine size={18} />
          </button>
          <button
            className="export-option"
            onClick={() => {
              downloadText(
                `${patient.id}-evidence-bundle.json`,
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    synthetic: true,
                    exportedAt: new Date().toISOString(),
                    patient,
                    records,
                    analysis,
                    decisions: data.workspace.decisions.filter((d) => d.patientId === patientId),
                    runs,
                    audit: data.workspace.audit.filter((a) => a.patientId === patientId),
                  },
                  null,
                  2,
                ),
                'application/json',
              );
              setToast('Evidence bundle downloaded.');
              setModal(null);
            }}
          >
            <Database size={24} />
            <span>
              <strong>Complete evidence bundle</strong>
              <small>JSON · records, decisions, workflow and history</small>
            </span>
            <ArrowDownToLine size={18} />
          </button>
        </Modal>
      ) : null}
      {modal === 'approve' && lastRun ? (
        <Modal
          title="Record your workflow review"
          kicker="Human review is the final step"
          onClose={() => setModal(null)}
        >
          <div className="review-brief">{lastRun.brief}</div>
          <p className="modal-description">
            This records that you reviewed the evidence brief. It does not approve treatment or
            close the individual review items.
          </p>
          <label className="field-label">
            Your review note
            <textarea
              rows={4}
              minLength={12}
              maxLength={2000}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="What did you check? What still needs confirmation?"
            />
          </label>
          <label className="field-label">
            Reviewer name
            <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
          </label>
          <button
            className="button primary full"
            disabled={busy || reviewNote.trim().length < 12 || reviewer.trim().length < 2}
            onClick={async () => {
              if (
                await act({
                  type: 'approve',
                  runId: lastRun.id,
                  approval: { approved: true, note: reviewNote, reviewer },
                })
              )
                setModal(null);
            }}
          >
            <CheckCircle2 size={17} />
            {busy ? 'Saving review…' : 'Save workflow review'}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
function Stat({
  icon: Icon,
  value,
  label,
  detail,
  tone,
  onClick,
}: {
  icon: typeof FileText;
  value: number;
  label: string;
  detail: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button className="stat-card" onClick={onClick}>
      <div>
        <span className={`stat-icon tone-${tone}`}>
          <Icon size={18} />
        </span>
        <ArrowUpRight size={15} />
      </div>
      <strong>
        {value}
        <span>{label}</span>
      </strong>
      <p>{detail}</p>
    </button>
  );
}
function IssueCard({
  issue,
  onReview,
  onSource,
  compact = false,
}: {
  issue: Issue;
  onReview: () => void;
  onSource: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <article
      className={`issue-card ${issue.type} ${issue.status === 'reviewed' ? 'is-reviewed' : ''}`}
    >
      <div className="issue-card-top">
        <Badge
          tone={
            issue.status === 'reviewed' ? 'green' : issue.type === 'conflict' ? 'amber' : 'blue'
          }
        >
          {issue.status === 'reviewed' ? (
            <Check size={12} />
          ) : issue.type === 'conflict' ? (
            <Waypoints size={12} />
          ) : (
            <HelpCircle size={12} />
          )}{' '}
          {issue.status === 'reviewed'
            ? 'Reviewed'
            : issue.type === 'conflict'
              ? 'Records disagree'
              : 'Missing information'}
        </Badge>
        <span className="issue-priority">{issue.priority}</span>
      </div>
      <h3>{issue.title}</h3>
      {!compact ? <p>{issue.detail}</p> : null}
      {!compact && issue.evidence.length ? (
        <div className="inline-evidence">
          {issue.evidence.map((e) => (
            <div key={e.id}>
              <blockquote>“{e.excerpt}”</blockquote>
              <SourceButton id={e.sourceId} onOpen={onSource} />
            </div>
          ))}
        </div>
      ) : null}
      <div className="issue-card-bottom">
        <div className="source-row">
          {compact ? (
            [...new Set(issue.evidence.map((e) => e.sourceId))].map((id) => (
              <SourceButton key={id} id={id} onOpen={onSource} />
            ))
          ) : (
            <span className="muted">
              {issue.type === 'conflict'
                ? 'Original statements are preserved'
                : 'Not found in the supplied records'}
            </span>
          )}
          {compact && !issue.evidence.length ? (
            <span className="muted">No confirmed date in the record set</span>
          ) : null}
        </div>
        <button className="text-button" onClick={onReview}>
          {issue.status === 'reviewed' ? 'View decision' : 'Review item'}
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}
function Timeline({
  analysis,
  onSource,
  limit,
  filter = 'all',
}: {
  analysis: Analysis;
  onSource: (id: string, highlight?: string) => void;
  limit?: number;
  filter?: string;
}) {
  const rows = analysis.timeline
    .map((row) => ({
      ...row,
      claims: row.claims.filter((c) => filter === 'all' || c.kind === filter),
    }))
    .filter((row) => row.claims.length)
    .slice(0, limit);
  return (
    <div className="timeline">
      {rows.map((row) => (
        <article className="timeline-event" key={row.date}>
          <div className="timeline-date">
            <strong>{formatDate(row.date, true)}</strong>
            <span>{row.date.slice(0, 4)}</span>
          </div>
          <div className="timeline-marker">
            <span />
          </div>
          <div className="timeline-body">
            {row.claims.map((claim) => {
              const disputed = analysis.issues.some(
                (i) => i.type === 'conflict' && i.evidence.some((e) => e.id === claim.id),
              );
              return (
                <div className="timeline-claim" key={claim.id}>
                  <div>
                    <strong>{claim.label}</strong>
                    {disputed ? <span className="mini-flag">Sources differ</span> : null}
                  </div>
                  <p>
                    {claim.normalizedValue}
                    {claim.normalizedUnit ? ` ${claim.normalizedUnit}` : ''}
                  </p>
                  <div className="timeline-detail">
                    <span>
                      {claim.organization} · entered {formatDate(claim.recordedAt, true)}
                    </span>
                    <SourceButton
                      id={claim.sourceId}
                      onOpen={(id) => onSource(id, claim.excerpt)}
                    />
                  </div>
                  {claim.conversion ? (
                    <small className="conversion">
                      <Check size={12} />
                      {claim.conversion} · original kept
                    </small>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>
      ))}
      {!rows.length ? (
        <Empty title="No events in this view.">Try another statement type.</Empty>
      ) : null}
    </div>
  );
}
function Workflow({
  run,
  runs,
  busy,
  onStart,
  onApprove,
  checkpoint,
}: {
  run?: Run;
  runs: Run[];
  busy: boolean;
  onStart: () => void;
  onApprove: () => void;
  checkpoint: string;
}) {
  const done = new Set(run?.events.map((e) => e.node) ?? []);
  const step = (id: string, label: string, detail: string, icon: typeof FileText) => {
    const Icon = icon;
    const complete = done.has(id);
    const waiting = id === 'review' && run?.status === 'waiting';
    return (
      <div className={`flow-step ${complete ? 'done' : ''} ${waiting ? 'waiting' : ''}`}>
        <span>
          <Icon size={18} />
        </span>
        <div>
          <strong>{label}</strong>
          <small>{detail}</small>
        </div>
        {complete ? (
          <CheckCircle2 size={17} />
        ) : waiting ? (
          <Clock3 size={17} />
        ) : (
          <span className="step-circle" />
        )}
      </div>
    );
  };
  return (
    <>
      <section className="workflow-intro">
        <div>
          <Badge tone="purple">
            <GitBranch size={12} /> LangGraph workflow
          </Badge>
          <h2>Check together. Review with a human.</h2>
          <p>
            Timeline, contradictions and missing information are checked in parallel. The workflow
            then pauses until you review the brief.
          </p>
        </div>
        <button className="button primary" disabled={busy} onClick={onStart}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}Run evidence
          checks
        </button>
      </section>
      <div className="workflow-canvas">
        <div className="flow-start">RECORDS ENTER HERE</div>
        {step('validate', 'Check the patient', 'Exact ID and source-quote checks', Users)}
        <div className="flow-connector" />
        {step('normalize', 'Normalize the records', 'Keep original values and dates', Layers3)}
        <div className="parallel-label">THREE CHECKS, IN PARALLEL</div>
        <div className="parallel-steps">
          {step('timeline', 'Build timeline', 'Order dated statements', Activity)}
          {step('conflicts', 'Compare facts', 'Keep both sides visible', Waypoints)}
          {step('missing', 'Find gaps', 'List missing information', HelpCircle)}
        </div>
        <div className="flow-connector" />
        {step('assemble', 'Assemble the brief', 'Bring findings and sources together', FileCheck2)}
        <div className="flow-connector" />
        {step('review', 'Human review', 'Pause here for a written decision', ShieldCheck)}
        <div className="flow-connector" />
        {step('finalize', 'Save the review', 'Keep the complete paper trail', Database)}
      </div>
      {run ? (
        <section className="run-result">
          <div className="section-heading">
            <h2>Latest review brief</h2>
            <Badge tone={run.status === 'completed' ? 'green' : 'amber'}>
              {run.status === 'completed' ? 'Review saved' : 'Waiting for you'}
            </Badge>
          </div>
          <p>{run.brief}</p>
          {run.status === 'waiting' ? (
            <button className="button primary" disabled={busy} onClick={onApprove}>
              Review this brief
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="saved-review">
              <CheckCircle2 size={18} />
              <p>{run.reviewerNote}</p>
            </div>
          )}
          <small>
            Started {formatDate(run.startedAt, true)} · {run.sourceIds.length} source records
          </small>
        </section>
      ) : (
        <div className="notice notice-soft">
          <GitBranch size={18} />
          <span>
            No workflow has run for this case yet. Start a run to see its actual progress and review
            brief.
          </span>
        </div>
      )}
      <div className="section-heading">
        <h2>Run history</h2>
        <Badge>{runs.length} runs</Badge>
      </div>
      {runs.length ? (
        <div className="run-history">
          {runs
            .slice()
            .reverse()
            .map((r) => (
              <details key={r.id}>
                <summary>
                  <GitBranch size={17} />
                  <strong>{formatDate(r.startedAt, true)}</strong>
                  <span>{r.sourceIds.length} records</span>
                  <Badge tone={r.status === 'completed' ? 'green' : 'amber'}>
                    {r.status === 'completed' ? 'Reviewed' : 'Waiting'}
                  </Badge>
                  <ChevronDown size={15} />
                </summary>
                <ol>
                  {r.events.map((event, i) => (
                    <li key={`${event.node}-${i}`}>
                      <CheckCircle2 size={15} />
                      <div>
                        <strong>{event.title}</strong>
                        <p>{event.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
        </div>
      ) : (
        <p className="muted">Each completed step will appear here after a run.</p>
      )}
      <p className="fine-print">
        Checkpoint storage: {checkpoint}. Reviewing a workflow does not close individual evidence
        issues.
      </p>
    </>
  );
}
function About({ runtime }: { runtime: WorkspaceResponse['runtime'] }) {
  return (
    <div className="about-grid">
      <section className="about-hero">
        <span className="assistant-mark">
          <Layers3 size={27} />
        </span>
        <h2>
          The evidence stays visible.
          <br />
          The decision stays human.
        </h2>
        <p>
          Clinical Evidence Twin helps you organize a changing record set, understand disagreements,
          and document what a reviewer decided. It does not treat a patient.
        </p>
      </section>
      <section className="about-card">
        <h2>What you can do</h2>
        {[
          'Read original synthetic records and follow exact source quotes.',
          'Compare statements about the same event or context.',
          'Keep event dates separate from the dates records were entered.',
          'Save reviewer notes without overwriting original evidence.',
          'Run parallel evidence checks, pause, and resume after review.',
          'Export a readable brief or a complete JSON evidence bundle.',
        ].map((t) => (
          <p key={t}>
            <CheckCircle2 size={17} />
            {t}
          </p>
        ))}
      </section>
      <section className="about-card connections">
        <h2>Connected services</h2>
        <div>
          <span>
            <Database size={20} />
            <strong>Saved workspace</strong>
          </span>
          <Badge tone={runtime.storage === 'Read-only preview' ? 'amber' : 'green'}>
            {runtime.storage}
          </Badge>
        </div>
        <p>
          {runtime.storage === 'PostgreSQL'
            ? 'Review notes and workflow checkpoints are saved in the database. Your session cookie separates this browser workspace from others.'
            : runtime.storage === 'Local file'
              ? 'Sources and review notes are saved on this server. Active workflow checkpoints last only until the local process restarts.'
              : 'A database has not been connected. The sample records can be explored, but changes cannot be saved.'}
        </p>
        <div>
          <span>
            <Sparkles size={20} />
            <strong>AI summaries</strong>
          </span>
          <Badge tone={runtime.ai ? 'green' : 'neutral'}>
            {runtime.ai ? 'Configured' : 'Not connected'}
          </Badge>
        </div>
        <p>
          {runtime.ai
            ? `Model: ${runtime.model}. If generation fails or cites an unknown source, the app shows original evidence instead.`
            : 'Questions use a source search and return recorded statements. No language model is running in this mode.'}
        </p>
        <div>
          <span>
            <Link2 size={20} />
            <strong>MCP tools</strong>
          </span>
          <Badge tone={runtime.mcp ? 'green' : 'neutral'}>
            {runtime.mcp ? 'Access token configured' : 'Local tools available'}
          </Badge>
        </div>
        <p>
          Five read-only tools expose synthetic cases, timelines, evidence, review items, and
          original sources. Hosted access needs a server token. It cannot prescribe or edit records.
        </p>
      </section>
      <section className="about-card">
        <h2>Know the boundaries</h2>
        {[
          'Only synthetic records belong in this demo.',
          'Patient matching requires an exact ID; fuzzy name matching is not used.',
          'Unit conversion currently covers grams to kilograms and metres to centimetres. Other units are preserved.',
          'Structured JSON import is supported. PDF extraction, OCR, FHIR server connections and hospital login are not connected.',
          'This is not a diagnosis, prescribing or treatment system. Real clinical use needs separate validation, access controls and approvals.',
        ].map((t) => (
          <p key={t}>
            <ShieldCheck size={17} />
            {t}
          </p>
        ))}
      </section>
    </div>
  );
}
