import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import { END_FIXTURE, WEEKEND_FIXTURE as FX } from '../../data/fixtures';
import { EndScreen } from '../end/EndScreen';
import { BannerStep, BadgeStep, UnlockStep } from '../weekend/WeekEndSteps';

/**
 * The celebration level (Configuration Spec, Celebrations), set as `data-celebration` on the board
 * container from `view.gamification.celebration`. None: static states, no motion or glow. Subtle (the
 * default): the design. Full: pop ins, a wider glow and a brief burst behind the stars and the medal.
 * Reduced motion always wins (the OS setting or the in-app one, shown here as `il-reduced-motion`).
 */
type Level = 'none' | 'subtle' | 'full';
const noop = () => {};

function Levels({ children, reduced }: { children: (level: Level) => ReactNode; reduced?: boolean }) {
  // Remount on demand, so the entrances can be watched again.
  const [run, setRun] = useState(0);
  return (
    <div className={reduced ? 'il-reduced-motion' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button type="button" onClick={() => setRun(r => r + 1)} style={{ alignSelf: 'flex-start' }}>Play again</button>
      <div key={run} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {(['none', 'subtle', 'full'] as const).map(level => (
          <section key={level} data-celebration={level} aria-label={level} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 640, overflow: 'hidden', border: '1px dashed var(--il-color-line-default)', borderRadius: 16 }}>
            <b style={{ position: 'absolute', top: 8, left: 12, zIndex: 1 }}>{level}</b>
            {children(level)}
          </section>
        ))}
      </div>
    </div>
  );
}

const meta: Meta = { title: 'Components/Celebration level' };
export default meta;

/** The week end banner: stars and the halo behind the headline. */
export const Banner: StoryObj = {
  render: () => <Levels>{() => <BannerStep period={FX.period} periodUnit="week" headline={FX.headline} line={FX.line} stars={FX.stars} onNext={noop} />}</Levels>
};
/** A new badge: the award's entrance, glow and (full) the burst behind the medal. */
export const BadgeAward: StoryObj = {
  render: () => <Levels>{() => <BadgeStep badge={FX.badge} index={1} total={1} onSkip={noop} onNext={noop} />}</Levels>
};
/** The unlock: the chosen reward card's lift. */
export const RewardLift: StoryObj = {
  render: () => <Levels>{() => <UnlockStep sponsorFirstName={FX.sponsorFirstName} period={FX.period} periodUnit="week" rewards={FX.rewards.slice(0, 1)} chosen={0} onChoose={noop} onTake={noop} />}</Levels>
};
/** The end screen's tier word: plain (none), the spectrum (subtle), the spectrum with a glow (full). */
export const EndTier: StoryObj = {
  render: () => (
    <Levels>
      {() => (
        <div style={{ zoom: 0.45 }}>
          <EndScreen periods={END_FIXTURE.periods} periodUnit="week" people={END_FIXTURE.people} tiers={END_FIXTURE.tiers} tier={END_FIXTURE.tier}
            score={END_FIXTURE.score} scoreMax={END_FIXTURE.scoreMax} results={END_FIXTURE.results} moments={[]} badges={[]}
            reflection={{ questions: [], answers: [], rating: null, onAnswer: noop, onRate: noop, onMic: noop }}
            onViewReport={noop} onDownload={noop} onEmail={noop} />
        </div>
      )}
    </Levels>
  )
};
/** Full under reduced motion: no pop, no burst, no transition; the static glow and colours stay. */
export const FullWithReducedMotion: StoryObj = {
  render: () => <Levels reduced>{() => <BannerStep period={FX.period} periodUnit="week" headline={FX.headline} line={FX.line} stars={FX.stars} onNext={noop} />}</Levels>
};
