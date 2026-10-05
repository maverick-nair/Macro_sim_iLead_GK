import { useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { useI18n, type I18n } from '../../i18n';
import { funnelNumber, funnelScale, streakNote } from '../weekend/display';
import type { WeekEndBadge, WeekEndNews, WeekEndReport, WeekEndReward } from '../weekend/types';
import { WeekEndFlow, type WeekEndFlowProps } from '../weekend/WeekEndFlow';
import '../weekend/messages';

type Summary = EngineView['periods'][number];
const METRICS = ['skill', 'morale', 'result', 'trust'] as const;
const first = (name: string) => name.split(' ')[0];

/** The weekly report from the period summary and the view's rules (stars and streak). */
export function engineReport({ t, number }: Pick<I18n, 't' | 'number'>, view: EngineView, s: Summary): WeekEndReport {
  const unit = view.clock.periodUnit;
  const name = (key: string) => view.funnel.find(f => f.key === key)?.name ?? key;
  const g = view.gamification;
  const { week } = s;
  const deals = (n: number) => number(funnelNumber(n));
  return {
    funnel: {
      stages: s.funnel.map(f => ({ key: f.stage, name: name(f.stage), value: f.throughput, ideal: f.ideal, total: { value: f.cumulative, ideal: f.cumulativeIdeal } })),
      scale: funnelScale(s.funnel.flatMap(f => [f.throughput, f.ideal])),
      totalScale: funnelScale(s.funnel.flatMap(f => [f.cumulative, f.cumulativeIdeal])),
      bottleneck: s.bottleneck
    },
    kpis: METRICS.map(metric => ({ metric, start: s.kpis[metric]?.start ?? 0, end: s.kpis[metric]?.end ?? 0 })),
    stars: g.stars.map((threshold, i) => {
      const earned = i < week.stars;
      return {
        title: t('weekend.stars.threshold', { n: i + 1, threshold, earned: String(earned) }),
        earned,
        detail: t('weekend.stars.detail', { earned: String(earned), unit, score: week.score, gap: Math.max(0, threshold - week.score) })
      };
    }),
    scoreParts: [
      ...(week.styleFit.total ? [t('weekend.stars.fit', { correct: week.styleFit.correct, total: week.styleFit.total })] : []),
      t('weekend.stars.live', { count: week.live?.count ?? 0, mean: week.live?.mean ?? 0, unit }),
      t('weekend.stars.funnel', { output: deals(week.funnel.output), ideal: deals(week.funnel.ideal) })
    ],
    streak: { count: s.streak.count, unit, note: streakNote({ t }, s.streak, g.streak, unit) },
    sponsor: { from: s.sponsor.fromLevel, to: s.sponsor.toLevel, values: { from: s.sponsor.from, to: s.sponsor.to } },
    pulse: { upbeat: view.pulse.upbeat, steady: view.pulse.steady, struggling: view.pulse.struggling, value: { from: s.pulse.from, to: s.pulse.to } },
    checkIn: s.checkIn ? { sponsorName: first(view.sponsor.name), line: view.sponsor.checkInBelow } : null
  };
}

/** New badges with their names and rules from the view's badge list. */
export function engineBadges(view: EngineView, s: Summary): WeekEndBadge[] {
  return s.newBadges.map(b => {
    const def = view.badges.find(x => x.key === b.key);
    return { key: b.key, rule: def?.rule ?? b.key, name: def?.name ?? b.key, reason: b.reason };
  });
}

/** The unlock rewards on offer, worded for the next period. */
export function engineRewards({ t }: Pick<I18n, 't'>, view: EngineView, keys: string[]): WeekEndReward[] {
  const values = { sub: view.clock.subPeriodUnit, unit: view.clock.periodUnit, n: view.clock.period + 1 };
  return keys.map(key => ({ key, name: t('weekend.reward.name', { key, ...values }), description: t('weekend.reward.description', { key, ...values }) }));
}

export interface EngineWeekEndProps {
  view: EngineView;
  busy: boolean;
  /** Sends an intent; resolves false when the engine refused it. */
  send: (intent: { type: 'chooseReward'; reward: string } | { type: 'startNextPeriod' }) => Promise<boolean>;
  minHeight?: string;
  /** Where to open, for the stories. */
  initial?: WeekEndFlowProps['initial'];
  /** The run is over: after the banner, report and badges, show the results. */
  onResults: () => void;
}

/**
 * The week end in the playable app, from the last period summary in the engine view. The unlock offer
 * is read once, when the week end opens: taking the reward clears it in the view, and the step must
 * stay until the flow moves on. At the end of the run the flow stops after the badges.
 */
export function EngineWeekEnd({ view, busy, send, minHeight, initial, onResults }: EngineWeekEndProps) {
  const i18n = useI18n();
  const s = view.periods[view.periods.length - 1];
  const ended = view.phase === 'ended';
  const [offer] = useState(() => (s?.unlockOffer && view.pendingReward ? view.pendingReward : null));
  if (!s) return null;
  const news: WeekEndNews[] = s.news.map(n => ({ key: n.key, card: n.card, title: n.title, body: n.body, impact: n.impact }));
  return (
    <WeekEndFlow
      focusOnOpen={!initial}
      initial={initial}
      minHeight={minHeight}
      period={s.period} periods={view.clock.periods} periodUnit={view.clock.periodUnit} subPeriodUnit={view.clock.subPeriodUnit}
      headline={s.headline} line={s.line} stars={s.week.stars}
      report={engineReport(i18n, view, s)}
      badges={engineBadges(view, s)}
      unlock={offer ? { sponsorFirstName: first(view.sponsor.name), rewards: engineRewards(i18n, view, offer) } : null}
      news={news}
      ended={ended}
      busy={busy}
      onChooseReward={reward => send({ type: 'chooseReward', reward })}
      onFinish={() => { if (ended) onResults(); else void send({ type: 'startNextPeriod' }); }}
    />
  );
}
