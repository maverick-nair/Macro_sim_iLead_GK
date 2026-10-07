import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { QuestionId } from '../../../api/author';
import { useSpeech } from '../../../speech/useSpeech';
import { createAuthorSpeech } from '../../voice';
import { BUTTON, FOCUS, Icon } from '../kit';

const MAX_SECONDS = 120;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The answer box (docs/design/genie/ChatStart and ChatVoice, D106): type, or record. Recording shows the
 * live transcript under a waveform with Cancel and Stop and review; when it stops, the words land in
 * the answer box, marked as transcribed, to edit before Send. Nothing is sent until the author presses
 * Send. Upload sits beside the microphone. Focus follows the recording: to Stop and review once it
 * listens, back to the microphone after Cancel, and to the answer box after it stops.
 */
export function Composer({ question, placeholder, multiline, busy, error, onSend, onUpload, hint }: {
  question: QuestionId | null; placeholder: string; multiline?: boolean; busy: boolean; error: string | null;
  onSend: (text: string, voice: boolean) => Promise<boolean>; onUpload?: (f: File) => void; hint?: string;
}) {
  const [text, setText] = useState('');
  const [voiced, setVoiced] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const mic = useRef<HTMLButtonElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  /** Where focus goes when the recording view closes. */
  const after = useRef<'mic' | 'box' | null>(null);
  const provider = useMemo(() => createAuthorSpeech(question), [question]);
  const speech = useSpeech(provider, {
    // The author's click on the microphone is their consent: nothing records before it.
    consented: true, review: false, mode: 'pushToTalk',
    onTranscript: t => {
      setText(prev => (prev.trim() ? `${prev.trim()} ${t}` : t));
      setVoiced(Math.max(1, Math.round((Date.now() - started.current) / 1000)));
      requestAnimationFrame(() => box.current?.focus());
    }
  });
  const recording = speech.status === 'requesting' || speech.status === 'listening' || speech.status === 'finishing';

  useEffect(() => {
    if (speech.status !== 'listening') return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setElapsed(s);
      if (s >= MAX_SECONDS) { after.current = 'box'; void speech.stop(); }
    }, 250);
    return () => clearInterval(t);
  }, [speech, speech.status]);

  useEffect(() => {
    if (speech.status === 'listening') stopButton.current?.focus();
  }, [speech.status]);

  useEffect(() => {
    if (recording || !after.current) return;
    const to = after.current;
    after.current = null;
    (to === 'mic' ? mic.current : box.current)?.focus();
  }, [recording]);

  function stop() {
    after.current = 'box';
    void speech.stop();
  }

  function cancel() {
    after.current = 'mic';
    speech.cancel();
  }

  async function record() {
    started.current = Date.now();
    setElapsed(0);
    await speech.start();
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    if (await onSend(text, voiced !== null)) { setText(''); setVoiced(null); }
  }

  const live = `${speech.transcript} ${speech.partial}`.trim();
  const levels = speech.levels.length ? speech.levels : Array.from({ length: 24 }, () => 0.1);
  const micError = speech.error && (speech.error.code === 'denied' || speech.error.code === 'unsupported' || speech.error.code === 'noDevice')
    ? 'Kora cannot use a microphone here. Type your answer instead.' : speech.error ? 'The recording stopped. Try again, or type your answer.' : null;

  if (recording) {
    return (
      <div className="flex flex-none flex-col gap-3 rounded-16 border-2 border-solid border-author-decline bg-author-surface p-4" role="group" aria-label="Recording your answer">
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden="true" className="size-2.5 animate-[ilPulse_1.2s_ease-in-out_infinite] rounded-round bg-author-decline" />
          <span className="text-15 font-800 text-author-decline" role="status">Recording &middot; {clock(elapsed)}</span>
          <span aria-hidden="true" className="flex h-7 items-center gap-0.5">
            {levels.slice(-28).map((l, i) => <span key={i} className="w-1 rounded-2 bg-author-decline" style={{ height: `${Math.max(12, Math.min(100, l * 100))}%` }} />)}
          </span>
          <span className="ms-auto text-13 text-author-muted">Up to 2 minutes</span>
        </div>
        <div className="flex flex-col gap-1 rounded-12 bg-author-track px-3 py-2.5">
          <span className="text-11 font-800 tracking-[0.12em] text-author-label uppercase">Live transcript</span>
          <p className="m-0 min-h-6 text-16 text-author-body" aria-live="polite">{live || 'Listening.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-13 text-author-muted">Nothing is sent until you review the transcript and press Send.</span>
          <span className="flex-1" />
          <button type="button" className={BUTTON.secondary} onClick={cancel}>Cancel</button>
          <button type="button" ref={stopButton} className={BUTTON.danger} disabled={speech.status !== 'listening'} onClick={stop}>{Icon.stop(14)} Stop and review</button>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-none flex-col gap-2" onSubmit={submit}>
      <div className={`flex flex-col gap-2 rounded-16 border border-solid bg-author-surface p-3 ${voiced !== null ? 'border-author-primary' : 'border-author-line-control'}`}>
        {voiced !== null && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-10 bg-author-ai-field px-3 py-2">
            <span className="flex items-center gap-1.5 text-13 font-800 text-author-ai">{Icon.mic(14)} Transcribed from your recording &middot; {clock(voiced)}</span>
            <span className="text-13 text-author-body">Check the words, edit anything, then send</span>
            <span className="flex-1" />
            <button type="button" className={BUTTON.link} onClick={() => { setText(''); setVoiced(null); void record(); }}>Record again</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="author-answer">Your answer</label>
          <textarea id="author-answer" ref={box} rows={multiline ? 4 : 2} value={text} placeholder={placeholder} disabled={busy}
            onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !multiline) { e.preventDefault(); void submit(); } }}
            aria-invalid={!!error} aria-describedby={error ? 'author-error' : undefined}
            className={`min-h-12 flex-1 resize-none rounded-8 border-0 bg-transparent px-1 py-1.5 text-15 leading-[1.5] text-author-ink placeholder:text-author-muted ${FOCUS}`} />
          <button type="button" ref={mic} className={`${BUTTON.secondary} size-11 px-0`} aria-label="Record your answer" disabled={busy || !question} onClick={() => void record()}>{Icon.mic(18)}</button>
          {onUpload && (
            <label className={`${BUTTON.secondary} size-11 px-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary`}>
              <span className="sr-only">Upload a brief, a job description or a framework</span>{Icon.clip(18)}
              <input type="file" accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }} />
            </label>
          )}
          <button type="submit" className={`${BUTTON.primary} min-h-11 px-5`} disabled={busy || !text.trim()}>Send</button>
        </div>
      </div>
      {(error || micError) && <p id="author-error" role="alert" className="m-0 text-14 font-700 text-author-decline">{error ?? micError}</p>}
      {hint && <p className="m-0 text-12 text-author-muted">{hint}</p>}
    </form>
  );
}
