import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Layers3,
  ShieldCheck,
  FileText,
  Users,
  Activity,
  Link2,
  Sparkles,
  Clock3,
  LockKeyhole,
  CircleHelp,
} from 'lucide-react';
import { ProductBrand } from './account-ui';
export default function Landing() {
  return (
    <div className="public-page">
      <header className="public-header">
        <ProductBrand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#for-teams">For teams</a>
          <Link href="/sign-in">Sign in</Link>
          <Link className="button primary" href="/sign-up">
            Create workspace <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="label-pill">
              <span className="live-dot" /> CLINICAL EVIDENCE, CONNECTED
            </div>
            <h1>
              Every record has
              <br />a story.
              <br />
              <em>See the whole one.</em>
            </h1>
            <p>
              A shared workspace for hospital teams to follow a patient’s history, spot conflicting
              records, and document a thoughtful review.
            </p>
            <div className="hero-buttons">
              <Link className="button primary" href="/sign-up">
                Set up your hospital <ArrowRight size={18} />
              </Link>
              <Link className="button secondary" href="/demo">
                Explore the demo <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="hero-footnote">
              <ShieldCheck size={16} />
              <span>Fictional cases in this pilot. Human review at every decision.</span>
            </div>
          </div>
          <div className="hero-workspace">
            <div className="preview-top">
              <Layers3 size={20} />
              <span>THE PATIENT STORY</span>
              <span className="preview-status">6 source records</span>
            </div>
            <div className="preview-patient">
              <span>MS</span>
              <div>
                <h2>Mira Sen</h2>
                <p>A fictional case with a few missing pieces.</p>
              </div>
            </div>
            <div className="preview-steps">
              <div>
                <span />
                <div>
                  <small>17 JUL</small>
                  <strong>First hospital visit</strong>
                  <p>The note records an allergy history.</p>
                  <span className="source-chip">
                    <FileText size={12} /> Original visit note
                  </span>
                </div>
              </div>
              <div>
                <span />
                <div>
                  <small>19 JUL</small>
                  <strong>A different account</strong>
                  <p>The discharge record lists no known allergies.</p>
                  <span className="source-chip">
                    <FileText size={12} /> Discharge summary
                  </span>
                </div>
              </div>
            </div>
            <div className="preview-issue">
              <div>
                <CircleHelp size={20} />
                <strong>These records disagree.</strong>
              </div>
              <p>
                Keep both statements visible. Check their sources before recording your decision.
              </p>
              <Link href="/demo">
                Compare the evidence <ArrowRight size={16} />
              </Link>
            </div>
            <div className="preview-bottom">
              <Link2 size={15} /> Every statement leads back to a source.
            </div>
          </div>
        </section>
        <div className="principles-strip">
          <span>
            <FileText /> Original records preserved
          </span>
          <span>
            <Users /> A shared hospital workspace
          </span>
          <span>
            <ShieldCheck /> Human approval
          </span>
          <span>
            <Link2 /> Sources one click away
          </span>
        </div>
        <section className="landing-section" id="how-it-works">
          <div className="section-intro">
            <div className="eyebrow">A CLEAR PATH THROUGH THE RECORDS</div>
            <h2>Know what to do next.</h2>
            <p>
              You do not need to learn a complicated system. Start with one case and follow the
              evidence.
            </p>
          </div>
          <div className="how-grid">
            {[
              {
                n: '01',
                title: 'Open the patient’s story',
                text: 'Read the timeline and original records together. Dates and measurement units are made easier to compare.',
                icon: Activity,
              },
              {
                n: '02',
                title: 'Look at what needs attention',
                text: 'Compare conflicting statements, find missing information, and see the exact source behind each item.',
                icon: CircleHelp,
              },
              {
                n: '03',
                title: 'Record a careful review',
                text: 'Write what you checked and what remains uncertain. Save a source-linked brief for the next reviewer.',
                icon: ShieldCheck,
              },
            ].map((s) => (
              <article key={s.n}>
                <div>
                  <s.icon size={24} />
                  <span>{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="teams-section" id="for-teams">
          <div>
            <div className="eyebrow">MADE FOR WORKING TOGETHER</div>
            <h2>
              One workspace.
              <br />
              Clear responsibilities.
            </h2>
            <p>
              Create a hospital workspace, let colleagues request access, and give each person the
              right role.
            </p>
            <Link href="/sign-up" className="button primary">
              Start with your team <ArrowRight size={16} />
            </Link>
          </div>
          <div className="role-stack">
            {[
              ['Owner', 'Set up the hospital and approve team access.', Users],
              ['Reviewer', 'Compare records and save review decisions.', FileText],
              ['Viewer', 'Read the evidence and export a brief.', LockKeyhole],
            ].map(([name, text, Icon]) => {
              const I = Icon as typeof Users;
              return (
                <div key={name as string}>
                  <span>
                    <I size={22} />
                  </span>
                  <div>
                    <h3>{name as string}</h3>
                    <p>{text as string}</p>
                  </div>
                  <Check size={19} />
                </div>
              );
            })}
          </div>
        </section>
        <section className="pilot-boundary">
          <ShieldCheck size={28} />
          <div>
            <h3>A careful starting point for a clinical product.</h3>
            <p>
              This working pilot uses fictional records. It organizes evidence and saves human
              reviews. It does not diagnose, prescribe, or change treatment. Real patient use needs
              separate clinical, security, privacy, and operational validation.
            </p>
          </div>
          <Link href="/demo">
            See the pilot <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <ProductBrand />
        <span>Clarity starts with the source.</span>
        <Link href="/sign-in">
          Sign in <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
