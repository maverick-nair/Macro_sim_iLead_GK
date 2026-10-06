import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { SIX_STYLES_VIEW } from '../../engine/storylines/sixStyles';
import { LensProvider } from '../style/lens';
import { LastPeriodTag } from './LastPeriodTag';
import { StyleSettingCard } from './StyleSettingCard';
import { StyleSettingView, type StyleSettingLayout, type StyleSettingTooltip, type StyleSettingViewMode, type StyleSettingViewProps } from './StyleSettingView';
import type { StyleSettingMember } from './types';

const meta: Meta = { title: 'Components/Style setting' };
export default meta;

const noop = () => {};
const person = (id: string, name: string, title: string, p: Partial<StyleSettingMember>): StyleSettingMember => ({
  id, name, title, img: `/assets/npc/${id}.png`, mood: 'neutral', away: false, pronoun: 'he',
  stats: { skill: 50, morale: 50, trust: 50 }, lastStyle: 'G', lastReaction: 'pos', style: 'G', rationale: '', ...p
});

/** The design's team, week 2 (frames s1 to s3). */
const TEAM: StyleSettingMember[] = [
  person('kent', 'Kent Goldberg', 'Lead generation', { mood: 'frustrated', stats: { skill: 35, morale: 9, trust: 30 }, lastStyle: 'D', lastReaction: 'neg', style: 'D', rationale: 'Kent is experienced but hurt. Less telling, more listening.' }),
  person('beth', 'Beth Killiney', 'Lead generation', { mood: 'happy', pronoun: 'she', stats: { skill: 25, morale: 57, trust: 48 }, lastStyle: 'D', style: 'D' }),
  person('mandy', 'Mandy Lobert', 'Qualification', { pronoun: 'she', stats: { skill: 50, morale: 61, trust: 55 } }),
  person('peter', 'Peter Higgins', 'Qualification', { mood: 'concerned', away: true, awayReason: 'training', stats: { skill: 19, morale: 20, trust: 24 }, lastStyle: 'D', lastReaction: 'neg', style: 'D' }),
  person('green', 'Green Bell', 'Solution demo', { mood: 'happy', stats: { skill: 89, morale: 63, trust: 70 }, lastStyle: 'P', style: 'P' }),
  person('lowe', 'Lowe Rex', 'Solution demo', { mood: 'concerned', stats: { skill: 80, morale: 45, trust: 52 }, lastStyle: 'P', lastReaction: 'neg', style: 'P' }),
  person('ruth', 'Ruth Ether', 'Proposal', { mood: 'thinking', pronoun: 'she', stats: { skill: 80, morale: 59, trust: 64 }, lastStyle: 'E', style: 'P' }),
  person('justin', 'Justin Keel', 'Proposal', { mood: 'happy', stats: { skill: 26, morale: 84, trust: 60 }, lastStyle: 'E', style: 'E' }),
  person('jack', 'Jack Holt', 'Closing', { mood: 'happy', stats: { skill: 92, morale: 83, trust: 82 }, lastStyle: 'E', style: 'E' }),
  person('derick', 'Derick Kaynes', 'Closing', { mood: 'happy', stats: { skill: 70, morale: 85, trust: 77 }, lastStyle: 'P', style: 'E' })
];

const base: StyleSettingViewProps = {
  periodUnit: 'week', period: 2, periodCount: 8,
  sponsorName: 'Priya Nair', sponsorLine: 'To each their own. Your people need different things from you this week.',
  view: 'cards', onViewChange: noop, members: TEAM,
  onStyle: noop, onRationale: noop, onConfirm: noop, onBack: noop
};

/** The screen at 1440, positioned so the summary dialog covers it as in the app. */
const Screen = ({ children, width = 1440 }: { children: ReactNode; width?: number }) => (
  <div style={{ position: 'relative', width, minHeight: 900, display: 'flex', flexDirection: 'column' }}>{children}</div>
);
const Static = (p: Partial<StyleSettingViewProps>) => <Screen><StyleSettingView {...base} {...p} /></Screen>;

/** Everything works: pick styles, switch views (arrow keys in the toggle), add reasons, review, go back, confirm. */
function Live(p: Partial<StyleSettingViewProps>) {
  const [members, setMembers] = useState(p.members ?? TEAM);
  const [layout, setLayout] = useState<StyleSettingLayout>('cards');
  const [summary, setSummary] = useState(false);
  const [tip, setTip] = useState<StyleSettingTooltip | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const patch = (id: string, x: Partial<StyleSettingMember>) => setMembers(ms => ms.map(m => (m.id === id ? { ...m, ...x } : m)));
  return (
    <Screen>
      <StyleSettingView {...base} {...p} members={members}
        view={summary ? 'summary' : layout} summaryOver={layout}
        onViewChange={(v: StyleSettingViewMode) => (v === 'summary' ? setSummary(true) : setLayout(v))}
        onStyle={(id, style: StyleKey) => patch(id, { style })} onRationale={(id, rationale) => patch(id, { rationale })}
        onBack={() => setSummary(false)} onConfirm={() => { setSummary(false); setConfirmed(true); }}
        tooltip={tip} onTooltipChange={setTip} />
      {confirmed && <output style={{ position: 'absolute', bottom: 16, left: 32 }}>Confirmed</output>}
    </Screen>
  );
}

/** Frame s1: the card view with definitions on top, last week tags and Kent's reason. */
export const Cards: StoryObj = { render: () => <Static /> };

/** Frame s1 with Kent's Partnering tooltip open. */
export const CardsTooltip: StoryObj = { render: () => <Static tooltip={{ id: 'kent', style: 'P' }} /> };

/** Frame s2: the list view. Tab reaches each member's radio group once; arrow keys move and pick. */
export const List: StoryObj = { render: () => <Static view="list" /> };

/** Frame s3: summary and confirm over the cards. Escape goes back. */
export const Summary: StoryObj = { render: () => <Static view="summary" /> };

/** The summary opened from the list view. */
export const SummaryOverList: StoryObj = { render: () => <Static view="summary" summaryOver="list" /> };

const NONE = TEAM.map(m => ({ ...m, style: null, rationale: '' }));

/** Start of the period: no style chosen. The header counts what is set; Confirm stays disabled. */
export const NothingChosenYet: StoryObj = { render: () => <Static members={NONE} /> };
export const NothingChosenYetList: StoryObj = { render: () => <Static members={NONE} view="list" /> };
export const NothingChosenYetSummary: StoryObj = { render: () => <Static members={NONE} view="summary" /> };

/** Some chosen: "6 of 10 styles set". */
export const SomeChosen: StoryObj = { render: () => <Static members={TEAM.map((m, i) => (i % 3 === 0 ? { ...m, style: null } : m))} /> };

/** Every style set and a reason for each; the count hides, Confirm is enabled. */
export const AllChosen: StoryObj = {
  render: () => <Static view="summary" members={TEAM.map(m => ({ ...m, rationale: `${m.name.split(' ')[0]} needs a steady hand this week.` }))} />
};

const HIDDEN = TEAM.map((m, i) => (i % 2 ? { ...m, statsHidden: true } : i === 4 ? { ...m, stats: null } : m));

/** Profiles not opened yet: the engine hides those members' stats. */
export const SomeStatsHidden: StoryObj = { render: () => <Static members={HIDDEN} /> };
export const SomeStatsHiddenList: StoryObj = { render: () => <Static members={HIDDEN} view="list" /> };

const AWAY = TEAM.map(m => (m.id === 'beth' ? { ...m, away: true, awayReason: 'leave' as const } : m));

/** Peter is in training and Beth on leave: both still settable; the note and summary say when it applies. */
export const AwayMembers: StoryObj = { render: () => <Static members={AWAY} /> };
export const AwayMembersSummary: StoryObj = { render: () => <Static members={AWAY} view="summary" /> };

const LONG = TEAM.map(m => (m.id === 'green' ? { ...m, name: 'Green Bartholomew Montgomery Bell', title: 'Technical solution demonstration' } : m));

/** A long name and stage wrap on the card and in the list. */
export const LongName: StoryObj = { render: () => <Static members={LONG} /> };
export const LongNameList: StoryObj = { render: () => <Static members={LONG} view="list" /> };

const TWELVE = [...TEAM,
  person('kent2', 'Ana Ferreira', 'Closing', { img: '/assets/npc/placeholder.svg', pronoun: 'she', lastStyle: null, lastReaction: null, style: null }),
  person('kent3', 'Rohan Mehta', 'Lead generation', { img: '/assets/npc/placeholder.svg', lastStyle: 'G', lastReaction: null, style: 'G' })];

/** Twelve people: the cards wrap to a third row; two new hires have no last week reaction. */
export const TwelveMembers: StoryObj = { render: () => <Static members={TWELVE} /> };
export const TwelveMembersList: StoryObj = { render: () => <Static members={TWELVE} view="list" /> };

const MONTH: Partial<StyleSettingViewProps> = { periodUnit: 'month', period: 3, periodCount: 6, sponsorLine: 'Each of them needs something different from you this month.' };

/** A month based storyline: "Month 3 of 6", "Last month", "Your styles for month 3". */
export const MonthStoryline: StoryObj = { render: () => <Static {...MONTH} /> };
export const MonthStorylineList: StoryObj = { render: () => <Static {...MONTH} view="list" /> };
export const MonthStorylineSummary: StoryObj = { render: () => <Static {...MONTH} view="summary" /> };

/** Everything works, starting with nothing chosen. */
export const Interactive: StoryObj = { render: () => <Live members={NONE} /> };
/** Everything works, from the design's week 2 choices. */
export const InteractiveWeek2: StoryObj = { render: () => <Live /> };

/** The voice note seam: a node beside each reason field. */
export const RationaleAddon: StoryObj = {
  render: () => <Static rationaleAddon={id => <span style={{ fontSize: 12, opacity: 0.6 }}>Voice note slot for {id}</span>} />
};

/** The pieces on their own. */
export const LastPeriodTags: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <LastPeriodTag periodUnit="week" style="P" reaction="pos" />
      <LastPeriodTag periodUnit="week" style="D" reaction="neg" />
      <LastPeriodTag periodUnit="month" style="E" reaction="pos" />
      <LastPeriodTag periodUnit="week" style="G" reaction={null} />
      <LastPeriodTag periodUnit="week" style={null} reaction={null} />
    </div>
  )
};

function OneCard({ member }: { member: StyleSettingMember }) {
  const [m, setM] = useState(member);
  return (
    <div style={{ width: 262, paddingTop: 90 }}>
      <StyleSettingCard member={m} periodUnit="week" onStyle={style => setM(x => ({ ...x, style }))} onRationale={rationale => setM(x => ({ ...x, rationale }))} />
    </div>
  );
}
export const Card: StoryObj = { render: () => <OneCard member={TEAM[0]} /> };
export const CardUnset: StoryObj = { render: () => <OneCard member={{ ...TEAM[2], style: null }} /> };

/** Tablet size, 834 wide (an iPad held upright, D69): the 1440 layout, its cards wrapping. */
export const Tablet: StoryObj = { render: () => <Screen width={834}><StyleSettingView {...base} /></Screen> };
export const TabletSummary: StoryObj = { render: () => <Screen width={834}><StyleSettingView {...base} view="summary" /></Screen> };

/** The design's team on the Six Leadership Styles lens (D70): week 2 choices mapped to six styles. */
const SIX_KEYS: Record<string, string> = { D: 'command', G: 'coach', P: 'collab', E: 'vision' };
const SIX_TEAM = TEAM.map((m, i) => ({ ...m, style: i === 3 ? 'harmony' : i === 8 ? 'pace' : m.style && SIX_KEYS[m.style], lastStyle: m.lastStyle && SIX_KEYS[m.lastStyle] }));
const Six = ({ children }: { children: ReactNode }) => <LensProvider lens={SIX_STYLES_VIEW}>{children}</LensProvider>;

/** Six styles at 1440: six definitions in one row under the sponsor's prompt, six letters on every card. */
export const SixStyles: StoryObj = { render: () => <Six><Static members={SIX_TEAM} /></Six> };
/** Six styles at 1024: the definitions in rows of three, the letters shrink to fit the card. */
export const SixStyles1024: StoryObj = { render: () => <Six><Screen width={1024}><StyleSettingView {...base} members={SIX_TEAM} /></Screen></Six> };
/** Six styles in the list view: one narrower radio column per style. */
export const SixStylesList: StoryObj = { render: () => <Six><Static members={SIX_TEAM} view="list" /></Six> };
export const SixStylesSummary: StoryObj = { render: () => <Six><Static members={SIX_TEAM} view="summary" /></Six> };
/** Everything works with six styles. */
export const SixStylesInteractive: StoryObj = { render: () => <Six><Live members={SIX_TEAM} /></Six> };
