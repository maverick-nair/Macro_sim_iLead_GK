import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import type { ScreenProps, MemberView } from '../app/types';
import type { EventType, MemberAction, MetricKey, StyleKey, TeamAction } from '../data/types';
import { css, pseudo } from '../lib/css';
import { Button, NoWrapButton } from '../ds/Button';
import { useMergeState } from './board/useMergeState';
import { MemberCard, type MemberCardProps } from '../components/member/MemberCard';
import { KpiTile, type KpiTrend } from '../components/metric/KpiTile';
import { ReasonChip } from '../components/reason/ReasonChip';
import { ReasonDetail } from '../components/reason/ReasonDetail';

/**
 * Main board: HUD, metrics strip, team board with stage columns, inbox rail,
 * actions panel, profile, action drawer, events, outcome panel, legend, Cmd K
 * palette, sponsor call, mobile outcome. Port of `project/ilBoard.dc.html`.
 */
export interface BoardProps extends ScreenProps {
  uiState?: string;
  eventType?: string;
  mobile?: boolean;
}

/** Team and member actions share one shape in the design logic. */
type AnyAction = Omit<TeamAction, 'desc'> & Pick<MemberAction, 'dur' | 'cooldown'> & { desc?: string };

interface Flow {
  a: AnyAction;
  opt: number | null;
  picks: string[];
  member?: boolean;
}

interface BoardState {
  sel: string | null;
  tip: string | null;
  legend: boolean;
  inbox: boolean;
  profile: string | null;
  flow: Flow | null;
  nudgeOk: boolean;
  whyOpen: boolean;
  nums: boolean;
  reveal: string | null;
  event: string | null;
  call: boolean;
  sponsor: boolean;
  scoreTip: boolean;
  pal: boolean;
  q: string;
  done: string[];
  fresh: boolean;
  readIds: string[];
  /** Set by the ResizeObserver (root narrower than 1400px). Not read by the template. */
  narrow?: boolean;
}

interface Tile {
  n: string;
  sub: string | undefined;
  why: string | undefined;
  cost: string;
  disabled: boolean;
  isLive: boolean;
  isStatic: boolean;
  isLock: boolean;
  iconBg: string;
  iconC: string;
  color: string;
  cursor: string;
  pick: () => void;
}

const METRICS: MetricKey[] = ['skill', 'morale', 'result', 'trust'];

function fmt(d: number): string {
  if (d === 0) return 'No days';
  const w = Math.floor(d), h = d % 1 ? '½' : '';
  if (!w) return '½ day';
  return w + h + (d === 1 ? ' day' : ' days');
}
const first = (n: string) => n.split(' ')[0];
const cap1 = (k: string) => k[0].toUpperCase() + k.slice(1);
function backdrop(m: MemberView): string {
  return m.away ? 'linear-gradient(160deg,#E4E6F0,#C9CEDF)' : (m.mood === 'frustrated' || m.mood === 'concerned') ? 'linear-gradient(160deg,#FFE7C2,#F7C17E)' : 'linear-gradient(160deg,#DEE9FF,#9FDCEB)';
}
function kindLabel(a: AnyAction): string {
  return a.kind === 'live' ? 'Live conversation' : a.kind === 'hybrid' ? 'Decision, then a conversation' : 'Instant decision';
}
function summary(f: Flow, names: string[]): string {
  const a = f.a, list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : (names[0] || '');
  const opt = a.options && f.opt !== null ? a.options[f.opt].n : '';
  if (a.k === 'training') return `Send ${list || 'up to 3 people'} to a ${opt.toLowerCase()}. ${fmt(a.c)}.`;
  if (a.k === 'energize') return `${opt} with the whole team. ${fmt(a.c)}.`;
  if (a.k === 'swap') return names.length === 2 ? `Swap ${names[0]} and ${names[1]}, then explain it to them. ${fmt(a.c)}.` : `Pick two people in different stages. ${fmt(a.c)}.`;
  if (a.k === 'meet') return `Meet the whole team for about 20 minutes. ${fmt(a.c)}.`;
  if (a.k === 'email') return 'Opens the email composer. No days used.';
  if (a.kind === 'live') return `${a.n} with ${list}. ${fmt(a.c)}. ${a.dur}, in voice or text.`;
  if (a.k === 'reward') return `Reward ${list}, then tell them why. ${fmt(a.c)}.`;
  return `${a.n}: ${list}. ${fmt(a.c)}.`;
}

function initialState(props: BoardProps): BoardState {
  const u = props.uiState, D = props.d;
  const st: BoardState = { sel: null, tip: null, legend: false, inbox: false, profile: null, flow: null, nudgeOk: false, whyOpen: false, nums: false, reveal: null, event: null, call: false, sponsor: false, scoreTip: false, pal: false, q: '', done: [], fresh: true, readIds: [] };
  if (u === 'inbox' || u === 'empty') st.inbox = true;
  if (u === 'empty') st.readIds = D.inbox.map(i => i.id);
  if (u === 'profile') { st.profile = 'kent'; st.sel = 'kent'; }
  if (u === 'select') st.sel = 'kent';
  if (u === 'tooltip') { st.sel = 'kent'; st.tip = 'kent:G'; }
  if (u === 'legend') st.legend = true;
  if (u === 'drawer') st.flow = { a: D.teamActions[3], opt: 1, picks: ['mandy', 'justin', 'beth'] };
  if (u === 'nudge') st.flow = { a: D.teamActions[4], opt: null, picks: ['justin', 'beth'] };
  if (u === 'live') { st.sel = 'kent'; st.flow = { a: D.memberActions[0], opt: null, picks: ['kent'] }; }
  if (u === 'call') st.call = true;
  if (u === 'why') st.whyOpen = true;
  if (props.eventType) st.event = props.eventType;
  return st;
}

const EV_ART: Record<EventType, string> = { impact: 'linear-gradient(135deg,#43D6E8,#00F2AD)', signal: 'linear-gradient(135deg,#DEE9FF,#9FDCEB)', capacity: 'linear-gradient(135deg,#FFE7C2,#F7C17E)', diagnostic: 'linear-gradient(135deg,#249DFF,#43D6E8)' };
const EV_IMG: Partial<Record<EventType, string>> = { signal: 'lowe', capacity: 'ruth', diagnostic: 'peter' };

const MicIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path></svg>;
const BoltIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>;
const LockIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="16" height="10" x="4" y="11" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>;

/** Action tile in the Actions panel (team and individual lists share this markup). */
function ActionTile({ a }: { a: Tile }) {
  return (
    <button onClick={a.pick} disabled={a.disabled} title={a.why} style={css(`display:grid; grid-template-columns:30px minmax(0,1fr) auto; gap:10px; align-items:center; padding:9px 10px; border-radius:14px; border:1px solid var(--ik-line); background:var(--ik-raised); color:${a.color}; cursor:${a.cursor}; text-align:left`)} className={pseudo('hover', 'border-color:var(--ik-line-strong)')}>
      <span style={css(`width:30px; height:30px; border-radius:10px; background:${a.iconBg}; color:${a.iconC}; display:flex; align-items:center; justify-content:center`)}>
        {a.isLive && <MicIcon />}
        {a.isStatic && <BoltIcon />}
        {a.isLock && <LockIcon />}
      </span>
      <span style={css('display:flex; flex-direction:column; min-width:0')}><b style={css('font-size:13px')}>{a.n}</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>{a.sub}</span></span>
      <span style={css('font-size:12px; font-weight:700; color:var(--ik-text-2)')}>{a.cost}</span>
    </button>
  );
}

export function Board(props: BoardProps) {
  const { d: D, app, act } = props;
  const [s, setState] = useMergeState<BoardState>(() => initialState(props));
  const rootRef = useRef<HTMLDivElement>(null);
  const palRef = useRef<HTMLInputElement>(null);
  const hot = useRef(false);

  // componentDidMount / componentWillUnmount
  useEffect(() => {
    const ft = setTimeout(() => setState({ fresh: false }), 3000);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!hot.current) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setState({ pal: true, q: '' }); }
      if (e.key === 'Escape') setState({ pal: false, legend: false, inbox: false, profile: null, flow: null, tip: null });
    };
    window.addEventListener('keydown', onKey);
    let ro: ResizeObserver | undefined;
    if (window.ResizeObserver && rootRef.current) {
      ro = new ResizeObserver(es => { const n = es[0].contentRect.width < 1400; setState(x => (n !== x.narrow ? { narrow: n } : null)); });
      ro.observe(rootRef.current);
    }
    return () => { ro?.disconnect(); clearTimeout(ft); window.removeEventListener('keydown', onKey); };
  }, [setState]);

  // componentDidUpdate: focus the palette input when it opens
  useEffect(() => { if (s.pal && palRef.current) palRef.current.focus(); }, [s.pal]);

  if (!D || !app.members) return null;

  const memberById = (list: MemberView[], id: string) => list.find(x => x.id === id) as MemberView;

  const tileFor = (a: AnyAction, m: MemberView | null): Tile => {
    const done = s.done.includes(a.k + ':' + (m ? m.id : 'team'));
    let sub: string | undefined = a.kind === 'live' ? 'Live' + (a.dur ? ', ' + a.dur.toLowerCase() : '') : a.kind === 'hybrid' ? 'Decision, then live' : 'Instant';
    let why: string | undefined = '', dis = false;
    if (a.lock) { dis = true; why = a.lock; sub = a.lock; }
    else if (done) { dis = true; sub = 'Planned today'; }
    else if (m && m.away && a.k !== 'feedback') { dis = true; sub = 'Away in training until Day 4'; why = sub; }
    else if (m && a.k === 'reward' && m.rewarded) { dis = true; sub = a.cooldown; why = a.cooldown; }
    else if (a.c > app.capacity) { dis = true; sub = `Needs ${fmt(a.c)}, you have ${fmt(app.capacity)}`; why = sub; }
    const live = a.kind !== 'static';
    return { n: a.n, sub, why, cost: fmt(a.c), disabled: dis, isLive: live && !a.lock, isStatic: !live && !a.lock, isLock: !!a.lock,
      iconBg: dis ? 'var(--ik-track)' : live ? 'var(--grad-brand)' : 'linear-gradient(135deg,#43D6E8,#00F2AD)', iconC: dis ? 'var(--ik-text-2)' : '#0A081B',
      color: dis ? 'var(--ik-text-2)' : 'var(--ik-text)', cursor: dis ? 'default' : 'pointer',
      pick: () => { if (dis) return; setState({ profile: null, flow: { a, opt: a.options ? 0 : null, picks: m ? [m.id] : [], member: !!m }, nudgeOk: false }); } };
  };

  const eligible = (m: MemberView): { ok: boolean; why?: string } => {
    const f = s.flow; if (!f || !f.a.select || f.member) return { ok: true };
    if (m.away) return { ok: false, why: 'Away in training until Day 4' };
    if (f.a.k === 'swap' && f.picks.length === 1 && f.picks[0] !== m.id) { const p = memberById(app.members, f.picks[0]); if (p.stage === m.stage) return { ok: false, why: `Same stage as ${first(p.name)}` }; }
    return { ok: true };
  };

  const clickCard = (m: MemberView) => {
    const f = s.flow;
    if (f && f.a.select && !f.member) {
      if (!eligible(m).ok) return;
      const has = f.picks.includes(m.id), max = f.a.select[1];
      let picks = has ? f.picks.filter(x => x !== m.id) : [...f.picks, m.id];
      if (picks.length > max) picks = picks.slice(picks.length - max);
      setState({ flow: { ...f, picks }, nudgeOk: false });
      return;
    }
    setState(x => ({ sel: x.sel === m.id ? null : m.id, flow: null }));
  };

  const confirmFlow = () => {
    const f = s.flow; if (!f) return;
    const a = f.a, names = f.picks.map(id => first(memberById(app.members, id).name));
    if (a.kind === 'live' || a.kind === 'hybrid') { act.spend(a.c); act.live(a.format === 'meeting' ? 'meeting' : a.format === 'email' ? 'email' : 'roleplay', f.picks[0] || 'kent'); return; }
    act.spend(a.c);
    setState(x => ({ flow: null, done: [...x.done, a.k + ':' + (f.member ? f.picks[0] : 'team')] }));
    act.say(`${summary(f, names)} You'll see how it lands at day end.`);
  };

  // ---- renderVals ----
  const mobile = !!props.mobile, outcome = !!app.outcome, cap = app.capacity;
  const members: MemberView[] = app.members.map(m => (outcome && m.id === 'kent' ? { ...m, mood: 'neutral', unread: false } : m));
  const f = s.flow, picking = !!(f && f.a.select && !f.member);

  /** Props for MemberCard. The tooltip key stays `memberId:style` so the gallery can open one. */
  const card = (m: MemberView): MemberCardProps & { id: string } => {
    const el = eligible(m), tipOwn = s.tip && s.tip.startsWith(m.id + ':') ? (s.tip.slice(m.id.length + 1) as StyleKey) : null;
    return { id: m.id, name: m.name, title: m.title, img: m.img, mood: m.mood, away: !!m.away,
      skill: m.skill, morale: m.morale, result: m.result, trust: m.trust, style: m.style, tags: m.tags, unread: !!m.unread, promise: m.promise,
      selected: picking && f ? f.picks.includes(m.id) : s.sel === m.id,
      unavailableReason: picking && !el.ok ? el.why : undefined,
      onSelect: () => clickCard(m),
      onOpenProfile: () => { act.openProfile(m.id); setState({ profile: m.id, sel: m.id, flow: null }); },
      onStyleChange: k => { act.setStyle(m.id, k); act.say(`You'll lead ${first(m.name)} with ${D.styles.find(x => x.k === k)?.n ?? k} this week.`); },
      styleTooltip: tipOwn,
      onStyleTooltipChange: k => setState(x => (k ? { tip: m.id + ':' + k } : x.tip && x.tip.startsWith(m.id + ':') ? { tip: null } : null)) };
  };

  const worst = D.stages.reduce((b, st, i) => (st.count / st.ideal < D.stages[b].count / D.stages[b].ideal ? i : b), 0);
  const columns = D.stages.map((st, i) => ({ n: st.n, count: st.count, sub: i === worst ? 'Bottleneck this week' : `Ideal ${st.ideal}`,
    hBg: i === worst ? 'var(--ik-warn-soft)' : 'var(--ik-card)', hBorder: i === worst ? 'var(--ik-warn)' : 'var(--ik-line)', subC: i === worst ? 'var(--ik-warn)' : 'var(--ik-text-2)', subW: i === worst ? '700' : '400',
    cards: members.filter(m => m.stage === i).map(card) }));
  const avg = (k: MetricKey) => Math.round(members.reduce((a, m) => a + m[k], 0) / members.length);
  const kd: Record<MetricKey, number> = outcome ? { skill: 0, morale: 0.6, result: 0, trust: 0.6 } : { skill: 0.3, morale: 0, result: 0.6, trust: -0.3 };
  // TODO(M2): the engine supplies KPI values and trends; these are the prototype's fixed numbers.
  const kpis = METRICS.map(k => { const dd = kd[k];
    const trend: KpiTrend = s.fresh && dd ? { kind: 'delta', delta: dd } : { kind: 'direction', direction: dd > 0 ? 'up' : dd < 0 ? 'down' : 'flat' };
    return { metric: k, value: avg(k), trend }; });
  const pos = members.filter(m => m.mood === 'happy').length, neu = members.filter(m => m.mood === 'neutral' || m.mood === 'thinking').length, neg = members.length - pos - neu;
  const pulse = [{ n: pos, label: 'upbeat', c: '#00F2AD' }, { n: neu, label: 'steady', c: '#DEE9FF' }, { n: neg, label: 'struggling', c: 'oklch(0.84 0.14 78)' }].filter(x => x.n);
  const sm = members.find(m => m.id === s.sel);

  let fl: {
    n: string; kind: string; cost: string; desc: string; hasOpts: boolean;
    opts: { n: string; d: string; on: boolean; border: string; bg: string; dot: string; pick: () => void }[];
    whoTitle: string; picking: boolean; limit: string; picks: { n: string; img: string }[];
    nudge: boolean; nudgeText: string; summary: string; invalid: boolean; cta: string;
  } | null = null;
  if (f) {
    const names = f.picks.map(id => first(memberById(members, id).name));
    const needNudge = f.a.prereq && f.picks.includes('justin') && !s.nudgeOk;
    const min = f.a.select ? f.a.select[0] : 0;
    fl = { n: f.a.n, kind: kindLabel(f.a), cost: fmt(f.a.c), desc: f.a.desc || `${f.a.dur || ''}. In voice or text, you can switch at any time.`,
      hasOpts: !!f.a.options, opts: (f.a.options || []).map((o, i) => ({ n: o.n, d: o.d, on: f.opt === i, border: f.opt === i ? 'var(--ik-acc-2)' : 'var(--ik-line)', bg: f.opt === i ? 'var(--ik-acc-soft)' : 'var(--ik-raised)', dot: f.opt === i ? 'var(--ik-acc-2)' : 'transparent', pick: () => setState({ flow: { ...f, opt: i } }) })),
      whoTitle: f.a.select && !f.member ? `People · ${f.picks.length} of ${f.a.select[1]}` : f.member ? 'With' : 'Who', picking, limit: f.a.limit || '',
      picks: f.picks.map(id => { const m = memberById(members, id); return { n: m.name, img: m.img }; }),
      nudge: !!needNudge, nudgeText: 'You have not assessed Justin for Qualification yet. Assess first, 1 day? You can still go ahead without it.',
      summary: summary(f, names), invalid: f.picks.length < min || !!(f.a.options && f.opt === null),
      cta: f.a.kind === 'static' ? 'Confirm' : f.a.k === 'email' ? 'Open composer' : 'Confirm and start' };
  }

  const pm = members.find(m => m.id === s.profile);
  let pf: {
    name: string; title: string; img: string; backdrop: string; moodN: string; aria: string;
    stats: { n: string; v: number; c: string }[]; hasShared: boolean; shared: string; facts: { k: string; v: string }[];
    timeline: { when: string; t: string; quote: string; delta: string; dc: string; dot: string; hasQuote: boolean }[];
    hasPromise: boolean; promise: string; actions: Tile[];
  } | null = null;
  if (pm) {
    const mood = D.moods[pm.mood];
    const kent = pm.id === 'kent';
    const styleName = (k: StyleKey) => D.styles.find(x => x.k === k)?.n ?? '';
    pf = { name: pm.name, title: pm.title, img: pm.img, backdrop: backdrop(pm), moodN: mood.n, aria: `Profile for ${pm.name}`,
      stats: METRICS.map(k => ({ n: cap1(k), v: pm[k], c: pm[k] < 30 ? 'var(--ik-warn)' : 'var(--ik-text)' })),
      hasShared: kent && outcome, shared: 'feels overlooked since the territory split moved his best leads to Beth.',
      facts: [{ k: 'Style this week', v: styleName(pm.style) }, { k: 'Previous company', v: pm.prev }, { k: 'Tenure', v: pm.tenure }, { k: 'Experience', v: pm.exp }, { k: 'Skills', v: pm.skills }, { k: 'Remarks', v: pm.remarks },
        { k: 'Career goal', v: kent && outcome ? 'Wants to mentor new hires' : 'Not shared yet. It may come up in conversation.' }, { k: 'Relationships', v: pm.relations }],
      timeline: (kent ? [
        ...(outcome ? [{ when: 'Week 2, Day 3', t: '1:1 conversation', quote: 'Since the territory split, my best leads go to Beth. Nobody asked me.', delta: 'Morale +8, Trust +6', dc: 'var(--ik-pos)', dot: 'var(--ik-pos)' }] : []),
        { when: 'Week 2, Day 2', t: 'Chat request went unanswered', quote: 'Do you have 15 minutes today? Something has been bothering me.', delta: 'Morale −6', dc: 'var(--ik-neg)', dot: 'var(--ik-neg)' },
        { when: 'Week 1, Day 4', t: 'Style: Directing', quote: '', delta: 'Reaction: felt micromanaged. Morale −4', dc: 'var(--ik-neg)', dot: 'var(--ik-neg)' },
        { when: 'Week 1, Day 1', t: 'Meet the team', quote: 'Happy to be here. Busy week ahead.', delta: 'No change', dc: 'var(--ik-text-2)', dot: 'var(--ik-line-strong)' }
      ] : [{ when: 'Week 1, Day 4', t: 'Style: ' + styleName(pm.last), quote: '', delta: pm.lastReact === 'pos' ? 'Reaction: positive' : 'Reaction: negative', dc: pm.lastReact === 'pos' ? 'var(--ik-pos)' : 'var(--ik-neg)', dot: pm.lastReact === 'pos' ? 'var(--ik-pos)' : 'var(--ik-neg)' },
        { when: 'Week 1, Day 1', t: 'Meet the team', quote: '', delta: 'No change', dc: 'var(--ik-text-2)', dot: 'var(--ik-line-strong)' }]).map(t => ({ ...t, hasQuote: !!t.quote })),
      hasPromise: !!pm.promise || (kent && outcome), promise: kent && outcome ? 'Review lead routing with Kent by Friday' : pm.promise || '',
      actions: D.memberActions.map(a => tileFor(a, pm)) };
  }

  const oc = D.outcome;
  const evKey = s.event as EventType | null;
  const evData = evKey ? D.events[evKey] : null;
  const unreadItems = D.inbox.filter(i => !s.readIds.includes(i.id));
  type Sender = { hasImg: boolean; img: string; label: string; bg: string };
  const sender = (it: (typeof D.inbox)[number]): Sender => (it.from === 'sponsor' ? { hasImg: false, img: '', label: 'PN', bg: 'var(--grad-brand)' } : it.from === 'news' ? { hasImg: false, img: '', label: 'News', bg: 'linear-gradient(135deg,#43D6E8,#00F2AD)' } : { hasImg: true, img: `/assets/npc/${it.from}.png`, label: '', bg: 'linear-gradient(160deg,#DEE9FF,#9FDCEB)' });
  const openItem = (it: (typeof D.inbox)[number]) => { setState(x => ({ inbox: false, readIds: [...x.readIds, it.id] })); if (it.type === 'news') setState({ event: 'impact' }); else if (it.type === 'email') act.live('email', it.from); else if (it.type === 'sponsor') act.live('sponsor'); else act.live('roleplay', it.from); };
  const q = s.q.trim().toLowerCase();
  const palItems = [...members.map(m => ({ n: m.name, sub: m.title, hasImg: true, img: m.img, iconBg: backdrop(m), run: () => setState({ pal: false, sel: m.id, flow: null }) })),
    ...D.teamActions.map(a => ({ n: a.n, sub: fmt(a.c), hasImg: false, img: '', iconBg: 'var(--grad-brand)', run: () => { setState({ pal: false }); tileFor(a, null).pick(); } }))]
    .filter(i => !q || i.n.toLowerCase().includes(q)).slice(0, 9).map((i, x) => ({ ...i, bg: x === 0 && q ? 'var(--ik-raised)' : 'transparent' }));

  const isOffline = props.uiState === 'offline';
  // Faithful to the design: in client mode the nav list is plain strings, so the buttons render with no label and no handler.
  const nav: { n?: string; go?: () => void }[] = app.client ? ['Objective', 'History', 'More'].map(() => ({})) : ['Objective', 'Funnel', 'History', 'Badges', 'More'].map(n => ({ n, go: () => act.say(n === 'More' ? 'More: Tutorial, Funnel, Leaderboard, Badges and Help.' : `${n} opens as a panel over the board.`) }));
  const capSlots = [0, 1, 2, 3, 4].map(i => { const v = cap >= i + 1 ? 1 : cap > i ? 0.5 : 0; return { fill: v === 1 ? '#43D6E8' : v ? 'oklch(0.85 0.1 205 / 0.45)' : 'transparent', stroke: v ? '#43D6E8' : 'var(--ik-line-strong)' }; });
  const capText = fmt(cap), capAria = `${cap} of 5 days left this week`, capPulse = cap <= 1 && cap > 0 ? 'ilPulse 1.6s ease-in-out infinite' : 'none', outOfDays = cap === 0;
  const scoreParts = [{ n: 'Business', v: 420, w: '42%' }, { n: 'People', v: 510, w: '51%' }, { n: 'Leadership', v: 310, w: '31%' }];
  const scoreOn = () => setState({ scoreTip: true }), scoreOff = () => setState({ scoreTip: false });
  const sponsorBars = [0, 1, 2, 3, 4].map(i => ({ bg: i < 3 ? 'linear-gradient(90deg,var(--ik-acc),var(--ik-acc-2))' : 'var(--ik-track)' }));
  const whyLabel = s.whyOpen ? 'Hide why' : 'See why';
  const toggleWhy = () => setState(x => ({ whyOpen: !x.whyOpen }));
  const replay = () => act.say('Playing Kent’s reply with captions.');
  const dismissOutcome = () => act.clearOutcome();
  const affected = oc.affected.map(id => { const m = memberById(members, id); return { id, img: m.img, aria: `${m.name}. Show reaction`, ring: s.reveal === id ? 'var(--ik-acc-2)' : 'var(--ik-line-strong)', tap: () => setState(x => ({ reveal: x.reveal === id ? null : id })) }; });
  const reaction = s.reveal ? { name: first(memberById(members, s.reveal).name), t: oc.reactions[s.reveal] } : null;
  const moves = oc.moves.map(mv => ({ name: first(memberById(members, mv.id).name), metric: mv.k, delta: mv.d, showNumbers: s.nums, onToggle: () => setState(x => ({ nums: !x.nums })) }));
  const toggleInbox = () => setState(x => ({ inbox: !x.inbox }));
  const unread = unreadItems.length;
  const inboxRail = unreadItems.map(it => ({ ...sender(it), id: it.id, aria: it.title, ring: it.urgent ? 'oklch(0.84 0.14 78)' : 'var(--ik-line)', open: () => openItem(it) }));
  const inboxItems = unreadItems.map(it => ({ ...sender(it), ...it, tag: it.type === 'chat' ? 'Chat from ' + first(memberById(members, it.from).name) : it.type === 'sponsor' ? 'Priya, sponsor note' : it.type === 'news' ? 'News' : 'Email from ' + first(memberById(members, it.from).name),
    urgent: !!it.urgent, border: it.urgent ? 'var(--ik-warn)' : 'var(--ik-line)', cta: it.type === 'news' ? 'See impact' : 'Reply now', open: () => openItem(it), later: () => setState(x => ({ readIds: [...x.readIds, it.id] })) }));
  const boardHint = picking ? 'Click people to add them to the action' : sm ? `${sm.name} selected` : 'Click anyone to select them';
  const teamTiles = D.teamActions.map(a => tileFor(a, null));
  const indivTitle = sm ? `For ${first(sm.name)}` : 'For one person';
  const indivTiles = sm ? D.memberActions.map(a => tileFor(a, sm)) : [];
  const assessFirst = () => { act.spend(1); setState({ nudgeOk: true }); act.say('Justin assessed for Qualification. 1 day used.'); };
  const ev = evData && evKey ? { ...evData, art: EV_ART[evKey], hasImg: !!EV_IMG[evKey], img: EV_IMG[evKey] ? `/assets/npc/${EV_IMG[evKey]}.png` : '', two: evKey === 'capacity' || evKey === 'impact',
    secondLabel: evKey === 'capacity' ? 'Talk to Ruth first' : 'Call Priya', second: () => { setState({ event: null }); if (evKey === 'capacity') act.live('roleplay', 'ruth'); else act.live('sponsor'); } } : null;
  const closeEvent = () => { setState({ event: null }); if (ev && evKey === 'capacity') act.say('Leave approved. Justin covers Brightwell on Thursday and Friday.'); };
  const mobileList = members.slice(0, 6).map(m => ({ id: m.id, name: m.name, title: m.title, img: m.img, backdrop: backdrop(m), moodN: D.moods[m.mood].n, moodC: D.moods[m.mood].c }));
  const openPal = () => { hot.current = true; setState({ pal: true, q: '' }); };
  const closePal = () => setState({ pal: false });
  const onPalKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && palItems[0]) palItems[0].run(); if (e.key === 'Escape') setState({ pal: false }); };

  return (
    <div ref={rootRef} onMouseEnter={() => { hot.current = true; }} onMouseLeave={() => { hot.current = false; }} style={css(`flex:1; display:flex; flex-direction:column; min-height:${app.minH}; position:relative`)}>

      {!mobile && (
        <>
          <header style={css('display:flex; align-items:center; gap:14px; padding:14px 24px; white-space:nowrap; min-width:0')}>
            <div style={css('display:flex; align-items:center; gap:10px')}>
              {app.client && <div style={css('height:28px; padding:0 10px; border:1px dashed var(--ik-line-strong); border-radius:6px; display:flex; align-items:center; font-size:12px; color:var(--ik-text-2)')}>Halden Group logo</div>}
              <span style={css('font-size:22px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent')}>iLead</span>
            </div>
            <nav aria-label="Game menu" style={css('display:flex; gap:0; flex:0 1 auto; min-width:0; overflow:hidden')}>
              {nav.map((n, i) => <button key={i} onClick={n.go} style={css('flex:none; height:32px; padding:0 8px; border:0; border-radius:999px; background:transparent; color:var(--ik-text-2); font-size:13px; font-weight:600; cursor:pointer')} className={pseudo('hover', 'background:var(--ik-raised); color:var(--ik-text)')}>{n.n}</button>)}
            </nav>
            <div style={css('flex:1 1 0; min-width:0')}></div>
            <span style={css('flex:none; font-size:13px; color:var(--ik-text-2)')}><b style={css('color:var(--ik-text)')}>Week {app.week}</b> · Day {app.day}</span>
            <div aria-label={capAria} style={css('display:flex; align-items:center; gap:8px')}>
              <div style={css(`display:flex; gap:1px; animation:${capPulse}`)}>
                {capSlots.map((c, i) => <svg key={i} width="16" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" strokeLinejoin="round"></path></svg>)}
              </div>
              <span style={css('font-size:13px; color:var(--ik-text-2)')}><b style={css('color:var(--ik-text)')}>{capText}</b> left</span>
            </div>
            {app.showClock && (
              <button onClick={() => act.overlay('paused')} aria-label="Pause the simulation" style={css('display:flex; align-items:center; gap:6px; height:32px; padding:0 10px; border-radius:999px; border:1px solid var(--ik-line); background:var(--ik-raised); color:var(--ik-text); font-size:13px; font-weight:700; cursor:pointer')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"></rect><rect x="14" y="4" width="5" height="16" rx="1"></rect></svg>{app.clock}
              </button>
            )}
            <div style={css('position:relative')} onMouseEnter={scoreOn} onMouseLeave={scoreOff}>
              <button aria-label="Leadership score 1,240. Show breakdown" onFocus={scoreOn} onBlur={scoreOff} style={css('display:flex; align-items:center; gap:6px; height:32px; padding:0 10px; border:0; border-radius:999px; background:transparent; color:var(--ik-text); font-size:15px; font-weight:700; cursor:pointer')}>
                <svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="sgb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#249DFF"></stop><stop offset="1" stopColor="#00F2AD"></stop></linearGradient></defs><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3" fill="url(#sgb)"></polygon></svg>1,240
              </button>
              {s.scoreTip && (
                <div role="tooltip" style={css('position:absolute; top:calc(100% + 8px); right:0; width:260px; padding:14px; border-radius:16px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); box-shadow:0 16px 40px oklch(0.05 0.03 280 / 0.35); z-index:40; white-space:normal; display:flex; flex-direction:column; gap:8px')}>
                  <b>Leadership Score</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>Built from three parts. Every point is earned, nothing is taken away for being slow.</span>
                  {scoreParts.map(sp => <div key={sp.n} style={css('display:grid; grid-template-columns:80px 1fr 40px; gap:8px; align-items:center; font-size:12px')}><span>{sp.n}</span><div style={css('height:6px; border-radius:3px; background:var(--ik-track)')}><div style={css(`height:100%; width:${sp.w}; border-radius:3px; background:var(--grad-brand)`)}></div></div><b style={css('text-align:right')}>{sp.v}</b></div>)}
                </div>
              )}
            </div>
            <span aria-label="3 week streak" title="3 day streak. 2 more for a bonus" style={css('display:flex; align-items:center; gap:4px; font-size:15px; font-weight:700')}><svg width="16" height="16" viewBox="0 0 24 24" fill="oklch(0.8 0.15 60)" stroke="oklch(0.8 0.15 60)" strokeWidth="1.5" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>3</span>
            <button onClick={openPal} aria-label="Search members and actions" style={css('height:32px; padding:0 10px; border-radius:999px; border:1px solid var(--ik-line); background:var(--ik-raised); color:var(--ik-text-2); font-size:12px; font-weight:700; cursor:pointer')}>⌘K</button>
            <button onClick={() => act.overlay('settings')} aria-label="Settings" style={css('width:32px; height:32px; border-radius:50%; border:0; background:transparent; color:var(--ik-text-2); cursor:pointer; display:flex; align-items:center; justify-content:center')} className={pseudo('hover', 'background:var(--ik-raised)')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg></button>
            {/* Button is inline-flex with an 8px gap: the runtime renders the interpolation as its own span, so it is a separate flex item. */}
            <NoWrapButton variant={f ? 'secondary' : 'primary'} size="md" onClick={() => act.go('weekend')}>End week <span>{app.week}</span></NoWrapButton>
          </header>

          {isOffline && <div role="alert" style={css('margin:0 24px 12px; padding:10px 16px; border-radius:14px; background:var(--ik-warn-soft); border:1px solid var(--ik-warn); display:flex; align-items:center; gap:10px; font-size:13px')}><b>Connection lost.</b><span>Your clock is paused and actions will queue and send when you are back online.</span><span style={css('flex:1')}></span><span style={css('color:var(--ik-text-2)')}>Retrying in 4s</span></div>}
          {s.call && (
            <div role="alert" style={css('margin:0 24px 12px; padding:10px 12px 10px 10px; border-radius:18px; background:var(--ik-mat); border:1px solid var(--ik-acc); box-shadow:0 0 30px oklch(0.62 0.17 250 / 0.35); display:flex; align-items:center; gap:14px; animation:ilIn 300ms ease')}>
              <div style={css('position:relative; width:44px; height:44px')}><div style={css('position:absolute; inset:-4px; border-radius:50%; border:2px solid var(--ik-acc); animation:ilRing 1.4s ease-out infinite')}></div><div style={css('width:44px; height:44px; border-radius:50%; background:var(--grad-brand); color:#0A081B; font-weight:700; display:flex; align-items:center; justify-content:center')}>PN</div></div>
              <div style={css('display:flex; flex-direction:column')}><b>Priya Nair is calling</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>Regional Sales Director. About the Ashcroft discount.</span></div>
              <span style={css('flex:1')}></span>
              <NoWrapButton variant="secondary" size="sm" onClick={() => { setState({ call: false }); act.say('Call with Priya scheduled for tomorrow morning.'); }}>Call back within 1 day</NoWrapButton>
              <NoWrapButton variant="primary" size="sm" onClick={() => act.live('sponsor')}>Take the call</NoWrapButton>
            </div>
          )}

          <section aria-label="Team status" style={css('display:grid; grid-template-columns:repeat(4,minmax(0,1fr)) minmax(0,1.2fr) minmax(0,1.3fr) minmax(0,1fr); gap:10px; padding:0 24px 14px')}>
            {kpis.map(k => <KpiTile key={k.metric} {...k} />)}
            <div aria-label={`Team pulse: ${pos} upbeat, ${neu} steady, ${neg} struggling`} style={css('padding:10px 14px; border-radius:16px; background:var(--ik-card); backdrop-filter:blur(12px); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:6px')}>
              <span style={css('font-size:12px; color:var(--ik-text-2)')}>Team Pulse</span>
              <div style={css('display:flex; height:10px; border-radius:5px; overflow:hidden; gap:2px')}>
                {pulse.map(pp => <div key={pp.label} style={css(`flex:${pp.n}; background:${pp.c}`)}></div>)}
              </div>
              <div style={css('display:flex; gap:10px; font-size:12px; color:var(--ik-text-2)')}>{pulse.map(pp => <span key={pp.label}><b style={css('color:var(--ik-text)')}>{pp.n}</b> {pp.label}</span>)}</div>
            </div>
            <div aria-label="Target. $41,200 of $240,000" style={css('padding:10px 14px; border-radius:16px; background:var(--ik-card); backdrop-filter:blur(12px); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:6px')}>
              <span style={css('font-size:12px; color:var(--ik-text-2)')}>Quarter target</span>
              <div style={css('display:flex; align-items:baseline; gap:6px')}><b style={css('font-size:20px')}>$41,200</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>of $240,000</span></div>
              <div style={css('position:relative; height:6px; border-radius:3px; background:var(--ik-track)')}><div style={css('position:absolute; left:0; top:0; bottom:0; width:17.2%; border-radius:3px; background:linear-gradient(90deg,var(--ik-acc),var(--ik-acc-2))')}></div><div title="Week 2 pace" style={css('position:absolute; left:25%; top:-3px; bottom:-3px; width:2px; background:var(--ik-text)')}></div></div>
            </div>
            <div style={css('position:relative')}>
              <button onClick={() => setState(x => ({ sponsor: !x.sponsor }))} aria-expanded={s.sponsor} style={css('width:100%; height:100%; text-align:left; padding:10px 14px; border-radius:16px; background:var(--ik-card); backdrop-filter:blur(12px); border:1px solid var(--ik-line); color:var(--ik-text); cursor:pointer; display:flex; flex-direction:column; gap:6px')}>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>Sponsor confidence</span>
                <b style={css('font-size:16px')}>Steady</b>
                <div style={css('display:flex; gap:3px; width:100%')}>{sponsorBars.map((sb, i) => <div key={i} style={css(`flex:1; height:6px; border-radius:3px; background:${sb.bg}`)}></div>)}</div>
              </button>
              {s.sponsor && (
                <div style={css('position:absolute; top:calc(100% + 8px); right:0; width:280px; padding:14px; border-radius:16px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); z-index:40; display:flex; flex-direction:column; gap:8px; font-size:13px; box-shadow:0 16px 40px oklch(0.05 0.03 280 / 0.35)')}>
                  <b>Recent causes</b>
                  <span><span style={css('color:var(--ik-pos)')}>▲</span> Ashcroft moved to proposal</span>
                  <span><span style={css('color:var(--ik-neg)')}>▼</span> Revenue is behind week 2 pace</span>
                  <span><span style={css('color:var(--ik-neg)')}>▼</span> No reply yet to Priya's email</span>
                </div>
              )}
            </div>
          </section>

          {outcome && (
            <section aria-label="Outcome" style={css('margin:0 24px 14px; padding:16px 20px; border-radius:22px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); box-shadow:0 0 0 1px oklch(0.75 0.14 220 / 0.25), 0 16px 48px oklch(0.05 0.03 280 / 0.35); display:grid; grid-template-columns:auto minmax(0,1.4fr) minmax(0,1fr) auto; gap:24px; align-items:start; animation:ilIn 320ms cubic-bezier(.2,.9,.3,1.08)')}>
              <div style={css('width:84px; height:84px; border-radius:50%; overflow:hidden; background:linear-gradient(160deg,#DEE9FF,#9FDCEB); box-shadow:0 0 0 3px var(--ik-pos)')}><img src="/assets/npc/kent.png" alt="Kent Goldberg" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} /></div>
              <div style={css('display:flex; flex-direction:column; gap:8px; min-width:0')}>
                <span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2)')}>How it landed · 1:1 with Kent</span>
                <h3 style={css('margin:0; font-size:20px; font-weight:700; letter-spacing:-0.01em')}>{oc.headline}</h3>
                <div style={css('display:flex; gap:10px; align-items:flex-start')}>
                  <button onClick={replay} aria-label="Replay Kent's reply" style={css('flex:none; width:32px; height:32px; border-radius:50%; border:0; background:var(--grad-brand); color:#0A081B; cursor:pointer; display:flex; align-items:center; justify-content:center')}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></button>
                  <span style={css('font-size:14px; text-wrap:pretty')}>“{oc.reply}”</span>
                </div>
                {s.whyOpen && <ReasonDetail cause={oc.why.cause} rule={oc.why.rule} evidence={oc.why.ev} judgedByAI />}
              </div>
              <div style={css('display:flex; flex-direction:column; gap:10px; min-width:0')}>
                <div style={css('display:flex; gap:8px')}>
                  {affected.map(af => (
                    <button key={af.id} onClick={af.tap} aria-label={af.aria} style={css(`position:relative; width:44px; height:44px; padding:0; border-radius:50%; overflow:hidden; border:2px solid ${af.ring}; background:linear-gradient(160deg,#DEE9FF,#9FDCEB); cursor:pointer`)}><img src={af.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} /></button>
                  ))}
                </div>
                {reaction && <span style={css('font-size:13px; padding:8px 10px; border-radius:12px; background:var(--ik-raised)')}><b>{reaction.name}:</b> {reaction.t}</span>}
                <div style={css('display:flex; flex-wrap:wrap; gap:6px')}>
                  {moves.map((mv, i) => <ReasonChip key={i} {...mv} />)}
                </div>
                <span style={css('font-size:13px; color:var(--ik-text-2)')}>{oc.ripple}</span>
                {oc.changed.map((ch, i) => <span key={i} style={css('font-size:13px')}>{ch}</span>)}
              </div>
              <div style={css('display:flex; flex-direction:column; gap:8px; align-items:flex-end')}>
                <button onClick={dismissOutcome} aria-label="Dismiss outcome" style={css('width:32px; height:32px; border-radius:50%; border:0; background:var(--ik-raised); color:var(--ik-text); cursor:pointer')}>✕</button>
                <button onClick={toggleWhy} style={css('border:0; background:transparent; color:var(--ik-acc-2); font-size:13px; font-weight:700; cursor:pointer')}>{whyLabel}</button>
                <button onClick={() => act.say('History opens filtered to Kent.')} style={css('border:0; background:transparent; color:var(--ik-text-2); font-size:13px; font-weight:600; cursor:pointer')}>Open in History</button>
              </div>
            </section>
          )}

          <div style={css('flex:1; display:grid; grid-template-columns:64px minmax(0,1fr) 330px; gap:0; position:relative; min-height:0')}>
            <aside aria-label="Inbox" style={css('display:flex; flex-direction:column; align-items:center; gap:10px; padding:4px 0 24px 16px')}>
              <button onClick={toggleInbox} aria-label={`Inbox, ${unread} unread`} style={css('position:relative; width:44px; height:44px; border-radius:14px; border:1px solid var(--ik-line); background:var(--ik-card); color:var(--ik-text); cursor:pointer; display:flex; align-items:center; justify-content:center')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
                {unread > 0 && <span style={css('position:absolute; top:-6px; right:-6px; min-width:20px; height:20px; padding:0 5px; border-radius:10px; background:var(--grad-brand); color:#0A081B; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center')}>{unread}</span>}
              </button>
              {inboxRail.map(ir => (
                <button key={ir.id} onClick={ir.open} aria-label={ir.aria} style={css(`position:relative; width:40px; height:40px; padding:0; border-radius:50%; overflow:hidden; border:2px solid ${ir.ring}; background:${ir.bg}; color:#0A081B; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center`)}>
                  {ir.hasImg && <img src={ir.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />}{ir.label}
                </button>
              ))}
            </aside>

            <section aria-label="Your team" style={css('padding:4px 20px 24px; display:flex; flex-direction:column; gap:12px; min-width:0')}>
              <div style={css('display:flex; align-items:center; justify-content:space-between; gap:12px')}>
                <div style={css('display:flex; align-items:baseline; gap:12px')}><h2 style={css('margin:0; font-size:20px; font-weight:700; letter-spacing:-0.02em')}>Your team</h2><span style={css('font-size:13px; color:var(--ik-text-2)')}>{boardHint}</span></div>
                <div style={css('position:relative')}>
                  <button onClick={() => setState(x => ({ legend: !x.legend }))} aria-expanded={s.legend} style={css('display:flex; align-items:center; gap:6px; height:30px; padding:0 12px; border-radius:999px; border:1px solid var(--ik-line); background:var(--ik-card); color:var(--ik-text); font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>What do D, G, P and E mean?</button>
                  {s.legend && (
                    <div role="dialog" aria-label="Leadership styles" style={css('position:absolute; top:calc(100% + 8px); right:0; width:360px; padding:16px; border-radius:18px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); box-shadow:0 16px 40px oklch(0.05 0.03 280 / 0.35); z-index:40; display:flex; flex-direction:column; gap:12px; animation:ilIn 200ms ease')}>
                      <span style={css('font-size:13px; color:var(--ik-text-2)')}>Each week you choose how you lead each person. The four styles go from more support to more freedom.</span>
                      {D.styles.map(lg => (
                        <div key={lg.k} style={css('display:grid; grid-template-columns:32px 1fr; gap:12px; align-items:start')}><span style={css('width:32px; height:32px; border-radius:50%; background:var(--grad-brand); color:#0A081B; font-weight:700; display:flex; align-items:center; justify-content:center')}>{lg.k}</span><span style={css('display:flex; flex-direction:column')}><b>{lg.n}</b><span style={css('font-size:13px; color:var(--ik-text-2)')}>{lg.d}</span></span></div>
                      ))}
                      <div style={css('display:flex; justify-content:space-between; font-size:12px; color:var(--ik-text-2); padding-top:4px; border-top:1px solid var(--ik-line)')}><span>More support</span><span>More freedom</span></div>
                    </div>
                  )}
                </div>
              </div>
              <div style={css('display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px')}>
                {columns.map((col, ci) => (
                  <div key={ci} style={css('display:flex; flex-direction:column; gap:10px; min-width:0')}>
                    <div style={css(`padding:8px 12px; border-radius:12px; background:${col.hBg}; border:1px solid ${col.hBorder}; display:flex; flex-direction:column; gap:2px`)}>
                      <div style={css('display:flex; justify-content:space-between; gap:6px; align-items:baseline')}><b style={css('font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis')}>{col.n}</b><b style={css('font-size:15px')}>{col.count}</b></div>
                      <span style={css(`font-size:12px; color:${col.subC}; font-weight:${col.subW}`)}>{col.sub}</span>
                    </div>
                    {col.cards.map(({ id, ...m }) => <MemberCard key={id} {...m} />)}
                  </div>
                ))}
              </div>
            </section>

            <aside aria-label="Actions" style={css('padding:4px 24px 24px 0; display:flex; flex-direction:column; min-height:0')}>
              <div style={css('flex:1; border-radius:22px; background:var(--ik-card); backdrop-filter:blur(14px); border:1px solid var(--ik-line); display:flex; flex-direction:column; overflow:hidden')}>
                {!fl && (
                  <div style={css('padding:16px 18px; display:flex; flex-direction:column; gap:14px; flex:1')}>
                    <div style={css('display:flex; justify-content:space-between; align-items:baseline')}><h2 style={css('margin:0; font-size:18px; font-weight:700')}>Actions</h2><span style={css('font-size:12px; color:var(--ik-text-2)')}>{capText} left</span></div>
                    {outOfDays && <div style={css('padding:12px; border-radius:14px; background:var(--ik-raised); font-size:13px; display:flex; flex-direction:column; gap:4px')}><b>You have used all 5 days</b><span style={css('color:var(--ik-text-2)')}>Actions are locked until next week. Reply to messages any time, they cost no days.</span></div>}
                    <span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2)')}>Team</span>
                    <div style={css('display:flex; flex-direction:column; gap:6px')}>
                      {teamTiles.map((a, i) => <ActionTile key={i} a={a} />)}
                    </div>
                    <span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2); padding-top:4px')}>{indivTitle}</span>
                    {!sm && <p style={css('margin:0; font-size:13px; color:var(--ik-text-2)')}>Select a person on the board to see what you can do with them.</p>}
                    {sm && (
                      <div style={css('display:flex; flex-direction:column; gap:6px')}>
                        {indivTiles.map((a, i) => <ActionTile key={i} a={a} />)}
                      </div>
                    )}
                    <div style={css('display:flex; gap:12px; font-size:12px; color:var(--ik-text-2); padding-top:6px; margin-top:auto; flex-wrap:wrap')}>
                      <span style={css('display:flex; gap:4px; align-items:center')}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>Live, voice or text</span>
                      <span style={css('display:flex; gap:4px; align-items:center')}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>Instant decision</span>
                    </div>
                  </div>
                )}
                {fl && (
                  <div style={css('padding:16px 18px; display:flex; flex-direction:column; gap:14px; flex:1; overflow:auto; animation:ilIn 240ms ease')}>
                    <button onClick={() => setState({ flow: null })} style={css('align-self:flex-start; border:0; background:transparent; padding:0; color:var(--ik-text-2); font-size:13px; font-weight:600; cursor:pointer')}>← All actions</button>
                    <div style={css('display:flex; flex-direction:column; gap:6px')}>
                      <div style={css('display:flex; gap:6px')}><span style={css('height:22px; padding:0 8px; border-radius:999px; background:var(--ik-acc-soft); font-size:12px; font-weight:700; display:flex; align-items:center')}>{fl.kind}</span><span style={css('height:22px; padding:0 8px; border-radius:999px; background:var(--ik-raised); font-size:12px; font-weight:700; display:flex; align-items:center')}>{fl.cost}</span></div>
                      <h2 style={css('margin:0; font-size:22px; font-weight:700; letter-spacing:-0.02em')}>{fl.n}</h2>
                      <span style={css('font-size:13px; color:var(--ik-text-2); text-wrap:pretty')}>{fl.desc}</span>
                    </div>
                    {fl.hasOpts && (
                      <div role="radiogroup" aria-label="Choose an option" style={css('display:flex; flex-direction:column; gap:8px')}>
                        {fl.opts.map((o, i) => (
                          <button key={i} role="radio" aria-checked={o.on} onClick={o.pick} style={css(`display:flex; gap:10px; align-items:flex-start; text-align:left; padding:12px; border-radius:14px; border:1.5px solid ${o.border}; background:${o.bg}; color:var(--ik-text); cursor:pointer`)}>
                            <span style={css(`flex:none; width:18px; height:18px; margin-top:1px; border-radius:50%; border:2px solid ${o.border}; display:flex; align-items:center; justify-content:center`)}><span style={css(`width:8px; height:8px; border-radius:50%; background:${o.dot}`)}></span></span>
                            <span style={css('display:flex; flex-direction:column')}><b style={css('font-size:13px')}>{o.n}</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>{o.d}</span></span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={css('display:flex; flex-direction:column; gap:8px')}>
                      <span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2)')}>{fl.whoTitle}</span>
                      {fl.picking && <span style={css('font-size:13px; color:var(--ik-text-2)')}>{fl.limit}. Click people on the board.</span>}
                      <div style={css('display:flex; flex-wrap:wrap; gap:6px')}>
                        {fl.picks.map((pk, i) => <span key={i} style={css('display:flex; align-items:center; gap:6px; height:30px; padding:0 10px 0 3px; border-radius:999px; background:var(--ik-raised); border:1px solid var(--ik-line); font-size:13px; font-weight:600; white-space:nowrap')}><img src={pk.img} alt="" style={css('width:24px; height:24px; border-radius:50%; object-fit:cover; object-position:center top; background:#DEE9FF')} />{pk.n}</span>)}
                      </div>
                    </div>
                    {fl.nudge && (
                      <div role="note" style={css('padding:12px; border-radius:14px; background:var(--ik-warn-soft); border:1px solid var(--ik-warn); display:flex; flex-direction:column; gap:8px; font-size:13px')}>
                        <span style={css('text-wrap:pretty')}>{fl.nudgeText}</span>
                        <div style={css('display:flex; gap:8px')}><NoWrapButton variant="secondary" size="sm" onClick={assessFirst}>Assess first</NoWrapButton><NoWrapButton variant="ghost" size="sm" onClick={() => setState({ nudgeOk: true })}>Continue</NoWrapButton></div>
                      </div>
                    )}
                    <div style={css('margin-top:auto; padding:12px; border-radius:14px; background:var(--ik-raised); font-size:13px; text-wrap:pretty')}>{fl.summary}</div>
                    {/* The runtime only forwards position/size props of an x-import style to a wrapper div; the Button itself is not stretched. */}
                    <div style={{ width: '100%' }}><Button variant="primary" size="lg" disabled={fl.invalid} onClick={confirmFlow}>{fl.cta}</Button></div>
                  </div>
                )}
              </div>
            </aside>

            {s.inbox && (
              <div role="dialog" aria-label="Inbox" style={css('position:absolute; top:0; left:72px; bottom:24px; width:360px; border-radius:22px; background:var(--ik-mat); backdrop-filter:blur(20px); border:1px solid var(--ik-line-strong); box-shadow:0 24px 64px oklch(0.05 0.03 280 / 0.45); z-index:30; display:flex; flex-direction:column; overflow:hidden; animation:ilIn 240ms ease')}>
                <div style={css('display:flex; justify-content:space-between; align-items:center; padding:16px 18px; border-bottom:1px solid var(--ik-line)')}><h2 style={css('margin:0; font-size:18px; font-weight:700')}>Inbox</h2><button onClick={toggleInbox} aria-label="Close inbox" style={css('width:32px; height:32px; border-radius:50%; border:0; background:var(--ik-raised); color:var(--ik-text); cursor:pointer')}>✕</button></div>
                {unread === 0 && <div style={css('flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:32px; text-align:center')}><b>All caught up</b><span style={css('font-size:13px; color:var(--ik-text-2)')}>New messages from your team and Priya will slide in here.</span></div>}
                <div style={css('flex:1; overflow:auto; padding:10px; display:flex; flex-direction:column; gap:8px')}>
                  {inboxItems.map(it => (
                    <div key={it.id} style={css(`padding:12px; border-radius:16px; background:var(--ik-raised); border:1px solid ${it.border}; display:flex; flex-direction:column; gap:10px`)}>
                      <div style={css('display:flex; gap:10px')}>
                        <span style={css(`flex:none; width:40px; height:40px; border-radius:50%; overflow:hidden; background:${it.bg}; color:#0A081B; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center`)}>{it.hasImg && <img src={it.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />}{it.label}</span>
                        <span style={css('display:flex; flex-direction:column; min-width:0; flex:1')}><span style={css('display:flex; justify-content:space-between; gap:6px; font-size:12px; color:var(--ik-text-2)')}><b>{it.tag}</b><span>{it.meta}</span></span><b style={css('font-size:14px')}>{it.title}</b><span style={css('font-size:13px; color:var(--ik-text-2)')}>{it.preview}</span></span>
                      </div>
                      <div style={css('display:flex; gap:8px; align-items:center')}>{it.urgent && <span style={css('font-size:12px; font-weight:700; color:var(--ik-warn)')}>Pinned · {it.due}</span>}<span style={css('flex:1')}></span><button onClick={it.later} style={css('height:30px; padding:0 12px; border-radius:999px; border:1px solid var(--ik-line); background:transparent; color:var(--ik-text); font-size:12px; font-weight:700; cursor:pointer')}>Later</button><button onClick={it.open} style={css('height:30px; padding:0 12px; border-radius:999px; border:0; background:var(--grad-brand); color:#0A081B; font-size:12px; font-weight:700; cursor:pointer')}>{it.cta}</button></div>
                    </div>
                  ))}
                </div>
                <span style={css('padding:10px 18px; font-size:12px; color:var(--ik-text-2); border-top:1px solid var(--ik-line)')}>Replying costs no days, and still counts with that person.</span>
              </div>
            )}

            {pf && (
              <div role="dialog" aria-label={pf.aria} style={css('position:absolute; top:0; left:16px; right:24px; bottom:24px; border-radius:24px; background:var(--ik-mat); backdrop-filter:blur(24px); border:1px solid var(--ik-line-strong); box-shadow:0 24px 64px oklch(0.05 0.03 280 / 0.5); z-index:35; display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,0.9fr); overflow:hidden; animation:ilIn 260ms ease')}>
                <div style={css('display:flex; flex-direction:column; overflow:auto; border-right:1px solid var(--ik-line)')}>
                  <div style={css('display:flex; align-items:center; gap:18px; padding:22px 20px 6px')}><div style={css(`width:120px; height:120px; flex:none; border-radius:50%; overflow:hidden; background:${pf.backdrop}; box-shadow:0 0 0 3px var(--ik-line-strong)`)}><img src={pf.img} alt={pf.name} style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} /></div><div style={css('display:flex; flex-direction:column; gap:2px')}><b style={css('font-size:24px; letter-spacing:-0.02em')}>{pf.name}</b><span style={css('font-size:13px; color:var(--ik-text-2)')}>{pf.title}</span><span style={css('font-size:13px; font-weight:700')}>{pf.moodN}</span></div></div>
                  <div style={css('padding:18px 20px; display:flex; flex-direction:column; gap:14px')}>
                    <div style={css('display:grid; grid-template-columns:repeat(4,1fr); gap:8px')}>{pf.stats.map(st => <div key={st.n} style={css('padding:10px; border-radius:12px; background:var(--ik-raised); display:flex; flex-direction:column')}><span style={css('font-size:12px; color:var(--ik-text-2)')}>{st.n}</span><b style={css(`font-size:20px; color:${st.c}`)}>{st.v}</b></div>)}</div>
                    {pf.hasShared && <div style={css('padding:10px 12px; border-radius:12px; background:var(--ik-acc-soft); font-size:13px')}><b>Shared:</b> {pf.shared}</div>}
                    {pf.facts.map(fa => <div key={fa.k} style={css('display:grid; grid-template-columns:110px 1fr; gap:10px; font-size:13px')}><span style={css('color:var(--ik-text-2)')}>{fa.k}</span><span>{fa.v}</span></div>)}
                  </div>
                </div>
                <div style={css('display:flex; flex-direction:column; overflow:auto; padding:20px; gap:12px; border-right:1px solid var(--ik-line)')}>
                  <h3 style={css('margin:0; font-size:18px; font-weight:700')}>Your interactions</h3>
                  {pf.timeline.map((tl, i) => (
                    <div key={i} style={css('display:grid; grid-template-columns:12px 1fr; gap:12px')}>
                      <div style={css('display:flex; flex-direction:column; align-items:center')}><span style={css(`width:10px; height:10px; border-radius:50%; background:${tl.dot}; margin-top:5px`)}></span><span style={css('flex:1; width:2px; background:var(--ik-line)')}></span></div>
                      <div style={css('display:flex; flex-direction:column; gap:4px; padding-bottom:12px')}>
                        <span style={css('font-size:12px; color:var(--ik-text-2)')}>{tl.when}</span><b style={css('font-size:14px')}>{tl.t}</b>
                        {tl.hasQuote && <span style={css('font-size:13px; padding:8px 10px; border-radius:10px; background:var(--ik-raised)')}>“{tl.quote}”</span>}
                        <span style={css(`font-size:12px; font-weight:700; color:${tl.dc}`)}>{tl.delta}</span>
                      </div>
                    </div>
                  ))}
                  {pf.hasPromise && <div style={css('padding:10px 12px; border-radius:12px; border:1px dashed var(--ik-line-strong); font-size:13px')}><b>Open promise:</b> {pf.promise}</div>}
                </div>
                <div style={css('display:flex; flex-direction:column; overflow:auto; padding:20px; gap:10px')}>
                  <div style={css('display:flex; justify-content:space-between; align-items:center')}><h3 style={css('margin:0; font-size:18px; font-weight:700')}>Take an action</h3><button onClick={() => setState({ profile: null })} aria-label="Close profile" style={css('width:32px; height:32px; border-radius:50%; border:0; background:var(--ik-raised); color:var(--ik-text); cursor:pointer')}>✕</button></div>
                  {pf.actions.map((a, i) => (
                    <button key={i} onClick={a.pick} disabled={a.disabled} style={css(`display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; padding:12px; border-radius:14px; border:1px solid var(--ik-line); background:var(--ik-raised); color:${a.color}; cursor:${a.cursor}; text-align:left`)}><span style={css('display:flex; flex-direction:column')}><b style={css('font-size:13px')}>{a.n}</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>{a.sub}</span></span><span style={css('font-size:12px; font-weight:700; color:var(--ik-text-2)')}>{a.cost}</span></button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {mobile && (
        <div style={css('flex:1; display:flex; flex-direction:column; gap:12px; padding:12px 16px 24px')}>
          <div style={css('display:flex; align-items:center; gap:10px')}><span style={css('font-size:20px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent')}>iLead</span><span style={css('flex:1')}></span><span style={css('font-size:12px; color:var(--ik-text-2); white-space:nowrap')}><b style={css('color:var(--ik-text)')}>Week 2</b> · Day 3 · {capText} left</span></div>
          <section aria-label="Outcome" style={css('padding:18px; border-radius:22px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); display:flex; flex-direction:column; gap:12px; animation:ilIn 320ms ease')}>
            <div style={css('display:flex; gap:12px; align-items:center')}><div style={css('width:64px; height:64px; flex:none; border-radius:50%; overflow:hidden; background:linear-gradient(160deg,#DEE9FF,#9FDCEB); box-shadow:0 0 0 3px var(--ik-pos)')}><img src="/assets/npc/kent.png" alt="Kent" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} /></div><div style={css('display:flex; flex-direction:column')}><span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2)')}>How it landed</span><b style={css('font-size:18px; line-height:1.25')}>{oc.headline}</b></div></div>
            <div style={css('display:flex; gap:10px; align-items:flex-start; padding:12px; border-radius:14px; background:var(--ik-raised)')}><button onClick={replay} aria-label="Replay" style={css('flex:none; width:32px; height:32px; border-radius:50%; border:0; background:var(--grad-brand); color:#0A081B')}>▶</button><span style={css('font-size:14px')}>“{oc.reply}”</span></div>
            <div style={css('display:flex; flex-wrap:wrap; gap:6px')}>{moves.map((mv, i) => <ReasonChip key={i} {...mv} size="md" />)}</div>
            <span style={css('font-size:13px; color:var(--ik-text-2)')}>{oc.ripple}</span>
            {oc.changed.map((ch, i) => <span key={i} style={css('font-size:14px')}>{ch}</span>)}
            {s.whyOpen && <ReasonDetail cause={oc.why.cause} rule={oc.why.rule} evidence={oc.why.ev} judgedByAI layout="stack" />}
            {/* The design passes style={flex:1} to the primary Button, but the runtime drops non position/size props, so it does not grow. */}
            <div style={css('display:flex; gap:8px')}><NoWrapButton variant="secondary" size="lg" onClick={toggleWhy}>{whyLabel}</NoWrapButton><Button variant="primary" size="lg" onClick={dismissOutcome}>Back to my team</Button></div>
          </section>
          <span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2); padding-top:4px')}>Your team</span>
          {mobileList.map(m => (
            <div key={m.id} style={css('display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:16px; background:var(--ik-card); border:1px solid var(--ik-line); min-height:56px')}>
              <div style={css(`width:44px; height:44px; flex:none; border-radius:50%; overflow:hidden; background:${m.backdrop}`)}><img src={m.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} /></div>
              <div style={css('flex:1; display:flex; flex-direction:column; min-width:0')}><b style={css('font-size:14px')}>{m.name}</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>{m.title}</span></div>
              <span style={css('display:flex; align-items:center; gap:5px; font-size:12px; font-weight:700')}><span style={css(`width:8px; height:8px; border-radius:50%; background:${m.moodC}`)}></span>{m.moodN}</span>
            </div>
          ))}
        </div>
      )}

      {ev && (
        <div style={css('position:absolute; inset:0; z-index:48; background:var(--ik-scrim); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:24px')}>
          <div role="dialog" aria-label={`${ev.tag} event`} style={css('width:520px; max-width:100%; border-radius:26px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); box-shadow:0 30px 80px oklch(0.05 0.03 280 / 0.5); overflow:hidden; animation:ilIn 280ms cubic-bezier(.2,.9,.3,1.08)')}>
            <div style={css(`position:relative; height:170px; background:${ev.art}; display:flex; align-items:flex-end; padding:16px 20px`)}>
              {ev.hasImg && <img src={ev.img} alt="" style={css('position:absolute; right:20px; bottom:0; height:150px; width:150px; border-radius:50% 50% 0 0; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />}
              {/* Flex container with a gap: the interpolation is its own flex item, as in the runtime. */}
              <span style={css('position:relative; display:flex; align-items:center; gap:6px; height:26px; padding:0 12px; border-radius:999px; background:oklch(0.13 0.03 285 / 0.8); color:#fff; font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase')}><span>{ev.tag}</span> event</span>
              <span style={css('position:absolute; top:14px; left:20px; font-size:12px; color:#0A081B; font-weight:600')}>Illustration from GenieKreator config</span>
            </div>
            <div style={css('padding:20px 22px 22px; display:flex; flex-direction:column; gap:12px')}>
              <h2 style={css('margin:0; font-size:22px; font-weight:700; letter-spacing:-0.02em; text-wrap:balance')}>{ev.title}</h2>
              <p style={css('margin:0; color:var(--ik-text-2); text-wrap:pretty')}>{ev.body}</p>
              <div style={css('display:flex; flex-direction:column; gap:6px')}>{ev.impact.map((im, i) => <span key={i} style={css('display:flex; gap:8px; align-items:center; font-size:13px')}><span style={css('width:6px; height:6px; border-radius:50%; background:var(--ik-acc-2)')}></span>{im}</span>)}</div>
              <div style={css('display:flex; align-items:center; gap:8px; padding-top:6px')}><span style={css('font-size:12px; color:var(--ik-text-2); display:flex; gap:6px; align-items:center')}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"></rect><rect x="14" y="4" width="5" height="16" rx="1"></rect></svg>Clock paused</span><span style={css('flex:1')}></span>
                {ev.two && <NoWrapButton variant="secondary" size="md" onClick={ev.second}>{ev.secondLabel}</NoWrapButton>}
                <NoWrapButton variant="primary" size="md" onClick={closeEvent}>{ev.cta}</NoWrapButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {s.pal && (
        <div onClick={closePal} style={css('position:absolute; inset:0; background:var(--ik-scrim); display:flex; justify-content:center; align-items:flex-start; padding-top:120px; z-index:49')}>
          <div role="dialog" aria-label="Command palette" onClick={e => e.stopPropagation()} style={css('width:560px; max-width:calc(100% - 32px); border-radius:20px; background:var(--ik-mat); backdrop-filter:blur(24px); border:1px solid var(--ik-line-strong); overflow:hidden')}>
            <input ref={palRef} value={s.q} onChange={(e: ChangeEvent<HTMLInputElement>) => setState({ q: e.target.value })} onKeyDown={onPalKey} placeholder="Find a teammate or an action" aria-label="Find a teammate or an action" style={css('width:100%; height:56px; padding:0 18px; border:0; border-bottom:1px solid var(--ik-line); outline:0; background:transparent; color:var(--ik-text); font-size:15px')} />
            <div style={css('max-height:340px; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:2px')}>
              {palItems.map((it, i) => <button key={i} onClick={it.run} style={css(`display:flex; align-items:center; gap:12px; padding:8px 12px; border-radius:12px; border:0; background:${it.bg}; color:var(--ik-text); cursor:pointer; text-align:left`)} className={pseudo('hover', 'background:var(--ik-raised)')}><span style={css(`width:30px; height:30px; flex:none; border-radius:50%; overflow:hidden; background:${it.iconBg}`)}>{it.hasImg && <img src={it.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />}</span><b style={css('flex:1; font-size:14px')}>{it.n}</b><span style={css('font-size:12px; color:var(--ik-text-2)')}>{it.sub}</span></button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
