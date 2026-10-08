import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FrameworkDimension } from '../../../api/author';
import { LENS_IDS, type LensId } from '../../../engine/lens';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import type { Drafter } from '../../drafter';
import { LENS_BY_ID } from '../../lenses';
import { useAuthor } from '../../model/store';
import { Badge, BUTTON, CARD, EYEBROW, FOCUS, savedText, Scroll } from '../kit';
import { navigate } from '../route';
import { Composer } from './Composer';
import { Intro } from './Intro';
import { SoFar } from './SoFar';
import { useJourney, type Journey as J } from './useJourney';
import { DECIDE, questionFor as askFor } from '../../questions';
import type { QuestionId } from '../../../api/author';
import { QUESTION_IDS } from '../../../api/author';

/** `**bold**` in Kora's notes. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p));
}

function Bubble({ from, children }: { from: 'kora' | 'author'; children: ReactNode }) {
  return from === 'kora'
    ? <div className={`${CARD} max-w-[44rem] self-start px-4 py-3 text-16 leading-[1.5]`}>{children}</div>
    : <div className="max-w-[44rem] self-end rounded-16 bg-author-primary px-4 py-3 text-16 leading-[1.5] text-author-on-primary">{children}</div>;
}

export function Header({ subtitle, children }: { subtitle: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex min-h-16 flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-solid border-author-line bg-author-surface px-7 py-2.5 max-[1100px]:px-4">
      <span className="text-20 font-800 text-author-ink">Genie<span className="text-author-kora">Kreator</span></span>
      <span className="text-14 text-author-body">{subtitle}</span>
      <span className="flex-1" />
      {children}
    </header>
  );
}

function LensStep({ j }: { j: J }) {
  const rec = j.chat.recommendation!;
  const [all, setAll] = useState(false);
  const [detail, setDetail] = useState<LensId | null>(null);
  const primary = j.chat.primary ?? rec.id;
  const lib = LENS_BY_ID[primary];
  const ORDER: LensId[] = ['inspire_deliver', 'team_amplifier', 'servant', 'adaptive', 'five_practices', 'six_styles', 'readiness_based'];
  const shown: LensId[] = all ? LENS_IDS.filter(id => id !== rec.id) : ORDER.filter(id => id !== rec.id && id !== LENS_BY_ID[rec.id].worksWith).slice(0, 2);
  const needsFramework = primary === 'client_model';
  const dims = j.chat.clientDimensions;
  const setDims = (d: FrameworkDimension[]) => j.chooseLensDims(d);
  return (
    <div className="flex flex-col gap-3" aria-label="Choose your leadership lens" role="group">
      <Bubble from="kora">Then I recommend one lens. Your lens decides how the team behaves, how choices are scored and what the report says.</Bubble>
      <article aria-labelledby="lens-rec" className="flex max-w-[47rem] flex-col gap-2 rounded-16 border-2 border-solid border-author-kora bg-author-ai-field p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="lens-rec" className="m-0 text-16 font-800">{LENS_BY_ID[rec.id].title}</h3>
          <Badge kind="ai">Recommended</Badge>
        </div>
        <p className="m-0 text-14 text-author-body">{LENS_BY_ID[rec.id].description}</p>
        <p className="m-0 text-14 font-700 text-author-ai">Why for you: {rec.reason.replace(/^We recommend [^.]*? because /, '')}</p>
        {detail === rec.id && <LensDetail id={rec.id} />}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className={BUTTON.kora} onClick={() => j.draftNow(rec.id)} disabled={rec.id === 'client_model' && dims.length < 2}>Use this lens</button>
          <button type="button" className={BUTTON.secondary} aria-expanded={detail === rec.id} onClick={() => setDetail(detail === rec.id ? null : rec.id)}>More detail</button>
        </div>
      </article>
      <div className={`grid max-w-[47rem] gap-3 ${all ? 'grid-cols-1' : 'grid-cols-2 max-[700px]:grid-cols-1'}`}>
        {shown.map(id => (
          <article key={id} aria-labelledby={`lens-${id}`} className={`${CARD} flex flex-col gap-1.5 p-4 ${primary === id ? 'border-author-primary' : ''}`}>
            <h3 id={`lens-${id}`} className="m-0 text-15 font-800">{LENS_BY_ID[id].title}</h3>
            <p className="m-0 text-13 text-author-body">{LENS_BY_ID[id].description}</p>
            {all && <p className="m-0 text-13 text-author-muted">Best for: {LENS_BY_ID[id].bestFor}</p>}
            {detail === id && <LensDetail id={id} />}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className={BUTTON.secondary} onClick={() => (id === 'client_model' ? j.chooseLens(id, null) : j.draftNow(id))}>{id === 'client_model' ? 'Use my framework' : 'Use this lens'}</button>
              <button type="button" className={BUTTON.link} aria-expanded={detail === id} onClick={() => setDetail(detail === id ? null : id)}>More detail<span className="sr-only"> on {LENS_BY_ID[id].title}</span></button>
            </div>
          </article>
        ))}
      </div>
      <button type="button" className={`${BUTTON.link} self-start`} aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show fewer lenses' : 'See all 8 lenses, or upload your own framework'}</button>
      {needsFramework && (
        <div className={`${CARD} flex max-w-[47rem] flex-col gap-2 p-4`}>
          <h3 className="m-0 text-15 font-800">Your framework</h3>
          {dims.length ? (
            <>
              <p className="m-0 text-14 text-author-body">I read these skills from your document. Nothing here is invented; edit any of them.</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {dims.map((d, i) => (
                  <li key={i} className="flex flex-col gap-1 rounded-12 bg-author-ai-field p-3">
                    <label className="text-12 font-700 text-author-label" htmlFor={`dim-${i}`}>Skill {i + 1}</label>
                    <input id={`dim-${i}`} className={`rounded-8 border border-solid border-author-ai-line bg-author-surface px-2 py-1.5 text-14 ${FOCUS}`} value={d.name} onChange={e => setDims(dims.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                    <span className="text-13 text-author-body">{d.behaviours.join('; ')}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className={`${BUTTON.kora} self-start`} disabled={dims.filter(d => d.name.trim()).length < 2} onClick={() => j.draftNow('client_model')}>Use my framework</button>
            </>
          ) : <p className="m-0 text-14 text-author-body">Upload your framework with the paperclip below, or paste it into the answer box. I read a heading per skill and its behaviors as a list.</p>}
        </div>
      )}
      {LENS_BY_ID[primary].worksWith !== primary && (
        <div className={`${CARD} flex max-w-[47rem] flex-wrap items-center gap-3 px-4 py-3`}>
          <p className="m-0 flex-1 text-15">Optional: add <b>{LENS_BY_ID[lib.worksWith].title}</b> as a second lens. It adds report dimensions only, no extra game rules.</p>
          <button type="button" className={BUTTON.secondary} aria-pressed={j.chat.secondary === lib.worksWith} onClick={() => j.chooseLens(primary, j.chat.secondary === lib.worksWith ? null : lib.worksWith)}>{j.chat.secondary === lib.worksWith ? 'Added' : 'Add it'}</button>
        </div>
      )}
    </div>
  );
}

function LensDetail({ id }: { id: LensId }) {
  const l = LENS_BY_ID[id];
  return (
    <dl className="m-0 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-13">
      <dt className="font-700 text-author-label">Best for</dt><dd className="m-0">{l.bestFor}</dd>
      <dt className="font-700 text-author-label">Based on</dt><dd className="m-0">{l.basedOn}</dd>
      <dt className="font-700 text-author-label">Team</dt><dd className="m-0">{l.npcDesign}</dd>
      <dt className="font-700 text-author-label">Scored on</dt><dd className="m-0">{l.dimensions.map(d => d.name).join(', ') || 'Your framework\'s skills'}</dd>
    </dl>
  );
}

/**
 * The co-creator chat (docs/design/genie/ChatStart, ChatVoice, ChatLens; D106): 5 to 10 questions with a
 * live "Your simulation so far" beside them, voice or typed answers, then the lens recommendation.
 * Two panes from 1180 wide; below, the panel folds above the chat. The composer never scrolls away.
 */
export function JourneyPage({ drafters }: { drafters?: Drafter[] }) {
  const j = useJourney(drafters);
  const saved = useAuthor(s => savedText(s.savedAt, s.saveFailed));
  const wide = useMediaQuery('(min-width: 1180px)');
  const log = useRef<HTMLDivElement>(null);
  const { chat, question } = j;
  const progress = chat.current ? Math.round(((chat.current.n - 1) / chat.current.about) * 100) : 100;

  useEffect(() => {
    const el = log.current?.parentElement;
    // A fresh chat reads from the top: what an iLead simulation is comes before question 1 (D133).
    if (el) el.scrollTop = chat.log.length ? el.scrollHeight : 0;
  }, [chat.log.length, chat.current?.id, chat.recommendation, j.busy]);

  const panel = <SoFar chat={chat} onChange={id => j.startEdit(id)} />;
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header subtitle="New iLead business simulation">
        <span className="text-13 text-author-muted" role="status">{saved}</span>
        <button type="button" className={BUTTON.link} onClick={() => { j.draftNow(); navigate({ page: 'workspace', tab: 'overview' }); }}>Skip to the workspace</button>
      </Header>
      <div className={`grid min-h-0 flex-1 ${wide ? 'grid-cols-[minmax(0,1fr)_minmax(0,31rem)]' : 'grid-cols-1 grid-rows-[auto_minmax(0,1fr)]'}`}>
        {!wide && (
          <details className="flex-none border-b border-solid border-author-line bg-author-surface px-4 py-2">
            <summary className={`cursor-pointer py-1 text-16 font-800 ${FOCUS}`}>Your simulation so far</summary>
            <Scroll label="Your simulation so far" className="max-h-[38dvh] py-2">{panel}</Scroll>
          </details>
        )}
        <main className="flex min-h-0 min-w-0 flex-col gap-3 px-14 pt-6 pb-4 max-[1400px]:px-8 max-[900px]:px-4 short:pt-4">
          <h1 className="sr-only">Create your simulation with Kora</h1>
          {chat.current && (
            <div className="flex flex-none items-center gap-3">
              <span className="text-14 font-800 whitespace-nowrap text-author-ai">Question {chat.current.n} of about {chat.current.about}</span>
              <div role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-author-track">
                <div className="h-full rounded-pill bg-author-kora" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <Scroll label="Conversation with Kora" className="relative -mx-1 flex-1 px-1">
            <div ref={log} role="log" aria-label="Conversation" className="flex flex-col gap-3 pb-2">
              <Intro folded={chat.log.length > 0} />
              {chat.log.map((e, i) => e.kind === 'took'
                ? <Took key={i} items={e.items} j={j} />
                : e.kind === 'note'
                ? e.took
                  ? (
                    <div key={i} className="flex max-w-[37rem] flex-col gap-1.5 rounded-16 border border-solid border-author-ai-line bg-author-ai-field px-4 py-3">
                      <span className={`${EYEBROW} text-author-ai`}>Here is what I took from that</span>
                      <p className="m-0 text-15 leading-[1.5]">{rich(e.text)}</p>
                      <span className="flex gap-4">
                        <button type="button" className={BUTTON.link} onClick={() => { j.draftNow(); navigate({ page: 'workspace', tab: 'process' }); }}>See it in the draft</button>
                        <button type="button" className={BUTTON.link} onClick={() => j.startEdit('challenge')}>Change this</button>
                      </span>
                    </div>
                  )
                  : <Bubble key={i} from="kora">{rich(e.text)}</Bubble>
                : (
                  <div key={i} className="flex flex-col gap-3">
                    <Bubble from="kora">{e.prompt}</Bubble>
                    <Bubble from="author"><span className="sr-only">You{e.voice ? ', by voice' : ''}: </span>{e.answer}</Bubble>
                  </div>
                ))}
              {j.fitOpen && !j.editing && (
                <div role="group" aria-label="Does iLead fit this brief?" className="flex max-w-[44rem] flex-wrap gap-2 self-start">
                  <button type="button" className={BUTTON.kora} onClick={j.continueFit}>Continue with a team leadership version</button>
                  <button type="button" className={BUTTON.secondary} onClick={j.changeBrief}>Change the brief</button>
                </div>
              )}
              {j.clarify && !j.fitOpen && !j.editing && (
                <Bubble from="kora"><span className="sr-only">Kora asks: </span>{j.clarify.prompt}</Bubble>
              )}
              {question && !j.fitOpen && !j.clarify && (
                <Bubble from="kora">
                  {question.prompt}
                  {question.confirm && <span className="mt-1 block text-14 text-author-body">From what you shared: {question.confirm}. Is that right?</span>}
                  {question.help && <span className="mt-1 block text-14 text-author-body">{question.help}</span>}
                </Bubble>
              )}
              {j.editing && <Bubble from="kora">Tell me the new answer to: {askFor(j.editing).prompt}</Bubble>}
              {j.pending && <PendingCard j={j} />}
              {chat.recommendation && !chat.current && !j.editing && !j.fitOpen && !j.clarify && <LensStep j={j} />}
              {j.busy && (
                <p className="m-0 flex items-center gap-3 text-14 text-author-muted">
                  <span role="status">Kora is thinking.</span>
                  <button type="button" className={BUTTON.link} onClick={j.cancel}>Cancel</button>
                </p>
              )}
              {j.failure && !j.busy && (
                <div role="alert" className="flex max-w-[44rem] flex-col gap-2 self-start rounded-16 border border-solid border-author-need-line bg-author-need-field px-4 py-3">
                  <p className="m-0 text-15 font-700 text-author-need">{j.failure.message}</p>
                  <span className="flex flex-wrap gap-2">
                    <button type="button" className={BUTTON.primary} onClick={j.retry}>Retry</button>
                    <button type="button" className={BUTTON.secondary} onClick={j.continueOffline}>Continue offline</button>
                  </span>
                </div>
              )}
            </div>
          </Scroll>
          {(question || j.editing || j.clarify) && !(j.fitOpen && !j.editing) && (
            <div className="flex flex-none flex-wrap gap-2" role="group" aria-label="Suggested answers">
              {(j.editing ? [] : j.clarify ? j.clarify.choices : [...question!.chips.slice(0, 6), ...question!.chips.slice(6).filter(c => c.value === DECIDE)]).map(c => (
                <button key={c.value} type="button" disabled={j.busy} onClick={() => void j.answer(c.value)}
                  className={`min-h-10 cursor-pointer rounded-pill border border-solid px-4 text-14 font-700 ${/default/i.test(c.label) ? 'border-author-kora bg-author-ai-field text-author-ink' : 'border-author-line-control bg-author-surface text-author-ink hover:bg-author-track'} ${FOCUS}`}>
                  {c.label.replace(' (default)', ' · suggested')}
                </button>
              ))}
              {j.editing && <button type="button" className={BUTTON.secondary} onClick={j.cancelEdit}>Keep my answer</button>}
            </div>
          )}
          <Composer question={j.askId} busy={j.busy} error={j.error} multiline={j.askId === 'framework'}
            placeholder={j.askId ? (question?.placeholder ?? 'Your answer') : 'Pick a lens above, or tell me what matters most'}
            onUpload={f => void j.upload(f)}
            onSend={async (text, voice) => {
              if (j.askId) return j.answer(text, voice);
              const id = LENS_IDS.find(l => text.toLowerCase().includes(LENS_BY_ID[l].title.toLowerCase().split(' ')[0].toLowerCase()));
              if (id) { j.draftNow(id); return true; }
              j.setError('Pick one of the lenses above, or name one: for example Servant Leadership.');
              return false;
            }}
            hint={j.askId ? 'Type or record your answer. A recording turns into text you can edit before you send. Upload a brief, a job description or your leadership framework at any time; I will skip questions it answers.' : undefined} />
        </main>
        {wide && (
          <aside aria-labelledby="so-far" className="flex min-h-0 flex-col gap-3 border-s border-solid border-author-line bg-author-surface px-6 pt-6 pb-4">
            <div className="flex flex-none items-baseline justify-between gap-2">
              <h2 id="so-far" className="m-0 text-20 font-800">Your simulation so far</h2>
              <span className="text-13 text-author-muted">Updates as you answer</span>
            </div>
            <Scroll label="Your simulation so far" className="-mx-1 flex-1 px-1 pb-2">{panel}</Scroll>
          </aside>
        )}
      </div>
    </div>
  );
}

const isQuestion = (id: string): id is QuestionId => (QUESTION_IDS as readonly string[]).includes(id);

/** "I took these from your brief" (D146): each thing a long answer or an upload gave, with a way to change it. */
function Took({ items, j }: { items: Array<{ id: string; label: string; value: string }>; j: J }) {
  return (
    <section aria-label="I took these from your brief" className="flex max-w-[44rem] flex-col gap-2 self-start rounded-16 border border-solid border-author-ai-line bg-author-ai-field px-4 py-3">
      <span className={`${EYEBROW} text-author-ai`}>I took these from your brief</span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-15 leading-[1.45]">
        {items.map(it => (
          <li key={it.id}>
            <b>{it.label}:</b> {it.value}
            {isQuestion(it.id) && <> <button type="button" className={BUTTON.link} disabled={j.busy} onClick={() => j.startEdit(it.id as QuestionId)}>Change<span className="sr-only"> {it.label}</span></button></>}
          </li>
        ))}
      </ul>
      <p className="m-0 text-13 text-author-body">I will skip the questions these answer. {items.some(it => !isQuestion(it.id)) ? 'Stakeholders, objectives and dilemmas stay with the brief: edit them in the Brief once the draft is ready.' : 'Change any of them here, or later in the Brief.'}</p>
    </section>
  );
}

/** An answer changed later: what it changes in the draft, then Apply or Keep as note only (D146). */
function PendingCard({ j }: { j: J }) {
  const p = j.pending!;
  return (
    <section aria-label="What this change does" className="flex max-w-[44rem] flex-col gap-2 self-start rounded-16 border-2 border-solid border-author-kora bg-author-surface px-4 py-3">
      <p className="m-0 text-15"><b>{askFor(p.id).prompt}</b> &rarr; &ldquo;{p.raw}&rdquo;</p>
      <p className="m-0 text-15">{p.summary.length ? <>This changes: {p.summary.join(', ')}.</> : 'Nothing else in the draft depends on it.'}</p>
      <span className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON.kora} onClick={j.applyPending}>Apply</button>
        <button type="button" className={BUTTON.secondary} onClick={j.keepPendingAsNote}>Keep as note only</button>
      </span>
    </section>
  );
}
