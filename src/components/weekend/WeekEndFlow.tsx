import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { WeekEndReport } from './WeekEndReport';
import { BadgeStep, BannerStep, NewsStep, UnlockStep, WeekEndHeader } from './WeekEndSteps';
import type { PeriodUnit, SubPeriodUnit, WeekEndBadge, WeekEndNews, WeekEndReport as Report, WeekEndReward, WeekEndStep } from './types';
import './messages';

export interface WeekEndFlowProps {
  /** Where to open, for the gallery and stories. Normal play starts at the banner. */
  initial?: { step?: WeekEndStep; badge?: number; news?: number; reward?: number; impact?: boolean };
  minHeight?: string;
  /** Focus the opening step's heading too (the playable app, where the week end replaces the board). */
  focusOnOpen?: boolean;
  /** The period that just ended, and the run's length. */
  period: number;
  periods: number;
  periodUnit: PeriodUnit;
  subPeriodUnit: SubPeriodUnit;
  /** Engine text (D60). */
  headline: string;
  line: string;
  stars: number;
  report: Report;
  badges: WeekEndBadge[];
  /** The unlock offer, when the sponsor's confidence crossed the line. */
  unlock: { sponsorFirstName: string; rewards: WeekEndReward[] } | null;
  news: WeekEndNews[];
  /** The run is over: the flow ends after the badges with "See your results". */
  ended?: boolean;
  /** An intent is on its way: the buttons that send one wait. */
  busy?: boolean;
  /** A note over the news art (the design gallery's annotation). */
  newsArtLabel?: string;
  /** The design gallery's shortcut to the end of the run. */
  onShortcut?: () => void;
  /** Takes the reward. Resolves false when the engine refused it, so the flow stays put. */
  onChooseReward: (key: string) => void | boolean | Promise<boolean>;
  /** The last step's button: start the next period, or see the results once the run is over. */
  onFinish: () => void;
  /** `phone`: a 390 screen. The report and the rewards stack in one column, with phone gutters. */
  layout?: 'desktop' | 'phone';
}

/**
 * The week end: the banner, the weekly report, each new badge, the unlock offer (when the sponsor's
 * confidence crossed the line) and the next period's news. Holds only the flow's own state (step,
 * badge, chosen reward, news page); everything about the period arrives as props and choices leave as
 * events. Each new step moves focus to its heading.
 */
export function WeekEndFlow(p: WeekEndFlowProps) {
  const { t } = useI18n();
  const unlock = p.ended ? null : p.unlock;
  const news = p.ended ? [] : p.news;
  const steps: WeekEndStep[] = ['banner', 'report'];
  if (p.badges.length) steps.push('badge');
  if (unlock?.rewards.length) steps.push('unlock');
  if (news.length) steps.push('news');
  const [step, setStep] = useState<WeekEndStep>(() => (p.initial?.step && steps.includes(p.initial.step) ? p.initial.step : 'banner'));
  const [badge, setBadge] = useState(p.initial?.badge ?? 0);
  const [reward, setReward] = useState<number | null>(p.initial?.reward ?? null);
  const [page, setPage] = useState(p.initial?.news ?? 0);
  const [impact, setImpact] = useState(!!p.initial?.impact);
  const [taking, setTaking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  /** The step and page whose heading last took focus; the opening step does not take it. */
  const shown = useRef(p.focusOnOpen ? '' : `${step}:${badge}:${page}`);

  useEffect(() => {
    const at = `${step}:${badge}:${page}`;
    if (shown.current === at) return;
    shown.current = at;
    root.current?.querySelector<HTMLElement>('h1[tabindex], h2[tabindex]')?.focus({ preventScroll: true });
  }, [step, badge, page]);

  const next = (from: WeekEndStep = step) => {
    const i = steps.indexOf(from);
    if (i < steps.length - 1) setStep(steps[i + 1]);
    else p.onFinish();
  };
  const unit = p.periodUnit;
  const finishLabel = p.ended ? t('weekend.results') : t('weekend.next', { unit, n: p.period + 1 });
  const lastStep = steps[steps.length - 1];
  const phone = p.layout === 'phone';

  const take = async () => {
    if (!unlock || reward === null || taking) return;
    setTaking(true);
    try {
      const ok = await p.onChooseReward(unlock.rewards[reward].key);
      if (ok !== false) next('unlock');
    } finally {
      setTaking(false);
    }
  };

  return (
    <div ref={root} className={`relative flex flex-1 flex-col gap-5 ${phone ? 'px-(--il-phone-gutter-x) pt-(--il-phone-top) pb-(--il-phone-gutter-bottom)' : 'px-8 pt-5 pb-8'}`} style={{ minHeight: p.minHeight }}>
      <WeekEndHeader period={p.period} periods={p.periods} periodUnit={unit} onShortcut={p.onShortcut} />
      {step === 'banner' && <BannerStep period={p.period} periodUnit={unit} headline={p.headline} line={p.line} stars={p.stars} onNext={() => next()} />}
      {step === 'report' && (
        <>
          <h1 tabIndex={-1} className="sr-only">{t('weekend.report.heading', { unit, n: p.period })}</h1>
          <WeekEndReport layout={p.layout} report={p.report} period={p.period} periodUnit={unit} subPeriodUnit={p.subPeriodUnit} last={!!p.ended || p.period >= p.periods}
            continueLabel={lastStep === 'report' ? finishLabel : t('weekend.report.continue')} onContinue={() => next()} />
        </>
      )}
      {step === 'badge' && p.badges[badge] && (
        <BadgeStep key={p.badges[badge].key} badge={p.badges[badge]} index={badge + 1} total={p.badges.length}
          onSkip={() => next('badge')}
          onNext={() => (badge < p.badges.length - 1 ? setBadge(badge + 1) : next('badge'))} />
      )}
      {step === 'unlock' && unlock && (
        <UnlockStep layout={p.layout} sponsorFirstName={unlock.sponsorFirstName} period={p.period + 1} periodUnit={unit} rewards={unlock.rewards}
          chosen={reward} busy={taking || p.busy} onChoose={setReward} onTake={() => void take()} />
      )}
      {step === 'news' && news[page] && (
        <NewsStep period={p.period + 1} periodUnit={unit} news={news[page]} index={page} total={news.length} impact={impact} artLabel={p.newsArtLabel}
          nextLabel={page === news.length - 1 ? finishLabel : t('weekend.news.next')} busy={page === news.length - 1 && p.busy}
          onImpact={() => setImpact(x => !x)}
          onPrevious={() => { setPage(x => Math.max(0, x - 1)); setImpact(false); }}
          onNext={() => { if (page < news.length - 1) { setPage(page + 1); setImpact(false); } else p.onFinish(); }} />
      )}
    </div>
  );
}
