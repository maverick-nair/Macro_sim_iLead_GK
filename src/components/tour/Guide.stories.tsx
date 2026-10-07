import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { EngineBoard } from '../board/EngineBoard';
import { BoardNotices } from '../board/BoardNotices';
import DemoFlow from '../demo/DemoFlow';
import { EngineView } from '../../engine/contract';
import { createMockClient, defaultStoryline } from '../../engine/mock';
import { EngineProvider } from '../../engine/react';
import { createEngine } from '../../engine/sim/engine';
import { Coachmark } from './Coachmark';
import './messages';

/**
 * The guided tour (D94), the demo round (D92), milestones (D93) and one time tips (D99). The board stories
 * play on the mock engine; the tour starts open, as it does the first time a participant reaches the board.
 */
const meta: Meta = { title: 'Board/Guide', parameters: { layout: 'fullscreen' } };
export default meta;
const noop = () => {};

/** One tip over its target: the ring, the dimming around it, the counter, Back, Next and Skip. */
export const Tip: StoryObj = {
  render: () => (
    <div style={{ position: 'relative', height: 600 }}>
      <button type="button" data-tour="example" className="m-20 rounded-pill border border-line-default bg-surface-raised px-4 py-2 text-fg-primary">End week 2</button>
      <Coachmark target='[data-tour="example"]' title="End of the week" body="When you are done, end the week. You will see your report and the news." counter="Board tour · 13 of 13" stepKey="end" onEscape={noop}>
        <button type="button" className="min-h-9 rounded-pill border-0 bg-(image:--il-fill-brand) px-3.5 text-13 font-700 text-brand-deep-space">Done</button>
      </Coachmark>
    </div>
  )
};

/** No target on screen: the tip sits in the middle of the window over a dimmed page. */
export const TipWithoutTarget: StoryObj = {
  render: () => (
    <div style={{ position: 'relative', height: 600 }}>
      <Coachmark target={null} title="Notifications" body="When you act, the people involved respond here." counter="Board tour · 7 of 13" stepKey="n" onEscape={noop}>
        <button type="button" className="min-h-9 rounded-pill border-0 bg-(image:--il-fill-brand) px-3.5 text-13 font-700 text-brand-deep-space">Next</button>
      </Coachmark>
    </div>
  )
};

/** Style setting's short tour, as it starts the first time week 1's style setting shows. */
export const StyleSettingTour: StoryObj = {
  render: () => (
    <EngineProvider client={createMockClient({ seed: 1 })}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}><EngineBoard onPause={noop} onSettings={noop} startTour="style" /></div>
    </EngineProvider>
  )
};

/** The board tour, on the board after week 1's styles. */
export const BoardTour: StoryObj = {
  loaders: [async () => {
    const c = createMockClient({ seed: 1 });
    const v = await c.view();
    await c.send({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G'])) });
    return { client: c };
  }],
  render: (_a, { loaded }) => (
    <EngineProvider client={(loaded as { client: ReturnType<typeof createMockClient> }).client}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}><EngineBoard onPause={noop} onSettings={noop} startTour="board" /></div>
    </EngineProvider>
  )
};

/** The demo offer after onboarding: Play the demo, or Skip to the simulation. */
export const DemoOffer: StoryObj = { render: () => <DemoFlow onDone={noop} onPause={noop} onSettings={noop} minHeight="100vh" /> };
/** The demo board with its first tip: one style left to set. Play it through: select, act, see the impact. */
export const DemoRun: StoryObj = { render: () => <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}><DemoFlow initialStage="run" onDone={noop} onPause={noop} onSettings={noop} /></div> };
/** The end of the demo: You are ready, Play simulation. */
export const DemoDone: StoryObj = { render: () => <DemoFlow initialStage="done" onDone={noop} onPause={noop} onSettings={noop} minHeight="100vh" /> };

/** A milestone reached and two tips, as slim notices under the team metrics. */
function Notices() {
  const [gone, setGone] = useState<string[]>([]);
  const v = EngineView.parse(createEngine(defaultStoryline(), { seed: 1 }).view());
  const notices = [
    { key: 'milestone:target:25', kind: 'milestone' as const, milestone: { key: 'target:25', kind: 'target' as const, stage: null, pct: 25, period: 2, sub: 3 } },
    { key: 'milestone:stage:qualify:50', kind: 'milestone' as const, milestone: { key: 'stage:qualify:50', kind: 'stage' as const, stage: 'qualify', pct: 50, period: 3, sub: 1 } },
    { key: 'tip:hireUnlocked', kind: 'tip' as const, tip: 'hireUnlocked' as const },
    { key: 'tip:seatOpen:leads', kind: 'tip' as const, tip: 'seatOpen' as const, stage: 'leads' }
  ].filter(n => !gone.includes(n.key));
  return <div data-celebration="full" style={{ width: 1440 }}><BoardNotices notices={notices} view={v} onDismiss={k => setGone(g => [...g, k])} onLeaderboard={noop} /></div>;
}
export const MilestonesAndTips: StoryObj = { render: () => <Notices /> };
