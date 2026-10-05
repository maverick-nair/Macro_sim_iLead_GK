import type { EngineView } from '../engine/contract';
import { useI18n, type I18n } from '../i18n';
import { dayArgs } from '../components/action/days';
import { ResumeRecap, type ResumeRecapChange, type ResumeRecapProps } from '../components/settings/ResumeRecap';

/** The last outcome's headline: the one on the board, else the newest entry in the log that is not a period end. */
export function lastHeadline(v: EngineView): string | null {
  if (v.outcome) return v.outcome.headline;
  for (let i = v.history.length - 1; i >= 0; i--) {
    const l = v.history[i];
    if (l.kind !== 'periodEnd') return l.title;
  }
  return null;
}

const sign = (a: number, b: number): ResumeRecapChange['trend'] => (b > a ? 'up' : b < a ? 'down' : 'flat');
/**
 * What changed: this period's KPIs from its start, or, back in style setting before anything has
 * happened this period, the last period's start and end from its summary.
 */
function changesOf(v: EngineView): Pick<Recap, 'changes' | 'since'> {
  const last = v.periods[v.periods.length - 1];
  if (v.phase === 'style' && last) {
    return { since: 'last', changes: v.kpis.map(k => ({ metric: k.metric, start: last.kpis[k.metric]?.start ?? k.start, now: last.kpis[k.metric]?.end ?? k.value, trend: sign(last.kpis[k.metric]?.start ?? k.start, last.kpis[k.metric]?.end ?? k.value) })) };
  }
  return { since: 'this', changes: v.kpis.map(k => ({ metric: k.metric, start: k.start, now: k.value, trend: k.trend })) };
}

type Recap = Omit<ResumeRecapProps, 'onBack' | 'frozen' | 'returnFocus'>;

/** Everything the recap shows, from the engine view only. */
export function buildRecap({ t }: Pick<I18n, 't'>, v: EngineView): Recap {
  const amount = (n: number) => t(v.clock.subPeriodUnit === 'day' ? 'action.days' : 'actions.cost', dayArgs(n, v.clock.subPeriodUnit));
  const { clock } = v;
  const unit = clock.subPeriodUnit;
  const first = (name: string) => name.split(' ')[0];
  const due = (n: number) => (n === 0 ? t('inbox.dueNow', { unit }) : t('board.due', { amount: amount(n) }));
  const nameOf = (from: string) => (from === 'sponsor' ? first(v.sponsor.name) : from === 'news' ? '' : first(v.members.find(m => m.id === from)?.name ?? ''));
  // Urgent first; otherwise the engine's order.
  const inbox = [...v.inbox].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  return {
    period: clock.period, periodUnit: clock.periodUnit, sub: clock.subPeriod, subPeriodUnit: unit,
    left: t('time.left', { amount: amount(clock.capacityLeft) }),
    headline: lastHeadline(v),
    inbox: inbox.map(m => ({
      id: m.id, title: m.title, urgent: m.urgent,
      from: t('inbox.tag', { type: m.kind, name: nameOf(m.from) }),
      due: m.dueInSubPeriods === null ? null : due(m.dueInSubPeriods)
    })),
    promises: v.promises.filter(p => p.state === 'open').map(p => ({
      id: p.id, name: first(v.members.find(m => m.id === p.memberId)?.name ?? ''), text: p.text, due: due(p.dueInSubPeriods)
    })),
    ...changesOf(v)
  };
}

/** The welcome back recap in the playable app, built from the engine view. Loaded on demand. */
export default function EngineResume({ view, onBack, returnFocus }: { view: EngineView; onBack: () => void; returnFocus?: () => HTMLElement | null }) {
  const i18n = useI18n();
  return <ResumeRecap {...buildRecap(i18n, view)} onBack={onBack} returnFocus={returnFocus} />;
}
