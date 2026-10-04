import { useState } from 'react';
import type { ScreenProps } from '../app/types';
import type { StyleKey } from '../data/types';
import { StyleSettingView, type StyleSettingLayout, type StyleSettingTooltip, type StyleSettingViewMode } from '../components/stylesetting/StyleSettingView';
import type { StyleSettingMember } from '../components/stylesetting/types';

/** Port of `project/ilStyle.dc.html`, rendered by the style setting components from the design fixtures. */
export interface StyleSettingProps extends ScreenProps {
  /** Initial view: `list`, `summary` or `tooltip` (Kent's Partnering tooltip open). Anything else shows cards. */
  view?: string;
}

/** The design's run length ("Week 2 of 8"). */
const PERIODS = 8;
const SPONSOR_LINE = 'To each their own. Your people need different things from you this week.';
const PRONOUN: Record<string, StyleSettingMember['pronoun']> = { him: 'he', her: 'she' };

interface State {
  layout: StyleSettingLayout;
  summary: boolean;
  tip: StyleSettingTooltip | null;
  notes: Record<string, string>;
}

/** Mirrors the logic class's state plus what componentDidMount derives from `view`. */
function initialState(view: string | undefined): State {
  return {
    layout: view === 'list' ? 'list' : 'cards',
    summary: view === 'summary',
    tip: view === 'tooltip' ? { id: 'kent', style: 'P' } : null,
    notes: { kent: 'Kent is experienced but hurt. Less telling, more listening.' }
  };
}

export function StyleSetting({ d: D, app, act, view }: StyleSettingProps) {
  const [s, setS] = useState<State>(() => initialState(view));

  const members: StyleSettingMember[] = app.members.map(m => ({
    id: m.id,
    name: m.name,
    title: D.stages[m.stage].n,
    img: m.img,
    mood: m.mood,
    away: m.away === true,
    awayReason: 'training',
    pronoun: PRONOUN[m.pron] ?? 'they',
    stats: { skill: m.skill, morale: m.morale, trust: m.trust },
    lastStyle: m.last,
    lastReaction: m.lastReact,
    style: m.style,
    rationale: s.notes[m.id] ?? ''
  }));

  const onViewChange = (v: StyleSettingViewMode) => setS(x => (v === 'summary' ? { ...x, summary: true } : { ...x, layout: v }));
  const confirm = () => {
    act.go('board');
    act.say('Priya: “Good. Let us see how the team takes it.” Styles are set for the week.');
  };

  return (
    <StyleSettingView
      periodUnit="week"
      period={app.week}
      periodCount={PERIODS}
      sponsorName={D.sponsor.name}
      sponsorLine={SPONSOR_LINE}
      view={s.summary ? 'summary' : s.layout}
      summaryOver={s.layout}
      onViewChange={onViewChange}
      members={members}
      onStyle={(id: string, k: StyleKey) => act.setStyle(id, k)}
      onRationale={(id, text) => setS(x => ({ ...x, notes: { ...x.notes, [id]: text } }))}
      onConfirm={confirm}
      onBack={() => setS(x => ({ ...x, summary: false }))}
      tooltip={s.tip}
      onTooltipChange={tip => setS(x => ({ ...x, tip }))}
      minHeight={app.minH}
    />
  );
}
