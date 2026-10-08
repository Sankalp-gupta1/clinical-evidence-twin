'use client';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowUp, ScanText, ChevronDown, BookOpen, ShieldCheck } from 'lucide-react';
import type { Answer } from '@/lib/types';
import { Badge, SourceButton } from './primitives';
export default function QuestionPanel({
  answers,
  patientName,
  ai,
  busy,
  onAsk,
  onSource,
}: {
  answers: Answer[];
  patientName: string;
  ai: boolean;
  busy: boolean;
  onAsk: (question: string) => Promise<boolean>;
  onSource: (id: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const [expanded, setExpanded] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [answers.length]);
  async function ask(value: string) {
    if (value.trim().length < 3 || busy) return;
    if (await onAsk(value.trim())) setQuestion('');
  }
  return (
    <aside className={`question-panel ${expanded ? '' : 'collapsed'}`}>
      <button
        className="question-title"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="assistant-mark">
          <Sparkles size={19} />
        </span>
        <span>
          <strong>Ask the evidence</strong>
          <small>Answers linked to the records</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {expanded ? (
        <>
          <div className="assistant-state">
            <span className="status-dot" />
            {ai ? 'AI summaries connected' : 'Source search · no AI model connected'}
          </div>
          <div className="chat-messages">
            {answers.length ? (
              <>
                {answers.slice(-8).map((answer) => (
                  <div className="chat-exchange" key={answer.id}>
                    <div className="user-question">{answer.question}</div>
                    <div className="assistant-answer">
                      <div className="answer-label">
                        <ScanText size={14} />
                        {answer.mode}
                      </div>
                      <p>{answer.answer}</p>
                      <div className="source-row">
                        {answer.sourceIds.map((id) => (
                          <SourceButton key={id} id={id} onOpen={onSource} />
                        ))}
                      </div>
                      {answer.warning ? (
                        <small className="answer-warning">{answer.warning}</small>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={end} />
              </>
            ) : (
              <div className="chat-welcome">
                <span className="chat-orbit">
                  <BookOpen size={29} />
                </span>
                <h3>Start with a question.</h3>
                <p>
                  Find a fact in {patientName.split(' ')[0]}’s records, or understand where the
                  sources disagree.
                </p>
                <div className="suggestions">
                  {[
                    'Which records disagree?',
                    'What is the recorded weight?',
                    'What do the allergy records say?',
                  ].map((q) => (
                    <button key={q} onClick={() => void ask(q)} disabled={busy}>
                      {q}
                      <ArrowUp size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {busy ? (
              <div className="thinking">
                <span />
                <span />
                <span />
                Checking the workspace…
              </div>
            ) : null}
          </div>
          <form
            className="question-form"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <label className="sr-only" htmlFor="question">
              Ask a question about the records
            </label>
            <textarea
              id="question"
              value={question}
              maxLength={700}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about these records…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(question);
                }
              }}
            />
            <div>
              <span>Enter to send · Shift + Enter for a new line</span>
              <button disabled={busy || question.trim().length < 3} aria-label="Send question">
                <ArrowUp size={19} />
              </button>
            </div>
          </form>
          <div className="assistant-boundary">
            <ShieldCheck size={15} />
            <span>
              Evidence support, with a human in charge. No diagnosis or treatment instructions.
            </span>
          </div>
        </>
      ) : null}
    </aside>
  );
}
