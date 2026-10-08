'use client';
import { useState } from 'react';
import { ArrowRight, Check, FileText } from 'lucide-react';
import { Modal, Badge, SourceButton, Notice } from './primitives';
import type { Issue, Decision } from '@/lib/types';
export default function ReviewModal({
  issue,
  history,
  onClose,
  onSource,
  onSave,
  busy,
}: {
  issue: Issue;
  history: Decision[];
  onClose: () => void;
  onSource: (id: string) => void;
  onSave: (data: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
}) {
  const [outcome, setOutcome] = useState<'keep_open' | 'use_source' | 'documented'>('keep_open');
  const [claim, setClaim] = useState('');
  const [note, setNote] = useState('');
  const [reviewer, setReviewer] = useState('Demo reviewer');
  const [error, setError] = useState('');
  async function save() {
    if (note.trim().length < 12) {
      setError('Add a short reason, at least 12 characters.');
      return;
    }
    if (outcome === 'use_source' && !claim) {
      setError('Choose the statement you want to use.');
      return;
    }
    if (reviewer.trim().length < 2) {
      setError('Add a reviewer name.');
      return;
    }
    const ok = await onSave({
      issueId: issue.id,
      patientId: issue.patientId,
      outcome,
      note,
      reviewer,
      ...(claim ? { selectedClaimId: claim } : {}),
    });
    if (ok) onClose();
  }
  return (
    <Modal
      title="Review the difference"
      kicker="Your decision stays linked to the evidence"
      onClose={onClose}
      wide
    >
      <div className="review-intro">
        <Badge tone={issue.type === 'conflict' ? 'amber' : 'blue'}>
          {issue.type === 'conflict' ? 'Records disagree' : 'Information missing'}
        </Badge>
        <h3>{issue.title}</h3>
        <p>{issue.detail}</p>
      </div>
      <div className="evidence-compare">
        {issue.evidence.map((e, index) => (
          <div className="evidence-side" key={e.id}>
            <div className="section-label">
              Statement {index + 1}
              <SourceButton id={e.sourceId} onOpen={onSource} />
            </div>
            <blockquote>“{e.excerpt}”</blockquote>
            <small>
              {e.organization} · entered {e.recordedAt}
            </small>
          </div>
        ))}
      </div>
      <fieldset className="choice-group">
        <legend>How should this be recorded?</legend>
        <label className={`choice ${outcome === 'keep_open' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="decision"
            checked={outcome === 'keep_open'}
            onChange={() => setOutcome('keep_open')}
          />
          <span>
            <strong>Keep it open</strong>
            <small>There is not enough information yet. Save a note for the next reviewer.</small>
          </span>
        </label>
        {issue.type === 'conflict' ? (
          <label className={`choice ${outcome === 'use_source' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="decision"
              checked={outcome === 'use_source'}
              onChange={() => setOutcome('use_source')}
            />
            <span>
              <strong>Select a source statement</strong>
              <small>
                Record your preferred statement and why. Both originals remain available.
              </small>
            </span>
          </label>
        ) : null}
        <label className={`choice ${outcome === 'documented' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="decision"
            checked={outcome === 'documented'}
            onChange={() => setOutcome('documented')}
          />
          <span>
            <strong>Mark as reviewed, with uncertainty</strong>
            <small>Document that you checked it. This does not establish a clinical fact.</small>
          </span>
        </label>
      </fieldset>
      {outcome === 'use_source' ? (
        <label className="field-label">
          Statement to use
          <select value={claim} onChange={(e) => setClaim(e.target.value)}>
            <option value="">Choose a source statement</option>
            {issue.evidence.map((e) => (
              <option key={e.id} value={e.id}>
                {e.sourceId}: {e.value}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field-label">
        Your reason
        <textarea
          rows={3}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Explain what you checked and what still needs confirmation."
        />
      </label>
      <label className="field-label">
        Reviewer name
        <input value={reviewer} maxLength={80} onChange={(e) => setReviewer(e.target.value)} />
      </label>
      {error ? <Notice error>{error}</Notice> : null}
      {history.length ? (
        <details className="decision-history">
          <summary>
            <FileText size={15} /> {history.length} earlier review note
            {history.length === 1 ? '' : 's'}
          </summary>
          {history.map((h) => (
            <p key={h.id}>
              <strong>{h.reviewer}</strong> · {h.createdAt.slice(0, 10)}
              <br />
              {h.note}
            </p>
          ))}
        </details>
      ) : null}
      <div className="modal-footer">
        <span>
          <Check size={14} /> Original records stay unchanged
        </span>
        <button className="button primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save review'}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
