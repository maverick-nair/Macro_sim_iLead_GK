import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiContext, createMockApi } from '../../api';
import { EngineView } from '../../engine/contract';
import { defaultStoryline } from '../../engine/mock';
import { play } from '../../engine/sim/policies';
import { END_FIXTURE as FX } from '../../data/fixtures';
import { DEFAULT_SCENARIO } from '../../data/scenario';
import { MoneyProvider } from '../../i18n/money';
import { EngineEnd } from '../board/EngineEnd';
import type { BadgeChipProps } from '../gamification/Badge';
import { badgeIcon } from '../gamification/badgeIcons';
import { EndScreen } from './EndScreen';
import { ReportSlot } from './ReportSlot';
import type { EndReflection, EndScreenProps } from './types';

const noop = () => {};
const Frame = ({ children }: { children: ReactNode }) => <div style={{ width: 1440, minHeight: 900, display: 'flex', flexDirection: 'column' }}>{children}</div>;

const BADGES: BadgeChipProps[] = DEFAULT_SCENARIO.badges.map((b, i) => ({ name: b.n, detail: b.d, status: i < 4 ? (b.isNew ? 'new' : 'earned') : 'locked' }));

/** The design fixture, as frame e1 shows it. */
const DESIGN: Omit<EndScreenProps, 'reflection'> & { reflection: Partial<EndReflection> } = {
  periods: FX.periods, periodUnit: 'week', people: FX.people,
  tiers: FX.tiers, tier: FX.tier, score: FX.score, scoreMax: FX.scoreMax,
  results: FX.results, moments: FX.moments, badges: BADGES,
  reflection: {},
  onViewReport: noop, onDownload: noop, onEmail: noop
};

/** Holds the reflection like the screens do, so the boxes, the mic and the rating work. */
function Stateful(p: Omit<EndScreenProps, 'reflection'> & { reflection: Partial<EndReflection> }) {
  const r = p.reflection;
  const questions = r.questions ?? FX.questions;
  const [answers, setAnswers] = useState<string[]>(r.answers ?? FX.answers.slice(0, questions.length));
  const [rating, setRating] = useState<number | null>(r.rating === undefined ? FX.rating : r.rating);
  const [dictating, setDictating] = useState<number | null>(r.dictating ?? null);
  return (
    <EndScreen {...p} reflection={{
      questions, answers, rating, dictating, save: r.save,
      onAnswer: (i, text) => setAnswers(a => a.map((x, j) => (j === i ? text : x))),
      onRate: setRating,
      onMic: i => setDictating(d => (d === i ? null : i))
    }} />
  );
}

const meta: Meta<typeof Stateful> = {
  title: 'Components/End screen', component: Stateful, args: DESIGN,
  decorators: [S => <Frame><S /></Frame>]
};
export default meta;
type Story = StoryObj<typeof Stateful>;

/** e1: the design fixture. Gold, the results, four moments, the badges and two questions. */
export const Design: Story = {};
/** As the playable app shows it: the save row (unsaved changes), the way to the board, badge icons. */
export const InTheApp: Story = {
  args: {
    onLookAtBoard: noop,
    badges: BADGES.map((b, i) => ({ ...b, icon: badgeIcon(['first_close', 'read_the_room', 'flex_master', 'steady_hand', 'fair_hand', 'turnaround'][i]) })),
    reflection: { save: { state: 'dirty', onSave: noop } }
  }
};
/** Saved: the answers and rating went to the engine. */
export const Saved: Story = { args: { onLookAtBoard: noop, reflection: { save: { state: 'saved', onSave: noop, busy: true } } } };
/** A save that did not go through. */
export const SaveFailed: Story = { args: { onLookAtBoard: noop, reflection: { save: { state: 'error', onSave: noop } } } };
/** Dictating into the second answer: the mic is pressed and screen readers hear that it listens. */
export const Dictating: Story = { args: { reflection: { dictating: 1 } } };
/** No rating yet, empty answers. The first rating button is the one in the tab order. */
export const Empty: Story = { args: { reflection: { answers: ['', ''], rating: null } } };
/** Three authored questions. */
export const ThreeQuestions: Story = {
  args: { reflection: { questions: [...FX.questions, 'Which conversation would you have again, and how?'], answers: ['', '', ''] } }
};
/** No questions authored: only the rating. */
export const NoQuestions: Story = { args: { reflection: { questions: [], answers: [] } } };
/** Bronze, behind the target, the metrics down: the deltas turn red. */
export const Behind: Story = {
  args: {
    tier: 'bronze', score: 412,
    results: { ...FX.results, revenue: 131200, share: 0.547, conversionsNote: '−3 on ideal pace', conversionsTone: 'decline',
      kpis: FX.results.kpis.map(k => ({ ...k, end: k.start - 4 })) }
  }
};
/** No moment stood out. */
export const NoMoments: Story = { args: { moments: [] } };
/** Long engine text: titles that wrap. */
export const LongText: Story = {
  args: {
    moments: FX.moments.map(m => ({ ...m, title: `${m.title}, and the whole team noticed it in the next meeting with the regional director` }))
  }
};
/** A smaller window, 1024 wide. */
export const At1024: Story = { decorators: [S => <div style={{ width: 1024 }}><S /></div>] };

/** A view from a real run (Sales Elevator, seed 3), on the end screen with the mock API. */
function FromRun({ policy, voiceConsent = true }: { policy: 'good' | 'passive' | 'random'; voiceConsent?: boolean }) {
  const [view, setView] = useState<EngineView | null>(null);
  const [api] = useState(() => createMockApi({ latencyMs: 300 }));
  useEffect(() => {
    void (async () => {
      const r = await play(defaultStoryline(), policy, 3);
      setView(EngineView.parse(r.view));
    })();
  }, [policy]);
  if (!view) return null;
  return (
    <ApiContext.Provider value={api}>
      <MoneyProvider money={view.money}>
        <Frame>
          <EngineEnd view={view} voiceConsent={voiceConsent} send={async () => true} say={noop} onViewReport={noop} onLookAtBoard={noop} />
        </Frame>
      </MoneyProvider>
    </ApiContext.Provider>
  );
}

/** The end of a real run of the good policy: Platinum, the engine's moments, badges and questions. */
export const FromRunGood: StoryObj = { render: () => <FromRun policy="good" /> };
/** The end of a passive run: Bronze, behind on conversions. */
export const FromRunPassive: StoryObj = { render: () => <FromRun policy="passive" /> };
/** A random run without voice consent: the mic says voice is off. */
export const FromRunNoVoice: StoryObj = { render: () => <FromRun policy="random" voiceConsent={false} /> };

/** The temporary report slot, until the report lands (`src/components/report/`). */
export const ReportSlotWeb: StoryObj = { render: () => <Frame><ReportSlot view={{} as EngineView} print={false} onBack={noop} /></Frame> };
/** The slot in its print view (Download PDF). */
export const ReportSlotPrint: StoryObj = { render: () => <Frame><ReportSlot view={{} as EngineView} print onBack={noop} /></Frame> };
