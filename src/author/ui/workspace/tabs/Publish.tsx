import { useId, useMemo, useState, type ReactNode } from 'react';
import type { AuthorDraft, Tab } from '../../../model/draft';
import { markCounts } from '../../../model/needs';
import { useAuthor } from '../../../model/store';
import { SCORING_AGREEMENT, validateDraft, validationOf, type Issue, type IssueArea, type Validation } from '../../../model/validate';
import { BUTTON, CARD, FOCUS, Field, Icon, TextArea, TextInput } from '../../kit';
import { download, playDraft } from '../../play';
import { navigate } from '../../route';
import { TabBody, TabHead } from '../Workspace';

export interface Check { id: string; title: string; detail: ReactNode; state: 'passed' | 'failed' | 'advisory'; blocking: boolean; go?: Tab }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One line of the checks: the first issue of its area, and how many more there are. */
function said(issues: Issue[]): string {
  const [first, ...rest] = issues;
  const more = rest.length ? ` And ${plural(rest.length, 'more thing')}: ${rest.slice(0, 2).map(i => i.title).join('; ')}${rest.length > 2 ? '; and others' : ''}.` : '';
  return `${first.title}.${first.detail ? ` ${first.detail}` : ''}${more}`;
}

/**
 * The checks before publishing (docs/design/genie/Publish, D131): the validator's issues by area, what blocks
 * publishing and what is advice. Every area is listed, passed or not, so the author sees what was checked.
 */
export function checksOf(d: AuthorDraft, v: Validation = validationOf(d)): Check[] {
  const all = [...v.blocking, ...v.advisories];
  const counts = markCounts(d);
  const inUse = d.actions.filter(a => a.core || a.enabled).length;
  const agreed = d.scoring.samples.filter(s => s.call === s.scored).length;
  const row = (area: IssueArea, title: string, passed: string, go?: Tab): Check => {
    const mine = all.filter(i => i.area === area);
    const blocking = mine.filter(i => i.blocking);
    const shown = blocking.length ? blocking : mine;
    return shown.length
      ? { id: area, title, detail: said(shown), state: blocking.length ? 'failed' : 'advisory', blocking: blocking.length > 0, go: shown[0].tab }
      : { id: area, title, detail: passed, state: 'passed', blocking: false, go };
  };
  return [
    row('required', 'Everything required is filled in', `${counts.ai + counts.you} fields, none waiting for you.`),
    row('engine', 'The simulation plays', 'The engine accepts every setting: team, stages, actions, events and the lens.'),
    row('mechanics', 'Choices make a difference', `${inUse} actions in use, the core ones included. Styles change what happens, and every decision has options.`),
    row('names', 'Names are unique', 'Every character, style, tag and skill has its own name.'),
    row('links', 'Events and people line up', 'Every event, person and relationship points at someone or a stage in this draft.'),
    row('scoring', 'Scoring matches your judgment', `${agreed} of ${d.scoring.samples.length} samples agree after your review (target ${Math.round(SCORING_AGREEMENT * 100)}%).`),
    row('copy', 'Copy rules', 'Plain language, "skills" throughout, no dashes as punctuation, KNOLSKAPE lens names only.'),
    row('synthetic', 'Synthetic players', d.calibration?.summary ?? 'Passed on this version.', 'calibrate'),
    { id: 'role', title: 'Characters stay in role', detail: `Advisory: off topic, hostile and "tell me your secret" tests run on all ${d.team.length} characters on the server when you publish.`, state: 'advisory', blocking: false },
    { id: 'play', title: 'Play it yourself', detail: d.publish.played ? 'You played a week of this draft.' : 'Advisory: you have not played a week of this draft yet. It takes about 8 minutes.', state: d.publish.played ? 'passed' : 'advisory', blocking: false }
  ];
}

const open = (tab: Tab) => navigate({ page: 'workspace', tab });

/**
 * Review and publish (docs/design/genie/Publish, D105, D131): every check, run on the draft as it is now, then
 * the version's notes and Publish. Publishing needs every blocking issue fixed; advisories never block. The
 * button names how many issues block it, and the first one links to where it is fixed. Without a full synthetic
 * test on this version, the author either runs it or ticks "Publish without testing" (D132); a failed test is
 * never covered by the tick.
 */
export default function Publish() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [ran, setRan] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const blockedId = useId();
  const v = useMemo(() => (ran ? validateDraft(d) : validationOf(d)), [d, ran]);
  const checks = useMemo(() => checksOf(d, v), [d, v]);
  const blocking = v.blocking;
  const passed = checks.filter(c => c.state === 'passed').length;
  const advisory = checks.filter(c => c.state === 'advisory').length;
  const failing = checks.filter(c => c.state === 'failed').length;
  const version = d.publish.version + 1;
  const syn = v.synthetic;
  return (
    <TabBody label="Review and publish" head={<TabHead title="Review and publish" actions={<button type="button" className={BUTTON.secondary} onClick={() => setRan(r => r + 1)}>Run checks again</button>}>
      GenieKreator ran every check on this draft. {passed} passed{failing ? `, ${failing} to fix` : ''}{advisory ? `, ${advisory} advisory` : ''}.
    </TabHead>}>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 max-[1180px]:grid-cols-1">
        <section aria-label="Checks" className={`${CARD} p-5`}>
          <ul className="m-0 flex list-none flex-col p-0">
            {checks.map(c => (
              <li key={c.id} className="flex items-center gap-4 border-b border-solid border-author-rule py-3.5 last:border-b-0">
                <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-round text-15 font-800 ${c.state === 'passed' ? 'bg-author-gain-soft text-author-gain' : c.state === 'failed' ? 'bg-author-need-badge text-author-need' : 'bg-author-need-field text-author-need'}`}>{c.state === 'passed' ? Icon.check(14) : '!'}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-16">{c.title}</b>
                  <span className="text-13 text-author-body">{c.detail}</span>
                </span>
                {c.id === 'play' && c.state !== 'passed'
                  ? <button type="button" className={BUTTON.secondary} onClick={() => { const r = playDraft(d); if (r.ok) edit(x => { x.publish.played = true; }); }}>Play week 1</button>
                  : c.state !== 'passed' && c.go
                    ? <button type="button" className={BUTTON.link} onClick={() => open(c.go!)}>{c.state === 'advisory' ? 'Open' : 'Fix'}<span className="sr-only"> {c.title}</span></button>
                    : <span className={`text-14 font-800 ${c.state === 'passed' ? 'text-author-gain' : c.state === 'failed' ? 'text-author-decline' : 'text-author-need'}`}>{c.state === 'passed' ? 'Passed' : c.state === 'failed' ? 'To fix' : 'Advisory'}</span>}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="publish-title" className={`${CARD} flex flex-col gap-4 p-6`}>
          <h2 id="publish-title" className="m-0 text-22 font-800">Publish version {version}</h2>
          <Field label="First cohort" optional>{id => <TextInput id={id} value={d.publish.cohort} placeholder={`${d.story.company.name}, new managers`} onChange={e => edit(x => { x.publish.cohort = e.target.value; })} />}</Field>
          <Field label="What changed in this version" optional>{id => <TextArea id={id} rows={3} value={d.publish.notes} placeholder="First release." onChange={e => edit(x => { x.publish.notes = e.target.value; })} />}</Field>
          <div className="flex flex-col gap-1 rounded-12 bg-author-track p-4">
            <b className="text-15">After publishing</b>
            <p className="m-0 text-13 text-author-body">Participants get a launch link through your LMS. You can keep editing; changes go into version {version + 1} and never affect runs in progress.</p>
          </div>
          {syn.acknowledgeable && (
            <div className="flex flex-col gap-1.5 rounded-12 border border-solid border-author-need-line bg-author-need-field p-4">
              <label className="flex cursor-pointer items-start gap-2.5 text-15 font-800">
                <input type="checkbox" className={`mt-0.5 size-5 shrink-0 cursor-pointer accent-author-primary ${FOCUS}`} checked={d.publish.skipTest} onChange={e => edit(x => { x.publish.skipTest = e.target.checked; })} />
                Publish without testing
              </label>
              <p className="m-0 text-13 text-author-body">
                {syn.state === 'partial' ? 'The last synthetic test was not a full test. ' : syn.state === 'outOfDate' ? 'The draft changed since the last synthetic test. ' : 'Synthetic players have not tested this draft. '}
                Without a full test, nobody has checked that good leadership scores higher than poor leadership here, so participants could get a report that rewards the wrong things. <button type="button" className={BUTTON.link} onClick={() => open('calibrate')}>Run the test</button>
              </p>
            </div>
          )}
          {done !== null && <p role="status" className="m-0 rounded-12 bg-author-gain-soft p-3 text-14 font-700 text-author-gain">Version {done} published. Download the configuration for your LMS or the server.</p>}
          <span className="flex-1" />
          {blocking.length > 0 && (
            <div id={blockedId} className="flex flex-col gap-1.5">
              <p className="m-0 text-14 font-700 text-author-need">{plural(blocking.length, 'issue')} {blocking.length === 1 ? 'blocks' : 'block'} publishing. Fix the first one:</p>
              <button type="button" className={`${BUTTON.link} self-start text-start`} onClick={() => open(blocking[0].tab)}>Fix: {blocking[0].title}</button>
              {blocking.length > 1 && (
                <details className="text-13 text-author-body">
                  <summary className={`cursor-pointer font-700 ${FOCUS}`}>See all {blocking.length}</summary>
                  <ol className="m-0 mt-1 flex flex-col gap-1 ps-5">
                    {blocking.map(i => <li key={i.id}><button type="button" className={`${BUTTON.link} text-start text-13`} onClick={() => open(i.tab)}>{i.title}</button></li>)}
                  </ol>
                </details>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${BUTTON.big} flex-1`} disabled={blocking.length > 0} aria-describedby={blocking.length ? blockedId : undefined}
              onClick={() => { edit(x => { x.publish.version = version; x.publish.skipTest = false; }); setDone(version); }}>
              {blocking.length ? `Publish: ${plural(blocking.length, 'issue')} to fix` : 'Publish'}
            </button>
            <button type="button" className={`${BUTTON.secondary} min-h-12`} onClick={() => download(`${d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`, v.exported.storyline)}>Download config</button>
          </div>
        </section>
      </div>
    </TabBody>
  );
}
