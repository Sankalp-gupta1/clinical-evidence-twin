'use client';
import { useEffect, useRef } from 'react';
import { X, FileText, ArrowUpRight, Check, AlertCircle, CircleHelp } from 'lucide-react';
import type { Source } from '@/lib/types';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'purple';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function SourceButton({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  return (
    <button className="source-chip" onClick={() => onOpen(id)} aria-label={`Open source ${id}`}>
      <FileText size={12} />
      {id}
      <ArrowUpRight size={11} />
    </button>
  );
}
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <CircleHelp size={23} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  kicker,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            {kicker ? <span className="eyebrow">{kicker}</span> : null}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function SourceModal({
  source,
  highlight,
  onClose,
}: {
  source: Source;
  highlight?: string;
  onClose: () => void;
}) {
  const excerpt = highlight ?? source.claims[0]?.excerpt;
  const position = excerpt ? source.text.indexOf(excerpt) : -1;
  return (
    <Modal title={source.title} kicker={`Original source · ${source.id}`} onClose={onClose} wide>
      <div className="source-meta">
        <Badge tone="blue">{source.type}</Badge>
        <span>{source.organization}</span>
        <span>Entered {formatDate(source.recordedAt)}</span>
      </div>
      <div className="notice notice-soft">
        <Check size={17} />
        <span>
          This is the original supplied text. Highlights point to the exact evidence used in this
          workspace.
        </span>
      </div>
      <pre className="original-text">
        {position >= 0 && excerpt ? (
          <>
            {source.text.slice(0, position)}
            <mark>{excerpt}</mark>
            {source.text.slice(position + excerpt.length)}
          </>
        ) : (
          source.text
        )}
      </pre>
      <div className="section-label">Statements linked to this source</div>
      <div className="source-claims">
        {source.claims.map((claim) => (
          <div key={claim.id}>
            <strong>{claim.label}</strong>
            <span>
              {claim.value}
              {claim.unit ? ` ${claim.unit}` : ''}
            </span>
            <small>Event date: {formatDate(claim.effectiveAt)}</small>
          </div>
        ))}
      </div>
      <p className="fine-print">
        Fictional demonstration record. A linked source is evidence of what was written, not proof
        that the statement is clinically correct.
      </p>
    </Modal>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  );
}
export function formatDate(date: string, short = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
}
