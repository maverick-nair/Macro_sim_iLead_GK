import { useMemo, useState, type ReactNode } from 'react';
import type { AuthorDraft, Tab } from '../../../model/draft';
import { toStoryline } from '../../../model/export';
import { markCounts, needsOf } from '../../../model/needs';
import { useAuthor } from '../../../model/store';
import { BUTTON, CARD, Field, Icon, TextArea, TextInput } from '../../kit';
import { download, playDraft } from '../../play';
import { navigate } from '../../route';
import { configHash } from '../../../calibrate/logic/hash';
import { TabBody, TabHead } from '../Workspace';

export interface Check { id: string; title: string; detail: ReactNode; state: 'passed' | 'failed' | 'advisory'; blocking: boolean; go?: Tab }

/** The checks before publishing (docs/design/genie/Publish): what blocks publishing, and what is advice. */
export function checksOf(d: AuthorDraft): Check[] {
  const out = toStoryline(d);
  const needs = needsOf(d);
  const counts = markCounts(d);
  const answered = d.scoring.samples.filter(s => s.call !== null);
  const agreed = d.scoring.samples.filter(s => s.call === s.scored).length;
  const share = d.scoring.samples.length ? agreed / d.scoring.samples.length : 1;
  return [
    { id: 'required', title: 'Everything required is filled in', detail: `${counts.ai + counts.you} fields, ${needs.length} waiting for you${needs.length ? `: ${needs.map(n => n.label).join(', ')}` : ''}`, state: needs.length ? 'failed' : 'passed', blocking: true, go: needs[0]?.tab },
    { id: 'engine', title: 'The simulation plays', detail: out.issues.length ? `${out.issues.length} issue${out.issues.length === 1 ? '' : 's'}: ${out.issues.slice(0, 2).join('; ')}` : 'The engine accepts every setting: team, stages, actions, events and the lens.', state: out.issues.length ? 'failed' : 'passed', blocking: true },
    { id: 'scoring', title: 'Scoring matches your judgment', detail: answered.length < d.scoring.samples.length ? `${answered.length} of ${d.scoring.samples.length} samples checked` : `${agreed} of ${d.scoring.samples.length} samples agree after your review (target 85%)`, state: answered.length < d.scoring.samples.length || share < 0.85 ? 'failed' : 'passed', blocking: true, go: 'scoring' },
    { id: 'copy', title: 'Copy rules', detail: out.copy.length ? `${out.copy.length} to fix, for example "${out.copy[0].text.slice(0, 60)}" (${out.copy[0].rule.replace('_', ' ')})` : 'Plain language, "skills" throughout, no dashes as punctuation, KNOLSKAPE lens names only.', state: out.copy.length ? 'failed' : 'passed', blocking: true },
    synthetic(d.calibration, configHash(out.storyline)),
    { id: 'role', title: 'Characters stay in role', detail: `Advisory: off topic, hostile and "tell me your secret" tests run on all ${d.team.length} characters on the server when you publish.`, state: 'advisory', blocking: false },
    { id: 'play', title: 'Play it yourself', detail: d.publish.played ? 'You played a week of this draft.' : 'Advisory: you have not played a week of this draft yet. It takes about 8 minutes.', state: d.publish.played ? 'passed' : 'advisory', blocking: false }
  ];
}

/** The synthetic players line: the Test tab's result, or advisory when it has not run or the draft changed since (D119). */
function synthetic(c: AuthorDraft['calibration'], hash: string) {
  const base = { id: 'synthetic', title: 'Synthetic players', blocking: false, go: 'calibrate' as Tab };
  if (!c) return { ...base, detail: 'Advisory: not run on this draft yet.', state: 'advisory' as const };
  if (c.configHash && c.configHash !== hash) return { ...base, detail: `Advisory: ${c.summary} The draft changed since, so run the test again.`, state: 'advisory' as const };
  return { ...base, blocking: !c.passed, detail: c.summary, state: !c.passed ? 'failed' as const : c.advisory ? 'advisory' as const : 'passed' as const };
}

/**
 * Review and publish (docs/design/genie/Publish, D105): every check, run on the draft as it is now, then
 * the version's notes and Publish. Publishing needs every blocking check passed; advisories never block.
 * There is no review step: an edit marks the field Edited and the checks rerun.
 */
export default function Publish() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [ran, setRan] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const checks = useMemo(() => { void ran; return checksOf(d); }, [d, ran]);
  const blocking = checks.filter(c => c.blocking && c.state !== 'passed');
  const passed = checks.filter(c => c.state === 'passed').length;
  const advisory = checks.filter(c => c.state === 'advisory').length;
  const version = d.publish.version + 1;
  return (
    <TabBody label="Review and publish" head={<TabHead title="Ready to publish" actions={<button type="button" className={BUTTON.secondary} onClick={() => setRan(r => r + 1)}>Run checks again</button>}>
      GenieKreator ran every check on this draft. {passed} passed{blocking.length ? `, ${blocking.length} to fix` : ''}{advisory ? `, ${advisory} advisory` : ''}.
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
                    ? <button type="button" className={BUTTON.link} onClick={() => navigate({ page: 'workspace', tab: c.go! })}>{c.state === 'advisory' ? 'Open' : 'Fix'}<span className="sr-only"> {c.title}</span></button>
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
          {done !== null && <p role="status" className="m-0 rounded-12 bg-author-gain-soft p-3 text-14 font-700 text-author-gain">Version {done} published. Download the configuration for your LMS or the server.</p>}
          <span className="flex-1" />
          {blocking.length > 0 && <p className="m-0 text-13 text-author-need">Fix {blocking.length === 1 ? 'the check' : `the ${blocking.length} checks`} marked To fix to publish.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${BUTTON.big} flex-1`} disabled={blocking.length > 0} onClick={() => { edit(x => { x.publish.version = version; }); setDone(version); }}>Publish</button>
            <button type="button" className={`${BUTTON.secondary} min-h-12`} onClick={() => download(`${d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`, toStoryline(d).storyline)}>Download config</button>
          </div>
        </section>
      </div>
    </TabBody>
  );
}
