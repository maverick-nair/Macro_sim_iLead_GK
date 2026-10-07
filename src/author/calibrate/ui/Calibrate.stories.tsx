import type { Meta, StoryObj } from '@storybook/react-vite';
import draft from '../../../engine/storylines/sales-elevator.json';
import type { CalibrationRun, CalibrationRunner } from '../logic/client';
import { runCalibration, type CalibrationOutput } from '../logic/run';
import type { CalibrationResults } from '../logic/schema';
import CalibrateView from './CalibrateView';
import { PlaythroughView } from './PlaythroughView';
import { ChecksList, ResultsTable } from './Results';

/**
 * GenieKreator's "Test with synthetic players" (D116; Calibrate.dc.html, CalibrateRun.dc.html). The
 * stories play a small real calibration of Sales Elevator in a loader (two playthroughs a level, no probes).
 */
const meta: Meta = { title: 'Author/Test with synthetic players', parameters: { layout: 'padded' } };
export default meta;

let cached: Promise<CalibrationOutput> | null = null;
const calibrate = () => (cached ??= runCalibration(draft, { personas: { beginner: 2, developing: 2, proficient: 2, expert: 2 }, probes: false, seed: 1 }, { ranOn: 'browser', yieldEvery: async () => undefined }));
const loaders = [async () => ({ out: await calibrate() })];
type Loaded = { out: CalibrationOutput };
const asRun = (out: CalibrationOutput): CalibrationRun => ({ results: out.results, playthrough: async (p, i) => out.playthroughs.find(x => x.persona === p && x.index === i)! });
/** A runner that answers at once with the loaded calibration, so Run works in Storybook. */
const instant = (out: CalibrationOutput): CalibrationRunner => ({ run: async (_d, _s, o) => { o?.onProgress?.(8, 8); return asRun(out); } });
const Frame = ({ children }: { children: React.ReactNode }) => <div style={{ maxWidth: 1180 }}>{children}</div>;

/** Before a run: the four levels, how each plays, and how many playthroughs. */
export const Setup: StoryObj = {
  loaders,
  render: (_, { loaded }) => <Frame><CalibrateView config={draft} runner={instant((loaded as Loaded).out)} /></Frame>
};

/** Results kept from an earlier run of this draft, with "Ask Kora" on the checks that need a look. */
export const Results: StoryObj = {
  loaders,
  render: (_, { loaded }) => <Frame><CalibrateView config={draft} results={(loaded as Loaded).out.results} onAsk={() => undefined} /></Frame>
};

/** Results of an earlier version of the draft: marked out of date. */
export const OutOfDate: StoryObj = {
  loaders,
  render: (_, { loaded }) => <Frame><CalibrateView config={{ ...draft, name: 'Sales Elevator, edited' }} results={(loaded as Loaded).out.results} /></Frame>
};

/** Checks that fail and need a look, with what to change. */
export const FailingChecks: StoryObj = {
  loaders,
  render: (_, { loaded }) => {
    const r = (loaded as Loaded).out.results;
    const failing: CalibrationResults = {
      ...r,
      checks: [
        { key: 'ordered', status: 'fail', title: 'Scores do not rise with proficiency: Proficient scores no higher than Developing', detail: 'Average Leadership Score: Beginner 400, Developing 610, Proficient 590, Expert 900.', fix: 'Make reading people matter more: raise the effect of a style that fits, or the cost of one that misses, in the weekly styles and the conversation actions.' },
        { key: 'dominant', status: 'fail', title: 'A single strategy wins without good leadership: Spending every day on Coach member reaches Gold (720 points)', detail: null, fix: 'Give Coach member a cooldown, raise its cost or lower its effect.' },
        { key: 'separation', status: 'warn', title: 'Developing and Proficient score within 20 points', detail: 'Levels this close are hard to tell apart in a report.', fix: 'Make needs harder to read early on, so careful diagnosis pays off sooner, or make a strong conversation count for more.' },
        ...r.checks.filter(c => c.key === 'expertTier' || c.key === 'beginnerTier')
      ]
    };
    return <Frame><div className="grid grid-cols-2 gap-3"><ResultsTable results={failing} canWatch onWatch={() => undefined} /><ChecksList results={failing} onAsk={() => undefined} /></div></Frame>;
  }
};

/** One playthrough: week by week, and each conversation with its rating and why. */
export const Playthrough: StoryObj = {
  loaders,
  render: (_, { loaded }) => {
    const out = (loaded as Loaded).out;
    return <Frame><PlaythroughView results={out.results} load={asRun(out).playthrough} persona="developing" index={0} onPick={() => undefined} onBack={() => undefined} /></Frame>;
  }
};
