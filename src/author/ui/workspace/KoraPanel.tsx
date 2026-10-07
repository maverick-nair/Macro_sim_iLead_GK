import { useState } from 'react';
import type { Tab } from '../../model/draft';
import { applySuggestion, propose, type Proposal } from '../../model/kora';
import { useAuthor } from '../../model/store';
import { BUTTON, CARD, FOCUS, Icon, Scroll, TextArea } from '../kit';
import { labelOf } from '../sections';

const EXAMPLES: Partial<Record<Tab, string[]>> = {
  overview: ['Make the story more about pricing pressure', 'Shorten it to a 30 minute Lite run', 'Add a remote team member'],
  team: ['Make the first character more defensive in the first meeting'],
  story: ['Make the sponsor more demanding']
};
const PLACEHOLDER: Partial<Record<Tab, string>> = {
  overview: 'For example: make the sponsor more demanding',
  team: 'For example: give the closers more experience',
  scoring: 'For example: make the report shorter for senior leaders'
};

/**
 * Ask Kora (D107): the copilot beside every tab. Kora's ideas for this tab (dashed, nothing changes until
 * the author uses one), and plain instructions that come back as a proposed change, the old words struck
 * through, to apply, try again or discard. Applied changes are marked as Kora's.
 */
export function KoraPanel({ tab, onClose }: { tab: Tab; onClose?: () => void }) {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [text, setText] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const suggestions = draft.suggestions.filter(s => s.tab === tab && !s.done);
  const examples = (EXAMPLES[tab] ?? []).map(e => e.replace('the first character', draft.team[0]?.first ?? 'the first character'));

  function ask(instruction: string, v = 0) {
    const p = propose(draft, tab, instruction, v);
    setAsked(instruction); setVariant(v); setProposal(p); setNote(p ? null : 'Tell me what to change in plain words.');
  }

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
                <button type="button" className={BUTTON.kora} onClick={() => edit(d => { const paths = applySuggestion(d, s.id); for (const p of paths) d.marks[p] = 'ai'; })}>{s.action}</button>
                <button type="button" className={BUTTON.secondary} onClick={() => edit(d => { const x = d.suggestions.find(y => y.id === s.id); if (x) x.done = true; })}>Not now</button>
              </div>
            </section>
          ))}
          {!asked && examples.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Try asking">
              {examples.map(e => <li key={e}><button type="button" className={`min-h-10 w-full cursor-pointer rounded-10 border border-solid border-author-line-control bg-author-surface px-3 py-2 text-start text-13 font-700 text-author-ink hover:bg-author-track ${FOCUS}`} onClick={() => ask(e)}>{e}</button></li>)}
            </ul>
          )}
          {asked && <p className="m-0 self-end rounded-14 bg-author-primary px-3 py-2 text-14 text-author-on-primary"><span className="sr-only">You asked: </span>{asked}</p>}
          {proposal && (
            <section aria-label="Proposed change" className="flex flex-col gap-2 rounded-14 border border-solid border-author-ai-line-strong bg-author-ai-field p-3">
              <h3 className="m-0 text-14 font-800 text-author-ai">Proposed change &middot; {proposal.label}</h3>
              {proposal.before && <p className="m-0 text-13 text-author-body line-through"><span className="sr-only">Now: </span>{proposal.before}</p>}
              <p className="m-0 text-14 leading-[1.5]"><span className="sr-only">Becomes: </span>{proposal.after}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BUTTON.primary} onClick={() => { edit(d => proposal.apply(d), proposal.path, 'ai'); setProposal(null); setNote(`Applied to ${proposal.label.toLowerCase()}. Edit it any time in ${labelOf(proposal.path.startsWith('team') ? 'team' : proposal.path.startsWith('events') ? 'events' : proposal.path.startsWith('brief') ? 'brief' : 'story')}.`); }}>Apply</button>
                <button type="button" className={BUTTON.secondary} onClick={() => ask(asked!, variant + 1)}>Try again</button>
                <button type="button" className={BUTTON.secondary} onClick={() => { setProposal(null); setAsked(null); }}>Discard</button>
              </div>
            </section>
          )}
          {note && <p role="status" className="m-0 text-13 text-author-body">{note}</p>}
        </div>
      </Scroll>
      <form className={`${CARD} flex flex-none flex-col gap-2 p-3`} onSubmit={e => { e.preventDefault(); if (text.trim()) { ask(text); setText(''); } }}>
        <label htmlFor="kora-instruction" className="text-13 font-700 text-author-label">{tab === 'overview' ? 'Your instruction' : 'Your instruction for this tab'}</label>
        <TextArea id="kora-instruction" rows={3} className="border-0 px-0" value={text} placeholder={PLACEHOLDER[tab] ?? 'Describe a change in plain words'} onChange={e => setText(e.target.value)} />
        <button type="submit" className={`${BUTTON.primary} self-end`} disabled={!text.trim()}>Ask</button>
      </form>
    </aside>
  );
}
