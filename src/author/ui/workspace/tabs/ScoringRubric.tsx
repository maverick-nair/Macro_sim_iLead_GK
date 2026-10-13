import { DEFAULT_RUBRIC, RUBRIC_LABELS } from '../../../../engine/sim/evaluator';
import type { AuthorDraft, Band } from '../../../model/draft';
import { useAuthor } from '../../../model/store';
import { REASON_MIN, validationOf } from '../../../model/validate';
import { Field, Segmented, TextArea, TextInput } from '../../kit';

const BAND: Record<Band, string> = { strong: 'Strong', adequate: 'Adequate', weak: 'Weak', harmful: 'Harmful' };
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
type Sample = AuthorDraft['scoring']['samples'][number];

/** The 1:1 the samples come from: its format's rubric dimensions and the skills it is scored on. */
function conversationOf(d: AuthorDraft) {
  const f2f = d.actions.find(a => a.template === 'f2f') ?? d.actions.find(a => a.format.startsWith('1:1'));
  const exported = validationOf(d).exported.storyline;
  const live = exported.actions.find(a => a.key === f2f?.key)?.live;
  const keys = live?.rubric?.map(r => r.key) ?? DEFAULT_RUBRIC.roleplay;
  const names = new Set((f2f?.scoredOn ?? []).map(n => n.trim().toLowerCase()));
  const skills = (exported.report?.skills ?? []).filter(s => names.has(s.name.trim().toLowerCase()));
  return { name: f2f?.name ?? 'Meet face to face', keys, skills };
}

/**
 * The rubric behind a scoring sample (D229): what GenieKreator's evaluator looks for in a 1:1 answer, dimension by
 * dimension, and what each level looks like for the skills a 1:1 rates, all from this draft and editable here (the
 * export carries them to every conversation and to the report). When the author's call differs from GenieKreator's,
 * they say why, or that they changed the rubric: a reasoned disagreement is kept and counts for publishing.
 */
export function SampleRubric({ sample, index }: { sample: Sample; index: number }) {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const conv = conversationOf(d);
  const mine = (k: string) => d.scoring.rubric.find(r => r.key === k);
  const setDim = (k: string, patch: { label?: string; cues?: string[] }) => edit(x => {
    const r = x.scoring.rubric.find(y => y.key === k);
    if (r) Object.assign(r, patch);
    else x.scoring.rubric.push({ key: k, label: patch.label ?? '', cues: patch.cues ?? [] });
    // Changing the rubric from a sample the author disagrees with is how they resolved it, unless they said otherwise.
    const t = x.scoring.samples.find(y => y.id === sample.id);
    if (t && t.call !== null && t.call !== t.scored && !t.resolution) t.resolution = 'rubric';
  }, 'scoring.rubric');
  const setAnchor = (key: string, defaults: string[], i: number, v: string) => edit(x => {
    const list = [...(x.scoring.anchors[key] ?? defaults)];
    list[i] = v;
    x.scoring.anchors[key] = list;
  }, 'scoring.anchors');
  const disagree = sample.call !== null && sample.call !== sample.scored;
  return (
    <div role="region" aria-label={`Rubric for sample ${index + 1}`} className="flex flex-col gap-3 rounded-12 border border-solid border-author-line bg-author-surface p-4 text-13">
      <p className="m-0 text-author-body">
        How GenieKreator rates an answer in {conv.name}: each dimension below reads Strong with two or more signs of it in the answer, Adequate with one, Weak with none. The answer&rsquo;s band is the middle of them; blame, abuse, discrimination or a policy breach make it Harmful, whatever else is said. It scored this one <b>{BAND[sample.scored]}</b>.
      </p>
      {conv.keys.map(k => (
        <div key={k} className="grid grid-cols-2 gap-3 max-[1180px]:grid-cols-1">
          <Field label={`What ${title(k)} looks for`}>{id => <TextInput id={id} value={mine(k)?.label || RUBRIC_LABELS[k] || title(k)} onChange={e => setDim(k, { label: e.target.value })} />}</Field>
          <Field label={`Phrases that count as ${title(k)}`} hint="Separated by commas. Added to what GenieKreator already looks for.">{id => <TextInput id={id} value={(mine(k)?.cues ?? []).join(', ')} placeholder="For example: what is getting in the way" onChange={e => setDim(k, { cues: e.target.value.split(',').map(c => c.trimStart()).slice(0, 12) })} />}</Field>
        </div>
      ))}
      {conv.skills.map(s => (
        <fieldset key={s.key} className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1 p-0 text-13 font-800">What each level looks like for {s.name}</legend>
          {d.scoring.levels.map((level, i) => (
            <Field key={i} label={`${s.name} at ${level}`}>{id => <TextArea id={id} rows={1} value={(d.scoring.anchors[s.key] ?? s.anchors)[i] ?? ''} onChange={e => setAnchor(s.key, s.anchors, i, e.target.value)} />}</Field>
          ))}
        </fieldset>
      ))}
      {disagree && (
        <div className="flex flex-col gap-2 rounded-10 border border-solid border-author-need-line bg-author-need-field p-3">
          <b>You rate it {BAND[sample.call!]}; GenieKreator {BAND[sample.scored]}.</b>
          <Segmented label="How you resolve it" value={sample.resolution ?? 'reason'} onChange={v => edit(x => { const t = x.scoring.samples.find(y => y.id === sample.id); if (t) t.resolution = v; }, 'scoring.samples')}
            options={[{ value: 'rubric', label: 'I changed the rubric' }, { value: 'reason', label: 'I disagree, and say why' }]} />
          <Field label={sample.resolution === 'rubric' ? 'What you changed, and why' : 'Why you disagree'} hint={`Kept with the draft. With a reason (${REASON_MIN} characters or more), the disagreement counts for publishing and stays in Review and publish as a note.`}>
            {id => <TextArea id={id} rows={2} value={sample.reason} onChange={e => edit(x => { const t = x.scoring.samples.find(y => y.id === sample.id); if (t) { t.reason = e.target.value; t.resolution ??= 'reason'; } }, 'scoring.samples')} />}
          </Field>
        </div>
      )}
    </div>
  );
}
