import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { EngineView } from '../../engine/contract';
import { defaultStoryline } from '../../engine/mock';
import { createEngine } from '../../engine/sim/engine';
import { neededStyles } from '../../engine/sim/policies';
import { withSixStyles } from '../../engine/storylines/sixStyles';
import { parseStoryline, type StorylineInput } from '../../engine/config';
import salesElevator from '../../engine/storylines/sales-elevator.json';
import { MoneyProvider } from '../../i18n/money';
import { LensProvider } from '../style/lens';
import PlayPanels, { type PlayPanel } from './PlayPanels';

/**
 * The in play panels (D89 to D97), on views from the mock engine: two weeks played (styles, a training,
 * the period end, the next week's styles), or a fresh run.
 */
const meta: Meta = { title: 'Board/In play panels', parameters: { layout: 'fullscreen' } };
export default meta;

async function played(config = defaultStoryline(), weeks = 2) {
  const e = createEngine(config, { seed: 2 });
  for (let w = 1; w <= weeks; w++) {
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e, config.thresholds.high, config.lens) });
    if (w < weeks) {
      if (w === 1) await e.dispatch({ type: 'planAction', action: 'training', option: 'three_day', memberIds: [e.view().members[0].id] });
      await e.dispatch({ type: 'endPeriod' });
      if (e.view().pendingReward) await e.dispatch({ type: 'chooseReward', reward: e.view().pendingReward![0] });
      await e.dispatch({ type: 'startNextPeriod' });
    }
  }
  return EngineView.parse(e.view());
}
const fresh = async () => EngineView.parse(createEngine(defaultStoryline(), { seed: 1 }).view());
/** Sales Elevator with a welcome video and its transcript (no storyline ships one yet, D54). */
const withVideo = async () => {
  const r = parseStoryline({ ...(salesElevator as unknown as StorylineInput), video: { src: '/assets/video/sample-welcome.webm', captions: '/assets/video/sample-welcome.vtt', transcript: ['Welcome to Innov8 Elevators. I am Paula, and I lead sales for the region.', 'Over the next eight weeks you lead a team of ten through our sales funnel.'] } });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return played(r.config, 1);
};
const sixStyles = async () => {
  const r = parseStoryline(withSixStyles(salesElevator as unknown as StorylineInput));
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return played(r.config, 1);
};

const names = (v: EngineView) => (id: string) => v.members.find(m => m.id === id)?.name ?? null;
function Panel({ view, panel, availability = {} }: { view: EngineView; panel: PlayPanel; availability?: Record<string, string> }): ReactNode {
  return (
    <MoneyProvider money={view.money}>
      <LensProvider lens={view.lens}>
        <div style={{ position: 'relative', minHeight: 800 }}>
          <PlayPanels panel={panel} view={view} nameOf={names(view)} availability={availability} onClose={() => undefined} onTour={() => undefined} />
        </div>
      </LensProvider>
    </MoneyProvider>
  );
}
type Loaded = { loaded: { view: EngineView } };
const story = (load: () => Promise<EngineView>, panel: PlayPanel, availability?: Record<string, string>): StoryObj => ({
  loaders: [async () => ({ view: await load() })],
  render: (_args, { loaded }) => <Panel view={(loaded as Loaded['loaded']).view} panel={panel} availability={availability} />
});

/** Objectives (D90): the sponsor's letter, reopenable during play. */
export const Objectives = story(played, { kind: 'objectives' });
/** Tutorial and video (D90, D91): the lens's styles, needs and worked examples. */
export const Tutorial = story(played, { kind: 'tutorial' });
/** With a welcome video: Video, Transcript and How to lead tabs. */
export const TutorialWithVideo = story(withVideo, { kind: 'tutorial' });
/** Another lens (Six Leadership Styles): two examples worded from its needs and the styles that fit them. */
export const TutorialSixStyles = story(sixStyles, { kind: 'tutorial' });
/** History (D95): two weeks, everyone. */
export const History = story(played, { kind: 'history' });
/** History opened from an outcome's View history: one person's story. */
export const HistoryOnePerson = story(played, { kind: 'history', filter: { person: 'beth' } });
/** History at the very start: nothing yet. */
export const HistoryEmpty = story(fresh, { kind: 'history' });
/** Result overview (D96): against the targets, and each person's result week by week. */
export const ResultOverview = story(played, { kind: 'overview', tab: 'results' });
/** Stage overview (D96): the funnel this week and week by week. */
export const StageOverview = story(played, { kind: 'overview', tab: 'stages' });
/** Every action (D97): what it does, cost, wait, unlock, options and whether it can be taken now. */
export const AboutTheseActions = story(played, { kind: 'actions' }, { meet: 'Available now', energize: 'Available now', hire: 'Unlocks in week 3', training: 'Open for 9 people' });
/** The leaderboard during play, from the mock cohort. */
export const Leaderboard = story(played, { kind: 'leaderboard' });
