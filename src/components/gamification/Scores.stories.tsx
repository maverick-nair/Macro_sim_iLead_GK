import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Hud, type HudProps } from '../hud/Hud';
import { BADGE_RULES, badgeIcon } from './badgeIcons';
import { BadgeList, BadgeShelfDialog } from './BadgeShelfDialog';
import { ScoreBreakdown, type ScoreBreakdownProps } from './ScoreBreakdown';
import { streakText, type ShelfBadge } from './display';

const meta: Meta = { title: 'Components/Scores and badges' };
export default meta;

const noop = () => {};
const TIERS = [{ key: 'platinum', name: 'Platinum', min: 850 }, { key: 'gold', name: 'Gold', min: 700 }, { key: 'silver', name: 'Silver', min: 500 }, { key: 'bronze', name: 'Bronze', min: 0 }];

/** The engine's default badge library, three earned (week 3 of the Sales Elevator). */
const BADGES: ShelfBadge[] = [
  { key: 'first_close', rule: 'first_close', name: 'First Close', description: 'Your team converts its first deal.', earned: true, period: 2, reason: 'Your team closed its first deal.' },
  { key: 'read_the_room', rule: 'read_the_room', name: 'Read the Room', description: 'Give at least 9 in 10 people the style they need in one week.', earned: true, period: 1, reason: '10 of 10 people got the style they needed this week.' },
  { key: 'flex_master', rule: 'flex_master', name: 'Flex Master', description: 'Use every style correctly at least twice.', earned: true, period: 1, reason: 'You used every style at the right moment at least twice.' },
  { key: 'concern_uncovered', rule: 'concern_uncovered', name: 'Concern Uncovered', description: 'Help five people open up about what is bothering them.', earned: false, period: null, reason: null },
  { key: 'promise_keeper', rule: 'promise_keeper', name: 'Promise Keeper', description: 'Make three promises and break none.', earned: false, period: null, reason: null },
  { key: 'fair_hand', rule: 'fair_hand', name: 'Fair Hand', description: 'Recognize people three times without anyone feeling passed over.', earned: false, period: null, reason: null },
  { key: 'turnaround', rule: 'turnaround', name: 'Turnaround', description: 'Bring someone from morale below 30 to above 60.', earned: false, period: null, reason: null },
  { key: 'change_champion', rule: 'change_champion', name: 'Change Champion', description: 'Explain a change really well twice.', earned: false, period: null, reason: null },
  { key: 'steady_hand', rule: 'steady_hand', name: 'Steady Hand', description: 'Finish the run without a conversation going badly.', earned: false, period: null, reason: null },
  { key: 'target_crusher', rule: 'target_crusher', name: 'Target Crusher', description: 'Reach the revenue target.', earned: false, period: null, reason: null }
];

const RULE = { length: 3, minStars: 2, bonus: 25, cap: 100 };

function Breakdown(p: Partial<ScoreBreakdownProps> & { count?: number; next?: number | null; firstWeek?: boolean }) {
  const { t } = useI18n();
  const streak = streakText(t, { count: p.count ?? 2, next: p.firstWeek ? undefined : p.next === undefined ? 1 : p.next, periodUnit: 'week', rule: RULE });
  return (
    <div className="flex w-80 flex-col gap-2 rounded-16 border border-line-strong bg-surface-material p-3.5">
      <ScoreBreakdown total={433} max={1000}
        pillars={[{ key: 'business', value: 18, weight: 0.3 }, { key: 'people', value: 49, weight: 0.3 }, { key: 'leadership', value: 70, weight: 0.4 }]}
        capability={70} live={null} bonus={0} bonusCap={100} tiers={TIERS} tier={null}
        badges={{ earned: 3, total: 10 }} onBadges={noop} {...p} streak={streak} />
    </div>
  );
}

/** Week 3: the three pillars with their weights and what feeds them, no streak bonus yet, Bronze range. */
export const ScoreBreakdownWeek3: StoryObj = { render: () => <Breakdown /> };

/** Later in a run: live conversations in Leadership, a streak bonus, Gold range. */
export const ScoreBreakdownGold: StoryObj = { render: () => <Breakdown total={742} pillars={[{ key: 'business', value: 92, weight: 0.3 }, { key: 'people', value: 71, weight: 0.3 }, { key: 'leadership', value: 78, weight: 0.4 }]} capability={81} live={74} bonus={50} count={4} next={1} badges={{ earned: 6, total: 10 }} /> };

/** The run has ended: the engine names the tier, and the bonus is at its cap. */
export const ScoreBreakdownEnded: StoryObj = { render: () => <Breakdown total={881} bonus={100} count={7} next={null} tier={{ key: 'platinum', name: 'Platinum' }} /> };

/** Week 1, before any week has ended: the streak states its rule. */
export const ScoreBreakdownFirstWeek: StoryObj = { render: () => <Breakdown total={386} count={0} firstWeek badges={{ earned: 0, total: 10 }} /> };

const HUD: HudProps = {
  nav: [], onNav: noop,
  clock: { period: 3, periodUnit: 'week', subPeriod: 1, subPeriodUnit: 'day', capacity: 5, capacityLeft: 5 },
  sessionClock: null, onPause: noop, score: { total: 433, business: 18, people: 49, leadership: 70 },
  streak: 2, streakLabel: '2 weeks in a row. 1 more week for a +25 bonus.', onPalette: noop, onSettings: noop, onEndPeriod: noop, endEmphasis: 'primary'
};

/** The engine HUD with its breakdown open (Enter or Space on the score). The flame names the streak and the next bonus. */
export const HudWithBreakdown: StoryObj = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return <div style={{ width: 1440, height: 640 }}><Hud {...HUD} scoreOpen={open} onScoreOpenChange={setOpen} breakdown={<ScoreBreakdownInner />} /></div>;
  }
};
function ScoreBreakdownInner() {
  const { t } = useI18n();
  return <ScoreBreakdown total={433} max={1000} pillars={[{ key: 'business', value: 18, weight: 0.3 }, { key: 'people', value: 49, weight: 0.3 }, { key: 'leadership', value: 70, weight: 0.4 }]}
    capability={70} live={null} bonus={0} bonusCap={100} streak={streakText(t, { count: 2, next: 1, periodUnit: 'week', rule: RULE })} tiers={TIERS} tier={null} badges={{ earned: 3, total: 10 }} onBadges={noop} />;
}

/** The shelf: earned badges first with what earned them and when, the rest dimmed with their description as the hint. */
export const BadgeShelfList: StoryObj = { render: () => <div style={{ width: 512 }}><BadgeList badges={BADGES} periodUnit="week" /></div> };

/** The shelf as the board opens it, from the score breakdown. */
export const BadgeShelfOpen: StoryObj = { render: () => <div style={{ height: 900 }}><BadgeShelfDialog badges={BADGES} periodUnit="week" onClose={noop} /></div> };

/** Nothing earned yet. */
export const BadgeShelfEmpty: StoryObj = { render: () => <div style={{ height: 900 }}><BadgeShelfDialog badges={BADGES.map(b => ({ ...b, earned: false, period: null, reason: null }))} periodUnit="week" onClose={noop} /></div> };

/** Every badge rule's icon, earned and not, plus the plain medal for a custom rule. */
export const BadgeIcons: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {[...BADGE_RULES, 'custom'].map(r => (
        <div key={r} className="flex flex-col items-center gap-2 text-12 text-fg-secondary">
          <span className="flex size-16 items-center justify-center rounded-round bg-(image:--il-fill-spectrum) text-brand-deep-space"><span className="size-8">{badgeIcon(r)}</span></span>
          <span className="flex size-10 items-center justify-center rounded-round bg-track text-fg-secondary"><span className="size-5">{badgeIcon(r)}</span></span>
          <span>{r}</span>
        </div>
      ))}
    </div>
  )
};
