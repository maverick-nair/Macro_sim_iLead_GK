import { useEffect, useState } from 'react';
import { parseStoryline } from '../../../../engine/config';
import { reachOf, type Reach } from '../../../calibrate/logic/reach';
import { regionOf } from '../../../context';
import type { AuthorDraft } from '../../../model/draft';
import { pluralOf, toStoryline } from '../../../model/export';
import { useAuthor, useAuthorStore } from '../../../model/store';
import { BUTTON } from '../../kit';

/** The draft's parts the estimate reads: the process, the deal value, the run, the language and the events' lead flow. */
const inputsOf = (d: AuthorDraft) => JSON.stringify([d.process, d.story.product.dealValue, d.brief.run, d.brief.language, d.team.length, d.events.map(e => [e.timing, e.week, e.leadFlow])]);

/**
 * What a run can make, as the author types (D227): the draft exported and its funnel's capacity read (`reachOf`), a
 * quarter of a second after the last change. No synthetic player plays, so it costs a few milliseconds.
 */
export function useReach(): Reach | null {
  const store = useAuthorStore();
  const inputs = useAuthor(s => inputsOf(s.draft));
  const [reach, setReach] = useState<Reach | null>(null);
  useEffect(() => {
    const h = setTimeout(() => {
      const p = parseStoryline(toStoryline(store.getState().draft).storyline);
      setReach(p.ok ? reachOf(p.config) : null);
    }, 250);
    return () => clearTimeout(h);
  }, [inputs, store]);
  return reach;
}

/** The author's words for the sales unit: theirs, or deal. */
export function unitOf(d: AuthorDraft): { one: string; many: string } {
  const one = d.story.product.unit.trim();
  return one ? { one, many: d.story.product.units.trim() || pluralOf(one) } : { one: 'deal', many: 'deals' };
}

const pctOf = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Next to the revenue target and the average deal value (D227): the revenue a run can make, what a Proficient player
 * typically makes of the target, and a warning when the target is out of reach for them or trivially easy, with a
 * one click fix. `compact` is the line under the deal value in Story and world.
 */
export function RevenueReach({ compact = false }: { compact?: boolean }) {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const reach = useReach();
  if (!reach) return null;
  const region = regionOf(d.brief.language);
  const fmt = new Intl.NumberFormat(region?.locale ?? 'en-US', { style: 'currency', currency: region?.currency ?? 'USD', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat(region?.locale ?? 'en-US', { maximumFractionDigits: 1 });
  const money = (n: number) => fmt.format(Math.round(n));
  const u = unitOf(d);
  const pro = reach.levels.proficient, beg = reach.levels.beginner, exp = reach.levels.expert;
  const drafted = !d.story.product.dealValue;
  const warn = reach.verdict !== 'fits';
  const verdict = reach.verdict === 'unreachable'
    ? `Out of reach, even for an Expert: they typically make about ${pctOf(exp.share)} of the target, a Proficient player about ${pctOf(pro.share)}.`
    : reach.verdict === 'stretch'
      ? `Out of reach for a Proficient player: they typically make about ${pctOf(pro.share)} of the target (${money(pro.revenue)}).`
      : reach.verdict === 'easy'
        ? `Too easy: even a Beginner typically makes about ${pctOf(beg.share)} of the target.`
        : `A Proficient player typically makes about ${money(pro.revenue)}, ${pctOf(pro.share)} of the target.`;
  const fix = (
    <span className="flex flex-wrap gap-2">
      <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} onClick={() => edit(x => { x.process.revenue = reach.suggest.target; }, 'process.revenue')}>Set the target to {money(reach.suggest.target)}</button>
      {reach.verdict !== 'easy' && <button type="button" className={`${BUTTON.secondary} min-h-8 px-2 text-12`} onClick={() => edit(x => { x.story.product.dealValue = reach.suggest.value; }, 'story.product.dealValue')}>Set the average {u.one} value to {money(reach.suggest.value)}</button>}
    </span>
  );
  if (compact) {
    return (
      <div data-reach={reach.verdict} className={`flex flex-col gap-1.5 text-13 ${warn ? 'rounded-12 border border-solid border-author-need-line bg-author-need-field p-2.5 text-author-need' : 'text-author-body'}`}>
        <p role="status" className="m-0">
          About {num.format(reach.perWeek)} {u.many} a week at full pace, so a run can make about {money(reach.capacity)}. {verdict}
        </p>
        {warn && fix}
      </div>
    );
  }
  return (
    <div data-reach={reach.verdict} className="flex flex-col gap-2 rounded-12 border border-solid border-author-line p-3 text-13">
      <b className="text-14 text-author-ink">What a run can make</b>
      <p className="m-0 text-author-body">
        Your process passes on about {num.format(reach.perWeek)} {u.many} a week at full pace (everyone in every stage performing well), times {money(reach.value)} a {u.one}{drafted ? ' (the drafted value until you set yours)' : ''}: about {money(reach.capacity)} over {reach.weeks} weeks.
        {' '}Typically a Beginner makes about {pctOf(beg.share)} of the target, a Proficient player {pctOf(pro.share)}, an Expert {pctOf(exp.share)}.
      </p>
      <p role="status" className={`m-0 font-700 ${warn ? 'rounded-10 bg-author-need-field p-2 text-author-need' : 'text-author-ink'}`}>{verdict}</p>
      {warn && fix}
      <p className="m-0 text-12 text-author-muted">An estimate from the process, worked out as you type. Test with synthetic players measures it.</p>
    </div>
  );
}
