import { useEffect, useRef, useState } from 'react';
import type { Tab } from '../../model/draft';
import { markCounts, needsOf } from '../../model/needs';
import { useAuthor } from '../../model/store';
import { Badge, BUTTON, CARD, EYEBROW, Scroll } from '../kit';
import { playDraft } from '../play';
import { navigate } from '../route';
import { NAV, statusOf, summaryOf } from '../sections';
import { Header } from './Journey';

/**
 * First draft ready (docs/design/genie/DraftReady, D106): what Kora built, what still needs the
 * author, and two ways on: open the workspace, or preview week 1 as a participant (placeholders stand
 * in for what needs the author, and nothing is scored).
 */
export function DraftReady() {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const heading = useRef<HTMLHeadingElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const counts = markCounts(draft);
  const needs = needsOf(draft);
  useEffect(() => { heading.current?.focus(); }, []);
  const open = (tab: Tab) => { edit(d => { d.stage = 'workspace'; }); navigate({ page: 'workspace', tab }); };
  const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header subtitle={`${draft.story.company.name} · ${draft.title}`} />
      <Scroll label="First draft" className="flex-1">
        <main className="mx-auto grid w-full max-w-260 grid-cols-2 gap-6 px-6 py-8 max-[1000px]:grid-cols-1 short:py-5">
          <section aria-labelledby="ready-title" className={`${CARD} flex flex-col gap-5 p-8 max-[1000px]:p-6`}>
            <span className={`${EYEBROW} text-author-kora`}>First draft ready</span>
            <h1 id="ready-title" ref={heading} tabIndex={-1} className="m-0 text-36 leading-[1.1] font-800 outline-none short:text-30">
              Your simulation is playable. {needs.length ? `${words[needs.length] ?? needs.length} thing${needs.length === 1 ? '' : 's'} need${needs.length === 1 ? 's' : ''} you before you publish.` : 'Nothing needs you before you publish.'}
            </h1>
            <p className="m-0 text-16 leading-[1.5] text-author-body">I built it from your {draft.chat.asked.length} answers{draft.chat.brief.documents.length ? ' and the documents you shared' : ''}. Everything is editable, and you can regenerate any section without starting over.</p>
            <dl className="m-0 grid grid-cols-3 gap-3">
              <div className="flex flex-col rounded-12 bg-author-track p-4"><dt className="text-13 text-author-body">Answers from you</dt><dd className="m-0 order-first text-28 font-800">{draft.chat.asked.length}</dd></div>
              <div className="flex flex-col rounded-12 bg-author-ai-field p-4"><dt className="text-13 text-author-body">Fields generated</dt><dd className="m-0 order-first text-28 font-800">{counts.ai}</dd></div>
              <div className="flex flex-col rounded-12 bg-author-need-field p-4"><dt className="text-13 text-author-body">Need you</dt><dd className="m-0 order-first text-28 font-800">{needs.length}</dd></div>
            </dl>
            {needs.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-12 border border-solid border-author-need-line bg-author-need-field p-4">
                <h2 className="m-0 text-15 font-800 text-author-need">Needs you</h2>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {needs.map(n => <li key={n.id}><button type="button" className={BUTTON.link} onClick={() => open(n.tab)}>{n.label} &middot; {n.where} &middot; Required</button></li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" className={BUTTON.big} onClick={() => open('overview')}>Open the workspace</button>
              <button type="button" className={`${BUTTON.secondary} min-h-12 px-5 text-16`} onClick={() => { const r = playDraft(draft); setProblem(r.ok ? null : r.reason === 'storage' ? r.issues[0] : `The draft does not play yet: ${r.issues[0]}`); }}>Preview week 1 as a participant</button>
            </div>
            {problem && <p role="alert" className="m-0 text-14 font-700 text-author-decline">{problem}</p>}
            <p className="m-0 text-13 text-author-muted">The draft is already playable. A preview lets you feel the story and the team before you refine them; it uses placeholders for the items that need you and saves no scores.</p>
          </section>
          <section aria-labelledby="built" className={`${CARD} flex flex-col gap-1 p-7`}>
            <h2 id="built" className="m-0 mb-2 text-18 font-800">What I built</h2>
            <ol className="m-0 flex list-none flex-col p-0">
              {NAV.filter(n => n.n && n.n <= 9).map(n => {
                const st = statusOf(draft, n.tab);
                return (
                  <li key={n.tab} className="flex items-center gap-3 border-b border-solid border-author-rule py-3 last:border-b-0">
                    <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-round text-13 font-700 ${st.kind === 'need' ? 'bg-author-need-field text-author-need' : st.kind === 'done' ? 'bg-author-gain-soft text-author-gain' : 'bg-author-track text-author-label'}`}>{n.n}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-start text-15 font-800 text-author-ink hover:underline focus-visible:outline-2 focus-visible:outline-author-primary" onClick={() => open(n.tab)}>{n.label}</button>
                      <span className="text-13 text-author-body">{summaryOf(draft, n.tab)}</span>
                    </span>
                    <Badge kind={st.kind === 'you' ? 'you' : st.kind}>{st.text}</Badge>
                  </li>
                );
              })}
            </ol>
          </section>
        </main>
      </Scroll>
    </div>
  );
}
