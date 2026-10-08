import { useState } from 'react';
import { MAX_DAYS, MAX_WEEKS, MIN_DAYS, MIN_WEEKS, type AuthorDraft } from '../../../model/draft';
import { PACING } from '../../../model/export';
import { fitRun, movedNote } from '../../../model/run';
import { freshKey } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { Badge, BUTTON, CARD, CardHead, Field, MarkOf, Segmented, Select, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate } from './regenerate';

const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const PACING_TEXT: Record<AuthorDraft['process']['pacing'], string> = {
  forgiving: `Forgiving: ${Math.round((PACING.forgiving.leads - 1) * 100)}% more new leads, events hit ${Math.round((1 - PACING.forgiving.harm) * 100)}% softer, morale drifts ${PACING.forgiving.drift} a week instead of 3, and an ignored event costs less sponsor confidence.`,
  balanced: 'Balanced: the calibrated simulation as drafted.',
  demanding: `Demanding: ${Math.round((1 - PACING.demanding.leads) * 100)}% fewer new leads, events hit ${Math.round((PACING.demanding.harm - 1) * 100)}% harder, morale drifts ${PACING.demanding.drift} a week instead of 3, and an ignored event costs more sponsor confidence.`
};

/** Ideal per week, live: the week's new leads (pacing included) through each stage's passing rate. */
function idealPerWeek(pr: AuthorDraft['process']): number[] {
  let flow = (pr.stages[0]?.perWeek ?? 0) * PACING[pr.pacing].leads;
  return pr.stages.map(s => { const v = Math.round(flow * 10) / 10; flow *= s.passesOn / 100; return v; });
}

/** What removing a stage touches: its people, the people whose best stage it is, and the events that hit it. */
function stageUses(d: AuthorDraft, key: string) {
  return { people: d.team.filter(c => c.stage === key), best: d.team.filter(c => c.bestStage === key), events: d.events.filter(e => e.who === `stage:${key}`) };
}

/**
 * Workspace: Work process (docs/design/genie/Process): the stages the team turns leads into revenue
 * through, people and passing rates per stage, the pressure point, the targets and the pacing.
 */
export default function Process() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const regen = useRegenerate('process');
  const pr = d.process;
  const tone = toneOf(d.marks['process.stages']);
  const last = pr.stages.length - 1;
  const unit = (i: number) => (i === 0 ? ' leads' : i === last ? ' deals' : '');
  const [moved, setMoved] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ key: string; to: string } | null>(null);
  const resize = (weeks: number, days: number) => { let note: string | null = null; edit(x => { note = movedNote(fitRun(x, weeks, days)); }, ['process.weeks', 'process.daysPerWeek']); setMoved(note); };
  const ideal = idealPerWeek(pr);
  const removeStage = (key: string, to: string) => {
    edit(x => {
      const i = x.process.stages.findIndex(s => s.key === key);
      if (i < 0) return;
      x.process.stages.splice(i, 1);
      for (const c of x.team) { if (c.stage === key) c.stage = to; if (c.bestStage === key) c.bestStage = ''; }
      for (const e of x.events) if (e.who === `stage:${key}`) e.who = `stage:${to}`;
      if (x.process.pressure === key) x.process.pressure = null;
    }, 'process.stages');
    setRemoving(null);
  };
  return (
    <TabBody label="Work process" head={<TabHead title="Work process" actions={regen.button}>How the team turns leads into revenue, and what good looks like each week.</TabHead>}>
      {regen.note}
      <div className="flex flex-col gap-4">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="stages">
          <CardHead id="stages" title="Stages">
            <MarkOf path="process.stages" />
            <button type="button" className={BUTTON.secondary} disabled={pr.stages.length >= 6} onClick={() => edit(x => {
              const key = freshKey('stage', x.process.stages.map(s => s.key));
              x.process.stages.splice(x.process.stages.length - 1, 0, { key, name: 'New stage', people: 1, perWeek: 0, passesOn: 50 });
            }, 'process.stages')}>Add a stage</button>
          </CardHead>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 p-0" aria-label="Stages in order">
            {pr.stages.map((s, i) => (
              <li key={s.key} className={`flex min-w-0 flex-col gap-2 rounded-14 border border-solid p-3 ${s.key === pr.pressure ? 'border-author-need-line bg-author-need-field' : 'border-author-line'}`}>
                <TextInput aria-label={`Stage ${i + 1} name`} className="font-800" value={s.name} onChange={e => edit(x => { x.process.stages[i].name = e.target.value; }, 'process.stages')} />
                <Field label="People">{id => <TextInput id={id} type="number" min={0} max={6} tone={tone} value={s.people} onChange={e => edit(x => { x.process.stages[i].people = num(e.target.value, 0, 6); }, 'process.stages')} />}</Field>
                <Field label="Ideal per week">{id => <TextInput id={id} readOnly tone={tone} value={`${ideal[i]}${unit(i)}`} aria-describedby="per-week-hint" />}</Field>
                <Field label="Passes on">{id => i === pr.stages.length - 1
                  ? <TextInput id={id} readOnly tone={tone} value="Revenue" />
                  : <TextInput id={id} type="number" min={5} max={100} tone={tone} value={s.passesOn} onChange={e => edit(x => { x.process.stages[i].passesOn = num(e.target.value, 5, 100); }, 'process.stages')} />}</Field>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} aria-pressed={s.key === pr.pressure} onClick={() => edit(x => { x.process.pressure = x.process.pressure === s.key ? null : s.key; }, 'process.stages')}>Pressure point<span className="sr-only">: {s.name}</span></button>
                  {pr.stages.length > 3 && <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} onClick={() => {
                    const u = stageUses(d, s.key);
                    const to = pr.stages[i === 0 ? 1 : i - 1].key;
                    if (u.people.length + u.best.length + u.events.length) setRemoving({ key: s.key, to }); else removeStage(s.key, to);
                  }}>Remove<span className="sr-only"> {s.name}</span></button>}
                </div>
                {removing?.key === s.key && (() => {
                  const u = stageUses(d, s.key);
                  return (
                    <div role="alert" className="flex flex-col gap-2 rounded-10 border border-solid border-author-need-line bg-author-need-field p-2 text-13">
                      <span>{[u.people.length ? `${u.people.length} ${u.people.length === 1 ? 'person works' : 'people work'} here` : '', u.events.length ? `${u.events.length} event${u.events.length === 1 ? ' hits' : 's hit'} this stage` : '', u.best.length ? `it is the best stage of ${u.best.map(c => c.first).join(', ')}` : ''].filter(Boolean).join('; ')}.</span>
                      <Field label="Move them to">{id => <Select id={id} value={removing.to} onChange={e => setRemoving({ key: s.key, to: e.target.value })}>{pr.stages.filter(o => o.key !== s.key).map(o => <option key={o.key} value={o.key}>{o.name}</option>)}</Select>}</Field>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} onClick={() => removeStage(s.key, removing.to)}>Remove and move them</button>
                        <button type="button" className={`${BUTTON.link} text-12`} onClick={() => setRemoving(null)}>Keep the stage</button>
                      </div>
                    </div>
                  );
                })()}
              </li>
            ))}
          </ol>
          <p id="per-week-hint" className="m-0 text-13 text-author-need">{pr.pressure ? `${pr.stages.find(s => s.key === pr.pressure)?.name} is your challenge's pressure point, so events and characters lean on it.` : 'Mark a pressure point and events and characters lean on it.'} Ideal per week follows from the leads coming in and each stage's passing rate.</p>
        </section>
        <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="targets">
            <CardHead id="targets" title="Targets"><MarkOf path="process.revenue" /></CardHead>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Revenue target" required need={!pr.revenue}>{id => <TextInput id={id} inputMode="decimal" tone={toneOf(d.marks['process.revenue'], !pr.revenue)} value={pr.revenue ?? ''} onChange={e => { const v = Number(e.target.value.replace(/[^\d.]/g, '')); edit(x => { x.process.revenue = v > 0 ? v : null; }, 'process.revenue'); }} />}</Field>
              <Field label="Weeks" hint={`${MIN_WEEKS} to ${MAX_WEEKS}`}>{id => <Select id={id} tone={toneOf(d.marks['process.weeks'])} value={pr.weeks} onChange={e => resize(num(e.target.value, MIN_WEEKS, MAX_WEEKS), pr.daysPerWeek)}>{Array.from({ length: MAX_WEEKS - MIN_WEEKS + 1 }, (_, i) => i + MIN_WEEKS).map(n => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
              <Field label="Days per week" hint={`${MIN_DAYS} to ${MAX_DAYS}; the week's leads stay the same`}>{id => <Select id={id} value={pr.daysPerWeek} onChange={e => resize(pr.weeks, num(e.target.value, MIN_DAYS, MAX_DAYS))}>{Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => i + MIN_DAYS).map(n => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
            </div>
            {moved && <p role="status" className="m-0 rounded-12 bg-author-need-field p-3 text-13 text-author-need">{moved}</p>}
            {!d.story.product.dealValue && <p className="m-0 text-13 text-author-body"><Badge kind="need" /> The target needs the average deal value from Story and world.</p>}
          </section>
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="pacing">
            <CardHead id="pacing" title="Pacing"><MarkOf path="process.pacing" /></CardHead>
            <Segmented label="Pacing" value={pr.pacing} onChange={v => edit(x => { x.process.pacing = v; }, 'process.pacing')} options={[{ value: 'forgiving', label: 'Forgiving' }, { value: 'balanced', label: 'Balanced' }, { value: 'demanding', label: 'Demanding' }]} />
            <p className="m-0 text-13 text-author-body">{PACING_TEXT[pr.pacing]}</p>
            <details className="rounded-12 border border-solid border-author-line p-3">
              <summary className="cursor-pointer text-15 font-800">Advanced: lead flow, conversion maths, thresholds</summary>
              <p className="m-0 mt-2 text-13 text-author-body">Lead flow and the funnel buffer are calibrated so good play lands near the target and passive play near half of it (docs/SIMULATION.md 9). Changing the stages or the passing rates here is checked by the synthetic players before you publish.</p>
            </details>
          </section>
        </div>
      </div>
    </TabBody>
  );
}
