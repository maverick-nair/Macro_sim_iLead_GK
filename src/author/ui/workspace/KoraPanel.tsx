import { useEffect, useRef, useState } from 'react';
import { askKora } from '../../editor';
import type { Tab } from '../../model/draft';
import type { KoraAnswer } from '../../model/intents';
import { applySuggestion } from '../../model/kora';
import { applyOps, checkOps, type Change } from '../../model/patch';
import { nextMark, useAuthor } from '../../model/store';
import { BUTTON, CARD, FOCUS, Icon, Scroll, TextArea } from '../kit';

const EXAMPLES: Partial<Record<Tab, string[]>> = {
  overview: ['Make it harder', 'Make decisions less obvious', 'Shorten it to a 30 minute Lite run', 'Add a remote team member'],
  brief: ['Make the tone warmer', 'Shorten it to a 30 minute Lite run'],
  story: ['Make the sponsor more demanding', 'Make the tone more direct'],
  process: ['Make it harder', 'Make the run 6 weeks'],
  team: ['Make the first character more defensive in the first meeting', 'Add a remote team member'],
  lens: ['Make the tone warmer', 'Make decisions less obvious'],
  actions: ['Make decisions less obvious', 'Introduce stronger trade-offs'],
  events: ['Make consequences carry forward', 'Introduce stronger trade-offs', 'Make it harder']
};
const PLACEHOLDER: Partial<Record<Tab, string>> = {
  overview: 'For example: make the sponsor more demanding',
  team: 'For example: make a character more confident',
  events: 'For example: make the week 3 event more tense',
  actions: 'For example: make decisions less obvious'
};
/** Diff rows shown before "Show all". */
const SHOWN = 6;

type State =
  | { kind: 'idle' }
  | { kind: 'thinking'; asked: string }
  | { kind: 'answer'; asked: string; answer: KoraAnswer; fallback: string | null; variant: number };

function Row({ c }: { c: Change }) {
  return (
    <li className="flex flex-col gap-1 border-t border-solid border-author-ai-line-strong pt-2 first:border-t-0 first:pt-0">
      <b className="text-13">{c.field}</b>
      {c.before && <span className="text-13 text-author-body line-through"><span className="sr-only">Now: </span>{c.before}</span>}
      <span className="text-14 leading-[1.5]">{c.after ? <><span className="sr-only">Becomes: </span>{c.after}</> : <i>Removed</i>}</span>
    </li>
  );
}

/**
 * Ask Kora (D107, D125, D127): the copilot beside the tabs. Kora's ideas for this tab (dashed; nothing
 * changes until the author uses one) and plain instructions. An instruction comes back as a proposal, a
 * structured diff (each field with its current and new value) to apply or discard, or as an honest reply
 * (a question, or "I can't do that yet"). With a server the model answers within 30 seconds or the rules
 * do, and the panel says so; a request can be cancelled. Apply goes through the store, so the change is
 * one step in the draft's history; a field the author wrote stays theirs (marked Edited).
 */
export function KoraPanel({ tab, onClose }: { tab: Tab; onClose?: () => void }) {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [note, setNote] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const suggestions = draft.suggestions.filter(s => s.tab === tab && !s.done);
  const examples = (EXAMPLES[tab] ?? []).map(e => e.replace('the first character', draft.team[0]?.first || 'the first character'));

  async function ask(instruction: string, opts: { variant?: number; useModel?: boolean } = {}) {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setNote('Kora is thinking.');
    setState({ kind: 'thinking', asked: instruction });
    try {
      const r = await askKora(draft, tab, instruction, { signal: ctl.signal, variant: opts.variant, useModel: opts.useModel });
      if (abort.current !== ctl) return;
      setNote(null);
      setState({ kind: 'answer', asked: instruction, answer: r.answer, fallback: r.fallback, variant: opts.variant ?? 0 });
    } catch {
      // Cancelled: back to the instruction box.
      if (abort.current === ctl) setState({ kind: 'idle' });
    }
  }

  function apply(a: Extract<KoraAnswer, { kind: 'change' }>) {
    // The draft may have changed since the proposal: check again against it as it is now.
    const c = checkOps(draft, a.ops);
    if (!c.ok || !c.ops.length) { setState({ kind: 'idle' }); setNote('The draft has changed since I proposed this. Ask again and I will work from it as it is now.'); return; }
    edit(d => { applyOps(d, c.ops); }, c.marks, 'ai');
    setState({ kind: 'idle' });
    setNote(`Applied ${c.ops.length} change${c.ops.length === 1 ? '' : 's'}. Fields you had written stay marked as yours.`);
  }

  const answer = state.kind === 'answer' ? state.answer : null;
  return (
    <aside aria-labelledby="kora-title" className="flex min-h-0 flex-col gap-3 border-s border-solid border-author-line bg-author-surface px-5 pt-5 pb-4">
      <div className="flex flex-none items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="kora-title" className="m-0 text-18 font-800">Ask Kora</h2>
          {tab === 'overview' && <p className="m-0 text-13 text-author-body">Change anything in plain words. I show what will change before I apply it.</p>}
        </div>
        {onClose && <button type="button" className={`${BUTTON.secondary} size-9 px-0`} aria-label="Close Ask Kora" onClick={onClose}>{Icon.close()}</button>}
      </div>
      <Scroll label="Kora's suggestions and changes" className="-mx-1 flex flex-1 flex-col gap-3 px-1">
        <div className="flex flex-col gap-3">
          {suggestions.map(s => (
            <section key={s.id} aria-label="Suggestion" className="flex flex-col gap-2 rounded-14 border-[1.5px] border-dashed border-author-kora p-3">
              <h3 className="m-0 text-14 font-800 text-author-ai">Suggestion</h3>
              <p className="m-0 text-13 leading-[1.5]">{s.text}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BUTTON.kora} onClick={() => edit(d => { const paths = applySuggestion(d, s.id); for (const p of paths) d.marks[p] = nextMark(d.marks[p], 'ai'); })}>{s.action}</button>
                <button type="button" className={BUTTON.secondary} onClick={() => edit(d => { const x = d.suggestions.find(y => y.id === s.id); if (x) x.done = true; })}>Not now</button>
              </div>
            </section>
          ))}
          {state.kind === 'idle' && examples.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Try asking">
              {examples.map(e => <li key={e}><button type="button" className={`min-h-10 w-full cursor-pointer rounded-10 border border-solid border-author-line-control bg-author-surface px-3 py-2 text-start text-13 font-700 text-author-ink hover:bg-author-track ${FOCUS}`} onClick={() => void ask(e)}>{e}</button></li>)}
            </ul>
          )}
          {state.kind !== 'idle' && <p className="m-0 self-end rounded-14 bg-author-primary px-3 py-2 text-14 text-author-on-primary"><span className="sr-only">You asked: </span>{state.asked}</p>}
          {state.kind === 'thinking' && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={BUTTON.secondary} onClick={() => { abort.current?.abort(); setState({ kind: 'idle' }); setNote('Cancelled. Nothing changed.'); }}>Cancel</button>
            </div>
          )}
          {state.kind === 'answer' && state.fallback && (
            <div className="flex flex-wrap items-center gap-2 rounded-12 bg-author-track p-2 text-13 text-author-body">
              <span className="min-w-40 flex-1">{state.fallback}</span>
              <button type="button" className={BUTTON.secondary} onClick={() => void ask(state.asked)}>Retry with the model</button>
            </div>
          )}
          {state.kind === 'answer' && answer?.kind === 'reply' && (
            <section aria-label="Kora's reply" className="flex flex-col gap-2 rounded-14 border border-solid border-author-line p-3">
              <p className="m-0 text-14 leading-[1.5]">{answer.reply}</p>
              {answer.options && (
                <div className="flex flex-wrap gap-2">
                  {answer.options.map(o => <button key={o} type="button" className={BUTTON.koraOutline} onClick={() => void ask(o)}>{o}</button>)}
                </div>
              )}
              <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => setState({ kind: 'idle' })}>OK</button>
            </section>
          )}
          {state.kind === 'answer' && answer?.kind === 'change' && (
            <section aria-label="Proposed change" className="flex flex-col gap-2 rounded-14 border border-solid border-author-ai-line-strong bg-author-ai-field p-3">
              <h3 className="m-0 text-14 font-800 text-author-ai">Proposed change &middot; {answer.changes.length} field{answer.changes.length === 1 ? '' : 's'}</h3>
              {answer.reply && <p className="m-0 text-13 leading-[1.5]">{answer.reply}</p>}
              <ul aria-label="What changes" className="m-0 flex list-none flex-col gap-2 p-0">
                {answer.changes.slice(0, SHOWN).map(c => <Row key={c.path} c={c} />)}
              </ul>
              {answer.changes.length > SHOWN && (
                <details>
                  <summary className="cursor-pointer text-13 font-700">Show all {answer.changes.length} changes</summary>
                  <ul aria-label="The other changes" className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                    {answer.changes.slice(SHOWN).map(c => <Row key={c.path} c={c} />)}
                  </ul>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BUTTON.primary} onClick={() => apply(answer)}>Apply</button>
                {answer.regenerate && <button type="button" className={BUTTON.secondary} onClick={() => void ask(state.asked, { variant: state.variant + 1, useModel: false })}>Try another</button>}
                <button type="button" className={BUTTON.secondary} onClick={() => { setState({ kind: 'idle' }); setNote('Discarded. Nothing changed.'); }}>Discard</button>
              </div>
            </section>
          )}
          <p role="status" className="m-0 text-13 text-author-body empty:hidden">{note}</p>
        </div>
      </Scroll>
      <form className={`${CARD} flex flex-none flex-col gap-2 p-3`} onSubmit={e => { e.preventDefault(); if (text.trim() && state.kind !== 'thinking') { void ask(text); setText(''); } }}>
        <label htmlFor="kora-instruction" className="text-13 font-700 text-author-label">{tab === 'overview' ? 'Your instruction' : 'Your instruction for this tab'}</label>
        <TextArea id="kora-instruction" rows={3} className="border-0 px-0" value={text} placeholder={PLACEHOLDER[tab] ?? 'Describe a change in plain words'} onChange={e => setText(e.target.value)} />
        <button type="submit" className={`${BUTTON.primary} self-end`} disabled={!text.trim() || state.kind === 'thinking'}>Ask</button>
      </form>
    </aside>
  );
}
