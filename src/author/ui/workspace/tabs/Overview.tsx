import { useState } from 'react';
import { LENS_BY_ID } from '../../../lenses';
import type { Tab } from '../../../model/draft';
import { needsOf } from '../../../model/needs';
import { useAuthor } from '../../../model/store';
import { Badge, BUTTON, CARD, CardHead, MarkOf, TextInput } from '../../kit';
import { navigate } from '../../route';
import { TabBody, TabHead } from '../Workspace';

const RUN = { full: 'Full, 8 weeks, about 100 minutes', standard: 'Standard, 8 weeks, about 60 minutes', lite: 'Lite, 4 weeks, about 30 minutes' } as const;

/** Workspace: Overview (docs/design/genie/Overview): what needs the author, the essentials, and what Kora generated. */
export default function Overview() {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const reset = useAuthor(s => s.reset);
  const [deal, setDeal] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const needs = needsOf(draft);
  const total = 9;
  const done = total - new Set(needs.map(n => n.tab)).size;
  const go = (tab: Tab) => navigate({ page: 'workspace', tab });
  const rows: Array<[string, string, string]> = [
    ['Participants', draft.brief.participants, 'brief.participants'],
    ['Company', draft.story.company.name, 'story.company.name'],
    ['Sponsor', `${draft.story.sponsor.name}, ${draft.story.sponsor.title}`, 'story.sponsor.name'],
    ['Purpose', draft.brief.purpose === 'development' ? 'Development' : 'Assessment', 'brief.purpose'],
    ['Run length', RUN[draft.brief.run], 'brief.run'],
    ['Lens', LENS_BY_ID[draft.lens.id].title, 'lens.id']
  ];
  const generated: Array<[Tab, string, string]> = [
    ['team', 'Team', `${draft.team.length} characters`],
    ['events', 'Events', `${draft.events.length} across ${draft.process.weeks} weeks`],
    ['actions', 'Actions and conversations', `${draft.actions.filter(a => a.core || a.enabled).length} actions`],
    ['story', 'Story and world', 'intro screens, product']
  ];
  return (
    <TabBody label="Overview" head={
      <TabHead title="Overview" actions={
        <div className="flex min-w-60 flex-col gap-1.5">
          <div className="flex justify-between gap-4 text-14"><b>Ready to publish</b><span className="text-author-body">{needs.length} item{needs.length === 1 ? '' : 's'} need{needs.length === 1 ? 's' : ''} you</span></div>
          <div role="progressbar" aria-label="Sections ready" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-2 overflow-hidden rounded-pill bg-author-track"><div className="h-full rounded-pill bg-author-kora" style={{ width: `${(done / total) * 100}%` }} /></div>
        </div>
      }>
        {draft.story.company.name} &middot; {draft.team.length} people &middot; {draft.process.weeks} weeks &middot; {LENS_BY_ID[draft.lens.id].title} &middot; {draft.brief.purpose === 'development' ? 'Development' : 'Assessment'}
      </TabHead>
    }>
      <div className="flex flex-col gap-4">
        {needs.length > 0 && (
          <section aria-labelledby="needs-title" className="flex flex-col gap-3 rounded-16 border border-solid border-author-need-line bg-author-need-field p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="needs-title" className="m-0 text-18 font-800 text-author-need">Needs you &middot; {needs.length}</h2>
              <span className="text-13 text-author-need">Required before publishing</span>
            </div>
            <div className="grid grid-cols-2 gap-3 max-[1180px]:grid-cols-1">
              {needs.map(n => (
                <div key={n.id} className={`${CARD} flex flex-col gap-2 border-author-need-line p-4`}>
                  <h3 className="m-0 text-15 font-800">{n.label}</h3>
                  {n.id === 'story.product.dealValue' ? (
                    <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); const v = Number(deal.replace(/[^\d.]/g, '')); if (v > 0) edit(d => { d.story.product.dealValue = v; }, 'story.product.dealValue'); }}>
                      <p className="m-0 text-13 text-author-body">Sets the revenue target and every money figure.</p>
                      <div className="flex gap-2">
                        <label htmlFor="deal-value" className="sr-only">Average deal value</label>
                        <TextInput id="deal-value" inputMode="decimal" tone="border-author-need-line bg-author-surface" placeholder="For example 30,000" value={deal} onChange={e => setDeal(e.target.value)} />
                        <button type="submit" className={BUTTON.primary}>Save</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="m-0 text-13 text-author-body">{n.id === 'scoring.samples' ? `Check ${draft.scoring.samples.length} sample answers so scoring matches your judgment.` : `In ${n.where}.`}</p>
                      <button type="button" className={`${BUTTON.link} self-start`} onClick={() => go(n.tab)}>Open {n.where}</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
          <section className={`${CARD} flex flex-col gap-2 p-5`} aria-labelledby="ess">
            <CardHead id="ess" title="The essentials"><span className="text-13 text-author-body">Edit here or in each tab</span></CardHead>
            <dl className="m-0">
              {rows.map(([label, value, path]) => (
                <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-solid border-author-rule py-2.5 last:border-b-0">
                  <dt className="text-13 font-700 text-author-muted">{label}</dt>
                  <dd className={`m-0 rounded-8 px-1.5 py-1 text-14 ${draft.marks[path] === 'ai' ? 'bg-author-ai-field' : ''}`}>{value}</dd>
                  <dd className="m-0"><MarkOf path={path} /></dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={`${CARD} flex flex-col gap-2 p-5`} aria-labelledby="gen">
            <CardHead id="gen" title="Generated for you, open any to edit"><Badge kind="ai">{generated.length} sections</Badge></CardHead>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {generated.map(([tab, title, text]) => (
                <li key={tab} className="flex items-center gap-3 rounded-12 bg-author-track px-3 py-2.5">
                  <span className="flex-1 text-14"><b>{title}</b> &middot; {text}</span>
                  <button type="button" className={BUTTON.link} onClick={() => go(tab)}>Open<span className="sr-only"> {title}</span></button>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section className={`${CARD} flex flex-wrap items-center gap-3 p-4`} aria-label="Start over">
          <p className="m-0 flex-1 text-13 text-author-body">Start a new simulation with Kora. This draft is replaced.</p>
          {confirmReset
            ? <><button type="button" className={BUTTON.danger} onClick={() => { reset(); navigate({ page: 'journey' }); }}>Replace this draft</button><button type="button" className={BUTTON.secondary} onClick={() => setConfirmReset(false)}>Keep it</button></>
            : <button type="button" className={BUTTON.secondary} onClick={() => setConfirmReset(true)}>Start a new simulation</button>}
        </section>
      </div>
    </TabBody>
  );
}
