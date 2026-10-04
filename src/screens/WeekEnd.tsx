import type { ScreenProps } from '../app/types';
import { WeekEndFlow } from '../components/weekend/WeekEndFlow';
import { isWeekEndStep } from '../components/weekend/types';
import { WEEKEND_FIXTURE as FX } from '../data/fixtures';

/**
 * The prototype's week end (port of `project/ilWeekEnd.dc.html`) on the design fixture, for the
 * `/screens` gallery (frames w1 to w5). The playable app renders the same flow from the engine's
 * period summary (`src/components/board/EngineWeekEnd.tsx`).
 */
export interface WeekEndProps extends ScreenProps {
  /** Initial step: banner, report, badge, unlock or news. Read once on mount, like the design. */
  step?: string;
}

export function WeekEnd({ d, app, act, step }: WeekEndProps) {
  return (
    <WeekEndFlow
      initial={{ step: isWeekEndStep(step) ? step : undefined }}
      minHeight={app.minH}
      period={FX.period} periods={FX.periods} periodUnit="week" subPeriodUnit="day"
      headline={FX.headline} line={FX.line} stars={FX.stars}
      report={{
        funnel: {
          stages: d.stages.map(s => ({ key: s.k, name: s.n, value: s.count, ideal: s.ideal })),
          scale: FX.funnelScale, bottleneck: FX.bottleneck
        },
        kpis: FX.kpis,
        stars: FX.starRows,
        streak: FX.streak,
        sponsor: FX.sponsor,
        pulse: FX.pulse
      }}
      badges={[FX.badge]}
      unlock={{ sponsorFirstName: FX.sponsorFirstName, rewards: FX.rewards }}
      news={FX.news}
      newsArtLabel={FX.newsArtLabel}
      onShortcut={() => act.go('end')}
      onChooseReward={() => true}
      onFinish={() => act.go('style')}
    />
  );
}
