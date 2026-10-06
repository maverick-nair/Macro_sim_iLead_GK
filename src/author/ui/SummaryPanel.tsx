import type { Brief } from '../../api/author';
import { DURATION_MODES, TONE_LABELS } from '../context';
import { Tag } from './parts';

export interface SummaryPanelProps {
  brief: Brief;
  lens: { primary: string | null; secondary: string | null };
  /** The team once drafted: name and role. */
  team: Array<{ name: string; title: string }> | null;
  company: string | null;
  dimensions: Array<{ name: string; reportOnly: boolean }>;
  /** Brief fields read from an upload or an earlier answer rather than asked. */
  inferred?: string[];
}

const DT = 'text-12 font-700 uppercase tracking-wide text-fg-secondary';
const EMPTY = 'Not answered yet';

/** "Your simulation so far": the premise, lens, team and scoring, filling in as the chat goes. */
export function SummaryPanel({ brief, lens, team, company, dimensions, inferred = [] }: SummaryPanelProps) {
  const row = (label: string, value: string | undefined | null, key?: string) => (
    <div className="grid gap-0.5">
      <dt className={DT}>{label}</dt>
      <dd className={`m-0 text-14 ${value ? '' : 'text-fg-secondary'}`}>{value || EMPTY}{key && inferred.includes(key) && <> <Tag tone="muted">Read from what you shared</Tag></>}</dd>
    </div>
  );
  return (
    <div className="grid gap-5">
      <section aria-label="Premise" className="grid gap-3">
        <h3 className="m-0 text-16 font-700">Premise</h3>
        <dl className="m-0 grid gap-2.5">
          {row('Company', company ?? (brief.client === null ? 'Fictional company' : brief.client), 'client')}
          {row('Participants', brief.roleLevel, 'roleLevel')}
          {row('Industry', brief.industry, 'industry')}
          {row('Business challenge', brief.challenge, 'challenge')}
          {row('Work process', brief.process?.join(', '), 'process')}
          {row('Run length', brief.duration && `${DURATION_MODES[brief.duration].label}, ${DURATION_MODES[brief.duration].detail}`)}
          {row('Language and region', brief.language, 'region')}
          {row('Tone', brief.tone && TONE_LABELS[brief.tone])}
          {brief.documents.length > 0 && row('Documents', brief.documents.map(d => d.name).join(', '))}
        </dl>
      </section>
      <section aria-label="Lens" className="grid gap-2">
        <h3 className="m-0 text-16 font-700">Lens</h3>
        <dl className="m-0 grid gap-2.5">
          {row('Primary', lens.primary)}
          {row('Secondary', lens.secondary ?? (lens.primary ? 'None' : null))}
        </dl>
      </section>
      <section aria-label="Team" className="grid gap-2">
        <h3 className="m-0 text-16 font-700">Team</h3>
        {team ? (
          <ul className="m-0 grid list-none gap-1 p-0 text-14">
            {team.map(m => <li key={m.name}><b>{m.name}</b> <span className="text-fg-secondary">{m.title}</span></li>)}
          </ul>
        ) : <p className="m-0 text-14 text-fg-secondary">{brief.teamSize ?? 10} people. Names and roles come with the draft.</p>}
      </section>
      <section aria-label="Scoring" className="grid gap-2">
        <h3 className="m-0 text-16 font-700">Scoring</h3>
        {dimensions.length ? (
          <ul className="m-0 grid list-none gap-1 p-0 text-14">
            {dimensions.map(d => <li key={d.name}>{d.name}{d.reportOnly && <> <Tag tone="muted">Report only</Tag></>}</li>)}
          </ul>
        ) : <p className="m-0 text-14 text-fg-secondary">Comes with the lens.</p>}
      </section>
    </div>
  );
}
