import { useMemo, type ReactNode } from 'react';
import type { LensId } from '../../../engine/lens';
import { DEFAULT_PROCESS } from '../../context';
import { LENS_BY_ID } from '../../lenses';
import type { Chat } from '../../model/draft';
import { pressureOf } from '../../model/seed';
import { buildModule } from '../../module';
import { draftContext, draftStoryline } from '../../storyline';
import { Avatar, Badge, CARD, type BadgeKind } from '../kit';

/**
 * "Your simulation so far" (docs/design/genie/ChatStart, D106): the draft filling in as the author
 * answers. Brief rows are the author's words; company, sponsor, stages, team and styles are what Kora
 * has generated from them; the deal value needs the author. Sections not reached yet say when they come.
 */

function Row({ label, value, kind }: { label: string; value: ReactNode; kind: BadgeKind }) {
  const tone = kind === 'need' ? 'border-author-need-line bg-author-need-field text-author-need' : kind === 'ai' ? 'border-author-ai-line bg-author-ai-field' : 'border-author-line-control bg-author-surface';
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-solid border-author-rule py-2 last:border-b-0">
      <dt className="text-13 font-700 text-author-muted">{label}</dt>
      <dd className={`m-0 truncate rounded-8 border border-solid px-2.5 py-1.5 text-13 ${tone}`}>{value}</dd>
      <dd className="m-0"><Badge kind={kind} /></dd>
    </div>
  );
}

function Section({ title, status, children, highlight = false }: { title: string; status: ReactNode; children?: ReactNode; highlight?: boolean }) {
  return (
    <section aria-label={title} className={`${CARD} flex flex-col gap-2 p-4 ${highlight ? 'border-author-kora' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={`m-0 text-15 font-800 ${children ? 'text-author-ink' : 'text-author-label'}`}>{title}</h3>
        <span className="text-13">{status}</span>
      </div>
      {children}
    </section>
  );
}

export function SoFar({ chat }: { chat: Chat }) {
  const b = chat.brief;
  const asked = new Set(chat.asked);
  const hasStory = !!(b.industry || b.client !== undefined);
  const primary: LensId = chat.primary ?? chat.recommendation?.id ?? 'readiness_based';
  const preview = useMemo(() => {
    if (!hasStory) return null;
    const s = draftStoryline(b, buildModule(b, { primary, secondary: null, clientDimensions: chat.clientDimensions }, false));
    return { company: s.organisation ?? draftContext(b).company, about: draftContext(b).industry.productLine, sponsor: `${s.sponsor.name}, ${s.sponsor.title}`, members: s.members, styles: s.lens!.styles };
  }, [b, hasStory, primary, chat.clientDimensions]);
  const stages = b.process ?? (asked.has('challenge') ? DEFAULT_PROCESS.stages : null);
  const pressure = stages ? pressureOf(b.challenge, stages.map(n => ({ key: n, name: n }))) : null;
  const teamDone = b.teamSize !== undefined && preview;
  const fromYou = chat.asked.length + b.documents.length;
  const generated = (preview ? 2 : 0) + (stages?.length ?? 0) + (teamDone ? preview!.members.length * 4 : 0) + (chat.recommendation && preview ? preview.styles.length : 0);
  const need = hasStory ? 1 : 0;
  const briefDone = !!(b.roleLevel && b.industry && b.challenge);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Who wrote what so far">
        <Badge kind="you">{fromYou} from you</Badge>
        <Badge kind="ai">{generated} generated</Badge>
        {need > 0 && <Badge kind="need">{need} needs you</Badge>}
      </div>
      {!chat.recommendation && (
        <Section title="Brief" status={briefDone ? <Badge kind="done" /> : <span className="text-author-muted">In progress</span>}>
          <dl className="m-0">
            <Row label="Participants" value={b.roleLevel ?? 'Waiting for your answer'} kind={b.roleLevel ? 'you' : 'muted'} />
            <Row label="Industry" value={b.industry ?? 'Waiting for your answer'} kind={b.industry ? 'you' : 'muted'} />
            <Row label="Challenge" value={b.challenge ?? 'Waiting for your answer'} kind={b.challenge ? 'you' : 'muted'} />
          </dl>
        </Section>
      )}
      {!chat.recommendation && (preview ? (
        <Section title="Story and world" status={<Badge kind="generated" />}>
          <dl className="m-0">
            <Row label="Company" value={`${preview.company}, ${preview.about}`} kind="ai" />
            <Row label="Sponsor" value={preview.sponsor} kind="ai" />
            <Row label="Deal value" value="Add your average deal value" kind="need" />
          </dl>
        </Section>
      ) : <Section title="Story and world" status={<span className="text-author-muted">After the industry</span>} />)}
      {!chat.recommendation && (stages ? (
        <Section title="Work process" status={<Badge kind="generated" />}>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Stages">
            {stages.map(s => <li key={s} className={`rounded-8 border border-solid px-2.5 py-1 text-13 ${s === pressure ? 'border-author-need-line bg-author-need-field text-author-need' : 'border-author-ai-line bg-author-ai-field text-author-ink'}`}>{s}{s === pressure && <span className="sr-only"> (pressure point)</span>}</li>)}
          </ul>
        </Section>
      ) : <Section title="Work process" status={<span className="text-author-muted">After the challenge</span>} />)}
      {teamDone ? (
        <Section title="Team" status={<Badge kind="generated">{preview!.members.length} people generated</Badge>}>
          <div className="flex items-center gap-2">
            {preview!.members.slice(0, 5).map(m => <Avatar key={m.id} src={m.portrait} name={m.name} size={34} />)}
            {preview!.members.length > 5 && <span className="text-13 text-author-muted">and {preview!.members.length - 5} more</span>}
          </div>
        </Section>
      ) : (
        <Section title="Team" status={chat.current?.id === 'team_size' ? <span className="font-700 text-author-ai">Building after this answer</span> : <span className="text-author-muted">After the team size</span>}>
          {chat.current?.id === 'team_size' && <div aria-hidden="true" className="h-7 overflow-hidden rounded-8 bg-author-track"><div className="h-full w-1/3 bg-author-line" /></div>}
        </Section>
      )}
      {chat.recommendation && preview ? (
        <Section title="Leadership lens" highlight status={<span className="font-700 text-author-ai">Preview of the recommendation</span>}>
          <p className="m-0 text-13 text-author-body">{LENS_BY_ID[primary].title}. Style names written for your team; rename any of them later.</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {preview.styles.map(s => (
              <li key={s.key} className="flex items-center gap-3 rounded-12 border border-solid border-author-ai-line bg-author-ai-field px-3 py-2">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-round bg-author-kora text-12 font-800 text-author-on-primary">{s.letter}</span>
                <span className="text-14"><b>{s.name}</b> <span className="text-author-body">&middot; {s.short}</span></span>
              </li>
            ))}
          </ul>
        </Section>
      ) : <Section title="Leadership lens" status={<span className="text-author-muted">Next</span>} />}
      <Section title="Scoring and report" status={<span className="text-author-muted">{chat.recommendation ? 'After the lens' : 'Later'}</span>} />
    </div>
  );
}
