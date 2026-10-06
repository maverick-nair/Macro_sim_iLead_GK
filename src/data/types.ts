/**
 * Scenario configuration for iLead. In production this comes from GenieKreator
 * config through the API layer (see `src/api`). Field names match the design
 * prototype's `ilead-data.js` so screens port one to one.
 */
/** A leadership style key of the storyline's lens (D70), for example "D". */
export type StyleKey = string;
export type MoodKey = 'happy' | 'neutral' | 'thinking' | 'concerned' | 'frustrated';
export type MetricKey = 'skill' | 'morale' | 'result' | 'trust';
export type ActionKind = 'live' | 'static' | 'hybrid';
export type LiveVariant = 'roleplay' | 'email' | 'meeting' | 'sponsor';
export type EventType = 'impact' | 'signal' | 'capacity' | 'diagnostic';

export interface Stage { k: string; n: string; count: number; ideal: number }
export interface StyleDef { k: StyleKey; n: string; d: string }
export interface Mood { n: string; c: string }
export interface Sponsor { name: string; title: string; initials: string }

export interface Member {
  id: string;
  name: string;
  pron: string;
  stage: number;
  title: string;
  skill: number;
  morale: number;
  result: number;
  trust: number;
  style: StyleKey;
  last: StyleKey;
  lastReact: 'pos' | 'neg';
  mood: MoodKey;
  unread?: boolean;
  tags?: string[];
  away?: boolean;
  promise?: string;
  rewarded?: boolean;
  prev: string;
  tenure: string;
  exp: string;
  skills: string;
  remarks: string;
  relations: string;
  shared?: string;
  goal?: string;
}

export interface ActionOption { n: string; d: string }

export interface TeamAction {
  k: string;
  n: string;
  c: number;
  kind: ActionKind;
  format?: string;
  desc: string;
  options?: ActionOption[];
  limit?: string;
  select?: [number, number];
  prereq?: boolean;
  lock?: string;
}

export interface MemberAction {
  k: string;
  n: string;
  c: number;
  kind: ActionKind;
  format?: string;
  dur?: string;
  cooldown?: string;
}

export interface InboxItem {
  id: string;
  type: 'chat' | 'sponsor' | 'news' | 'email';
  from: string;
  title: string;
  preview: string;
  meta: string;
  due?: string;
  urgent?: boolean;
}

export interface GameEvent { tag: string; title: string; body: string; impact: string[]; cta: string }

export interface MetricMove { id: string; k: MetricKey; d: number }

export interface Outcome {
  who: string;
  headline: string;
  reply: string;
  affected: string[];
  reactions: Record<string, string>;
  moves: MetricMove[];
  ripple: string;
  changed: string[];
  why: { cause: string; rule: string; ev: string; evBy: string };
}

export interface Badge { n: string; d: string; on: boolean; isNew?: boolean }

export interface Scenario {
  stages: Stage[];
  styles: StyleDef[];
  moods: Record<MoodKey, Mood>;
  sponsor: Sponsor;
  members: Member[];
  teamActions: TeamAction[];
  memberActions: MemberAction[];
  inbox: InboxItem[];
  events: Record<EventType, GameEvent>;
  outcome: Outcome;
  badges: Badge[];
}
