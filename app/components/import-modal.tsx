'use client';
import { useState } from 'react';
import { UploadCloud, FileJson, ArrowRight, Download, CheckCircle2 } from 'lucide-react';
import { sourceSchema, type Source, type Patient } from '@/lib/types';
import { Modal, Notice, Badge } from './primitives';
export function downloadText(name: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ImportModal({
  patient,
  onClose,
  onImport,
  busy,
  requestError,
}: {
  patient: Patient;
  onClose: () => void;
  onImport: (source: Source) => Promise<boolean>;
  busy: boolean;
  requestError?: string;
}) {
  const [record, setRecord] = useState<Source | null>(null);
  const [error, setError] = useState('');
  const sample = (): Source => ({
    id: `DEMO-${Date.now()}`,
    patientId: patient.id,
    title: 'Confirmed follow-up appointment',
    organization: 'Synthetic Demo Clinic',
    recordedAt: '2026-08-26',
    type: 'Visit note',
    synthetic: true,
    text: `SYNTHETIC RECORD — not a real patient.\nPatient ID: ${patient.id}\nFollow-up appointment: 1 September 2026.\nThis is a fictional appointment used to demonstrate adding evidence.`,
    claims: [
      {
        id: `followup-${Date.now()}`,
        key: 'followup.date',
        label: 'Follow-up appointment',
        value: '2026-09-01',
        kind: 'event',
        context: 'confirmed-followup',
        effectiveAt: '2026-09-01',
        excerpt: 'Follow-up appointment: 1 September 2026.',
      },
    ],
  });
  async function read(file: File | undefined) {
    if (!file) return;
    setError('');
    setRecord(null);
    if (file.size > 90000) {
      setError('Use a JSON record smaller than 90 KB.');
      return;
    }
    try {
      const parsed = sourceSchema.parse(JSON.parse(await file.text()));
      if (parsed.patientId !== patient.id)
        throw new Error(`This file belongs to another patient. Expected ${patient.id}.`);
      setRecord(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file could not be read.');
    }
  }
  return (
    <Modal title="Add a source record" kicker={`Case: ${patient.name}`} onClose={onClose}>
      <Notice>
        Use fictional data only. This demo is not set up to hold real patient information.
      </Notice>
      <label
        className="upload-area"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void read(e.dataTransfer.files[0]);
        }}
      >
        <UploadCloud size={32} />
        <strong>Choose a synthetic JSON record</strong>
        <span>Drop a file here, or browse · up to 90 KB</span>
        <input
          type="file"
          accept=".json,application/json"
          aria-label="Choose a synthetic JSON record"
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      <div className="import-actions">
        <button
          className="button secondary"
          onClick={() => {
            setRecord(sample());
            setError('');
          }}
        >
          <FileJson size={16} />
          Try a sample record
        </button>
        <button
          className="text-button"
          onClick={() =>
            downloadText(
              'synthetic-record-template.json',
              JSON.stringify(sample(), null, 2),
              'application/json',
            )
          }
        >
          <Download size={15} />
          Template
        </button>
      </div>
      <p className="fine-print">
        This version accepts structured JSON with exact source quotes. PDF scanning, OCR and
        hospital connections are not enabled.
      </p>
      {record ? (
        <div className="import-preview">
          <Badge tone="green">
            <CheckCircle2 size={12} /> Record checks passed
          </Badge>
          <h3>{record.title}</h3>
          <p>
            {record.organization} · {record.recordedAt}
          </p>
          <span>
            {record.claims.length} source-linked statement{record.claims.length === 1 ? '' : 's'}
          </span>
          <pre>{record.text}</pre>
        </div>
      ) : null}
      {error || requestError ? <Notice error>{error || requestError}</Notice> : null}
      <div className="modal-footer">
        <span>Original sources are never overwritten.</span>
        <button
          className="button primary"
          disabled={!record || busy}
          onClick={async () => {
            if (record && (await onImport(record))) onClose();
          }}
        >
          {busy ? 'Adding…' : 'Add record'}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
