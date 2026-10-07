import { freshKey } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { Badge, BUTTON, CARD, CardHead, Field, MarkOf, Segmented, TextInput, toneOf } from '../../kit';
import { TabBody, TabHead } from '../Workspace';
import { useRegenerate } from './regenerate';

const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));

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
  const unit = (i: number) => (i === 0 ? ' leads' : i === pr.stages.length - 1 ? ' deals' : '');
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
                <Field label="Ideal per week">{id => <TextInput id={id} readOnly tone={tone} value={`${s.perWeek}${unit(i)}`} aria-describedby="per-week-hint" />}</Field>
                <Field label="Passes on">{id => i === pr.stages.length - 1
                  ? <TextInput id={id} readOnly tone={tone} value="Revenue" />
                  : <TextInput id={id} type="number" min={5} max={100} tone={tone} value={s.passesOn} onChange={e => edit(x => { x.process.stages[i].passesOn = num(e.target.value, 5, 100); }, 'process.stages')} />}</Field>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} aria-pressed={s.key === pr.pressure} onClick={() => edit(x => { x.process.pressure = x.process.pressure === s.key ? null : s.key; }, 'process.stages')}>Pressure point<span className="sr-only">: {s.name}</span></button>
                  {pr.stages.length > 3 && <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} onClick={() => edit(x => {
                    const fallback = x.process.stages[i === 0 ? 1 : i - 1].key;
                    x.process.stages.splice(i, 1);
                    for (const c of x.team) if (c.stage === s.key) c.stage = fallback;
                    if (x.process.pressure === s.key) x.process.pressure = null;
                  }, 'process.stages')}>Remove<span className="sr-only"> {s.name}</span></button>}
                </div>
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
              <Field label="Weeks">{id => <TextInput id={id} type="number" min={2} max={12} tone={toneOf(d.marks['process.weeks'])} value={pr.weeks} onChange={e => edit(x => { x.process.weeks = num(e.target.value, 2, 12); }, 'process.weeks')} />}</Field>
              <Field label="Days per week">{id => <TextInput id={id} type="number" min={3} max={7} value={pr.daysPerWeek} onChange={e => edit(x => { x.process.daysPerWeek = num(e.target.value, 3, 7); }, 'process.daysPerWeek')} />}</Field>
            </div>
            {!d.story.product.dealValue && <p className="m-0 text-13 text-author-body"><Badge kind="need" /> The target needs the average deal value from Story and world.</p>}
          </section>
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="pacing">
            <CardHead id="pacing" title="Pacing"><MarkOf path="process.pacing" /></CardHead>
            <Segmented label="Pacing" value={pr.pacing} onChange={v => edit(x => { x.process.pacing = v; }, 'process.pacing')} options={[{ value: 'forgiving', label: 'Forgiving' }, { value: 'balanced', label: 'Balanced' }, { value: 'demanding', label: 'Demanding' }]} />
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
