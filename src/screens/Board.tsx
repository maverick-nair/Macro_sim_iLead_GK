import { useEffect, useRef } from 'react';
import type { ScreenProps, MemberView } from '../app/types';
import type { EventType, MemberAction, MetricKey, StyleKey, TeamAction } from '../data/types';
import { css } from '../lib/css';
import { NoWrapButton } from '../ds/Button';
import { useMergeState } from './board/useMergeState';
import type { MemberCardProps } from '../components/member/MemberCard';
import type { KpiTrend } from '../components/metric/KpiTile';
import { Hud, type HudProps } from '../components/hud/Hud';
import { MetricsStrip, type MetricsStripProps } from '../components/metrics/MetricsStrip';
import { type ActionBlock, type ActionTileProps } from '../components/action/ActionTile';
import { ActionDrawer, type ActionDrawerProps } from '../components/action/ActionDrawer';
import { useDays, type PeriodUnit, type SubPeriodUnit } from '../components/action/days';
import { ActionsPanel } from '../components/actions/ActionsPanel';
import { TeamBoard, type StageColumn, type TeamBoardHint } from '../components/team/TeamBoard';
import { InboxRail, type InboxRailItem } from '../components/inbox/InboxRail';
import { InboxDrawer, type InboxDrawerItem } from '../components/inbox/InboxDrawer';
import type { InboxSender } from '../components/inbox/sender';
import { SponsorCall } from '../components/board/SponsorCall';
import { CommandPalette, type PaletteResult, type PaletteTone } from '../components/palette/CommandPalette';
import { OutcomePanel, type OutcomePanelProps } from '../components/outcome/OutcomePanel';
import { ProfilePanel, type ProfilePanelProps, type ProfileTimelineEntry } from '../components/profile/ProfilePanel';
import { useI18n, type I18n } from '../i18n';

/**
 * Main board: HUD, metrics strip, team board with stage columns, inbox rail,
 * actions panel, profile, action drawer, events, outcome panel, legend, Cmd K
 * palette, sponsor call. Port of `project/ilBoard.dc.html`.
 */
export interface BoardProps extends ScreenProps {
  uiState?: string;
  eventType?: string;
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

type Tile = Omit<ActionTileProps, 'layout'>;

const METRICS: MetricKey[] = ['skill', 'morale', 'result', 'trust'];

const first = (n: string) => n.split(' ')[0];
/** Palette icon backdrop: away reads grey, strained moods warm. */
function paletteTone(m: MemberView): PaletteTone {
  return m.away ? 'away' : (m.mood === 'frustrated' || m.mood === 'concerned') ? 'warm' : 'calm';
}
/** The drawer's summary line: what will happen and the day cost. */
function summary(t: I18n['t'], days: (d: number) => string, f: Flow, names: string[]): string {
  const a = f.a, cost = days(a.c);
  const list = names.length > 1 ? t('action.list.pair', { rest: names.slice(0, -1).join(', '), last: names[names.length - 1] }) : (names[0] || '');
  const option = a.options && f.opt !== null ? a.options[f.opt].n : '';
  if (a.k === 'training') return t('action.summary.training', { list: list || t('action.summary.upTo', { max: a.select ? a.select[1] : 3 }), option: option.toLowerCase(), cost });
  if (a.k === 'energize') return t('action.summary.energize', { option, cost });
  if (a.k === 'swap') return names.length === 2 ? t('action.summary.swap', { a: names[0], b: names[1], cost }) : t('action.summary.swapPick', { cost });
  if (a.k === 'meet') return t('action.summary.meet', { cost });
  if (a.k === 'email') return t('action.summary.email');
  if (a.kind === 'live') return t('action.summary.live', { action: a.n, list, cost, duration: a.dur ?? '' });
  if (a.k === 'reward') return t('action.summary.reward', { list, cost });
  return t('action.summary.other', { action: a.n, list, cost });
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

export function Board(props: BoardProps) {
  const { d: D, app, act } = props;
  const [s, setState] = useMergeState<BoardState>(() => initialState(props));
  const rootRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const days = useDays();
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

  if (!D || !app.members) return null;

  const memberById = (list: MemberView[], id: string) => list.find(x => x.id === id) as MemberView;

  const tileFor = (a: AnyAction, m: MemberView | null): Tile => {
    const done = s.done.includes(a.k + ':' + (m ? m.id : 'team'));
    // TODO(M2): the engine decides availability; "until Day 4" is the prototype's fixture.
    let block: ActionBlock | undefined;
    if (a.lock) block = { reason: 'locked', text: a.lock };
    else if (done) block = { reason: 'planned' };
    else if (m && m.away && a.k !== 'feedback') block = { reason: 'away', untilDay: 4 };
    else if (m && a.k === 'reward' && m.rewarded) block = { reason: 'cooldown', text: a.cooldown ?? '' };
    else if (a.c > app.capacity) block = { reason: 'days', need: a.c, have: app.capacity };
    return { name: a.n, kind: a.kind, days: a.c, duration: a.dur, block,
      onPick: () => { if (block) return; setState({ profile: null, flow: { a, opt: a.options ? 0 : null, picks: m ? [m.id] : [], member: !!m }, nudgeOk: false }); } };
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
    act.say(t('action.toast.planned', { summary: summary(t, days, f, names) }));
  };

  // ---- renderVals ----
  const outcome = !!app.outcome, cap = app.capacity;
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

  // TODO(M2): the storyline config supplies the units and capacity; Sales Elevator is weeks of 5 days.
  const periodUnit: PeriodUnit = 'week', subPeriodUnit: SubPeriodUnit = 'day', capacityPerPeriod = 5;
  const worst = D.stages.reduce((b, st, i) => (st.count / st.ideal < D.stages[b].count / D.stages[b].ideal ? i : b), 0);
  const columns: StageColumn[] = D.stages.map((st, i) => ({ key: st.k, name: st.n, count: st.count, ideal: st.ideal, bottleneck: i === worst,
    cards: members.filter(m => m.stage === i).map(card) }));
  const avg = (k: MetricKey) => Math.round(members.reduce((a, m) => a + m[k], 0) / members.length);
  const kd: Record<MetricKey, number> = outcome ? { skill: 0, morale: 0.6, result: 0, trust: 0.6 } : { skill: 0.3, morale: 0, result: 0.6, trust: -0.3 };
  // TODO(M2): the engine supplies KPI values and trends; these are the prototype's fixed numbers.
  const kpis = METRICS.map(k => { const dd = kd[k];
    const trend: KpiTrend = s.fresh && dd ? { kind: 'delta', delta: dd } : { kind: 'direction', direction: dd > 0 ? 'up' : dd < 0 ? 'down' : 'flat' };
    return { metric: k, value: avg(k), trend }; });
  const pos = members.filter(m => m.mood === 'happy').length, neu = members.filter(m => m.mood === 'neutral' || m.mood === 'thinking').length, neg = members.length - pos - neu;
  const sm = members.find(m => m.id === s.sel);

  // TODO(M2): the engine supplies the prerequisite; Justin and Qualification are the prototype's fixture.
  const NUDGE = { name: 'Justin', area: 'Qualification', days: 1 };
  let fl: ActionDrawerProps | null = null;
  if (f) {
    const names = f.picks.map(id => first(memberById(members, id).name));
    const needNudge = f.a.prereq && f.picks.includes('justin') && !s.nudgeOk;
    const min = f.a.select ? f.a.select[0] : 0;
    fl = { name: f.a.n, kind: f.a.kind, days: f.a.c, description: f.a.desc || t('action.drawer.liveDescription', { duration: f.a.dur || '' }),
      options: f.a.options?.map(o => ({ name: o.n, detail: o.d })), option: f.opt, onOption: i => setState({ flow: { ...f, opt: i } }),
      people: f.a.select && !f.member ? { mode: 'pick', max: f.a.select[1], limit: f.a.limit || '' } : f.member ? { mode: 'with' } : { mode: 'who' },
      picks: f.picks.map(id => { const m = memberById(members, id); return { id, name: m.name, img: m.img }; }),
      nudge: needNudge ? { ...NUDGE,
        onAssess: () => { act.spend(NUDGE.days); setState({ nudgeOk: true }); act.say(t('action.toast.assessed', { name: NUDGE.name, area: NUDGE.area, cost: days(NUDGE.days) })); },
        onContinue: () => setState({ nudgeOk: true }) } : undefined,
      summary: summary(t, days, f, names), canConfirm: !(f.picks.length < min || !!(f.a.options && f.opt === null)),
      cta: f.a.kind === 'static' ? 'confirm' : f.a.k === 'email' ? 'composer' : 'start', onConfirm: confirmFlow, onBack: () => setState({ flow: null }) };
  }

  const pm = members.find(m => m.id === s.profile);
  let pf: ProfilePanelProps | null = null;
  if (pm) {
    const kent = pm.id === 'kent';
    const styleName = (k: StyleKey) => D.styles.find(x => x.k === k)?.n ?? '';
    // TODO(M2): the engine supplies the timeline, the surfaced concern, career goal and promises; these are the prototype's fixture.
    const timeline: ProfileTimelineEntry[] = kent ? [
      ...(outcome ? [{ id: 'oneOnOne', when: { period: 2, sub: 3 }, title: '1:1 conversation', quote: 'Since the territory split, my best leads go to Beth. Nobody asked me.', tone: 'pos' as const,
        changes: [{ metric: 'morale' as const, delta: 8 }, { metric: 'trust' as const, delta: 6 }] }] : []),
      { id: 'chat', when: { period: 2, sub: 2 }, title: 'Chat request went unanswered', quote: 'Do you have 15 minutes today? Something has been bothering me.', tone: 'neg', changes: [{ metric: 'morale', delta: -6 }] },
      { id: 'style', when: { period: 1, sub: 4 }, title: 'Style: Directing', tone: 'neg', reaction: 'felt micromanaged', changes: [{ metric: 'morale', delta: -4 }] },
      { id: 'meet', when: { period: 1, sub: 1 }, title: 'Meet the team', quote: 'Happy to be here. Busy week ahead.', tone: 'neutral', changes: [] }
    ] : [
      { id: 'style', when: { period: 1, sub: 4 }, title: 'Style: ' + styleName(pm.last), tone: pm.lastReact, reaction: pm.lastReact === 'pos' ? 'positive' : 'negative', changes: null },
      { id: 'meet', when: { period: 1, sub: 1 }, title: 'Meet the team', tone: 'neutral', changes: [] }
    ];
    const promise = kent && outcome ? 'Review lead routing with Kent by Friday' : pm.promise;
    pf = { name: pm.name, title: pm.title, img: pm.img, mood: pm.mood, away: !!pm.away,
      stats: { skill: pm.skill, morale: pm.morale, result: pm.result, trust: pm.trust }, style: pm.style,
      shared: kent && outcome ? 'feels overlooked since the territory split moved his best leads to Beth.' : null,
      facts: [{ key: 'previous', value: pm.prev }, { key: 'tenure', value: pm.tenure }, { key: 'experience', value: pm.exp }, { key: 'skills', value: pm.skills }, { key: 'remarks', value: pm.remarks },
        { key: 'careerGoal', value: kent && outcome ? 'Wants to mentor new hires' : null }, { key: 'relationships', value: pm.relations }],
      periodUnit, subPeriodUnit, timeline,
      promises: promise ? [{ text: promise, status: 'open' }] : [],
      actions: D.memberActions.map(a => tileFor(a, pm)),
      onClose: () => setState({ profile: null }) };
  }

  const oc = D.outcome;
  const evKey = s.event as EventType | null;
  const evData = evKey ? D.events[evKey] : null;
  const unreadItems = D.inbox.filter(i => !s.readIds.includes(i.id));
  const sender = (it: (typeof D.inbox)[number]): InboxSender => (it.from === 'sponsor' ? { kind: 'sponsor', initials: D.sponsor.initials } : it.from === 'news' ? { kind: 'news' } : { kind: 'member', img: `/assets/npc/${it.from}.png` });
  const openItem = (it: (typeof D.inbox)[number]) => { setState(x => ({ inbox: false, readIds: [...x.readIds, it.id] })); if (it.type === 'news') setState({ event: 'impact' }); else if (it.type === 'email') act.live('email', it.from); else if (it.type === 'sponsor') act.live('sponsor'); else act.live('roleplay', it.from); };
  const q = s.q.trim().toLowerCase();
  const palItems: PaletteResult[] = [
    ...members.map(m => ({ id: 'member:' + m.id, name: m.name, detail: m.title, img: m.img, tone: paletteTone(m), onRun: () => setState({ pal: false, sel: m.id, flow: null }) })),
    ...D.teamActions.map(a => ({ id: 'action:' + a.k, name: a.n, detail: days(a.c), tone: 'brand' as const, onRun: () => { setState({ pal: false }); tileFor(a, null).onPick(); } }))]
    .filter(i => !q || i.name.toLowerCase().includes(q)).slice(0, 9);

  const isOffline = props.uiState === 'offline';
  // A client theme's nav reads Objective, History and More, as the design chat intended (D17, fixed in M7: D72).
  const navKeys = app.client ? ['objective', 'history', 'more'] : ['objective', 'funnel', 'history', 'badges', 'more'];
  const nav = navKeys.map(key => ({ key, label: t('hud.nav.item', { key }) }));
  const onNav = (key: string) => {
    const n = t('hud.nav.item', { key });
    act.say(key === 'more' ? 'More: Tutorial, Funnel, Leaderboard, Badges and Help.' : `${n} opens as a panel over the board.`);
  };
  const outOfDays = cap === 0;
  // TODO(M2): the engine supplies the clock, score and streak; these are the prototype's fixed values.
  // The prototype's fixture scores its pillars out of 1000 (125 a week over 8 weeks); the engine's are 0 to 100.
  const hud: HudProps = {
    nav, onNav,
    clock: { period: app.week, periodUnit: 'week', subPeriod: app.day, subPeriodUnit: 'day', capacity: 5, capacityLeft: cap },
    sessionClock: app.showClock ? app.clock : null, onPause: () => act.overlay('paused'),
    score: { total: 1240, business: 420, people: 510, leadership: 310 }, pillarScale: 125 * 8,
    scoreOpen: s.scoreTip, onScoreOpenChange: v => setState({ scoreTip: v }),
    streak: 3, onPalette: () => openPal(), onSettings: () => act.overlay('settings'), onEndPeriod: () => act.go('weekend'),
    endEmphasis: f ? 'secondary' : 'primary'
  };
  // TODO(M2): the engine supplies the target, pace and sponsor confidence.
  const strip: MetricsStripProps = {
    kpis, pulse: { upbeat: pos, steady: neu, struggling: neg },
    target: { value: 41200, target: 240000, pace: 0.25, pacePeriod: { unit: 'week', n: app.week } },
    sponsor: { level: 'steady', open: s.sponsor, onToggle: () => setState(x => ({ sponsor: !x.sponsor })),
      causes: [{ text: 'Ashcroft moved to proposal', delta: 1 }, { text: 'Revenue is behind week 2 pace', delta: -1 }, { text: "No reply yet to Priya's email", delta: -1 }] }
  };
  const person = (id: string) => { const m = memberById(members, id); return { id, name: m.name, shortName: first(m.name), img: m.img }; };
  const ocWho = person(oc.who);
  const outcomePanel: OutcomePanelProps = {
    person: ocWho, context: t('outcome.context.oneOnOne', { name: ocWho.shortName }), headline: oc.headline, reply: oc.reply,
    onReplay: () => act.say(t('outcome.toast.replay', { name: ocWho.shortName })),
    why: { cause: oc.why.cause, rule: oc.why.rule, evidence: oc.why.ev, judgedByAI: true }, whyOpen: s.whyOpen, onToggleWhy: () => setState(x => ({ whyOpen: !x.whyOpen })),
    affected: oc.affected.map(person), revealed: s.reveal,
    reaction: s.reveal ? { name: first(memberById(members, s.reveal).name), text: oc.reactions[s.reveal] } : undefined,
    onReveal: id => setState(x => ({ reveal: x.reveal === id ? null : id })),
    changes: oc.moves.map(mv => ({ name: first(memberById(members, mv.id).name), metric: mv.k, delta: mv.d })), showNumbers: s.nums, onToggleNumbers: () => setState(x => ({ nums: !x.nums })),
    ripple: oc.ripple, changed: oc.changed, onDismiss: () => act.clearOutcome(),
    onOpenHistory: () => act.say(t('outcome.toast.history', { name: ocWho.shortName }))
  };
  const toggleInbox = () => setState(x => ({ inbox: !x.inbox }));
  const unread = unreadItems.length;
  const openById = (id: string) => { const it = unreadItems.find(x => x.id === id); if (it) openItem(it); };
  const inboxRail: InboxRailItem[] = unreadItems.map(it => ({ id: it.id, label: it.title, sender: sender(it), urgent: !!it.urgent }));
  const sponsorFirst = first(D.sponsor.name);
  const inboxItems: InboxDrawerItem[] = unreadItems.map(it => ({ id: it.id, sender: sender(it), title: it.title, preview: it.preview, meta: it.meta, due: it.due ?? null, urgent: !!it.urgent,
    tag: t('inbox.tag', { type: it.type, name: it.type === 'sponsor' ? sponsorFirst : it.type === 'news' ? '' : first(memberById(members, it.from).name) }),
    cta: it.type === 'news' ? 'impact' : 'reply' }));
  const boardHint: TeamBoardHint = picking ? { kind: 'picking' } : sm ? { kind: 'selected', name: sm.name } : { kind: 'idle' };
  const teamTiles = D.teamActions.map(a => tileFor(a, null));
  const indiv = sm ? { firstName: first(sm.name), tiles: D.memberActions.map(a => tileFor(a, sm)) } : null;
  const ev = evData && evKey ? { ...evData, art: EV_ART[evKey], hasImg: !!EV_IMG[evKey], img: EV_IMG[evKey] ? `/assets/npc/${EV_IMG[evKey]}.png` : '', two: evKey === 'capacity' || evKey === 'impact',
    secondLabel: evKey === 'capacity' ? 'Talk to Ruth first' : 'Call Priya', second: () => { setState({ event: null }); if (evKey === 'capacity') act.live('roleplay', 'ruth'); else act.live('sponsor'); } } : null;
  const closeEvent = () => { setState({ event: null }); if (ev && evKey === 'capacity') act.say('Leave approved. Justin covers Brightwell on Thursday and Friday.'); };
  const openPal = () => { hot.current = true; setState({ pal: true, q: '' }); };
  const closePal = () => setState({ pal: false });

  return (
    <div ref={rootRef} onMouseEnter={() => { hot.current = true; }} onMouseLeave={() => { hot.current = false; }} style={css(`flex:1; display:flex; flex-direction:column; min-height:${app.minH}; position:relative`)}>

      <>
          <Hud {...hud} />

          {isOffline && <div role="alert" style={css('margin:0 24px 12px; padding:10px 16px; border-radius:14px; background:var(--ik-warn-soft); border:1px solid var(--ik-warn); display:flex; align-items:center; gap:10px; font-size:13px')}><b>Connection lost.</b><span>Your clock is paused and actions will queue and send when you are back online.</span><span style={css('flex:1')}></span><span style={css('color:var(--ik-text-2)')}>Retrying in 4s</span></div>}
          {s.call && (
            <SponsorCall name={D.sponsor.name} initials={D.sponsor.initials} line="Regional Sales Director. About the Ashcroft discount." laterLabel={t('events.call.later', { amount: days(1) })}
              onLater={() => { setState({ call: false }); act.say('Call with Priya scheduled for tomorrow morning.'); }} onAnswer={() => act.live('sponsor')} />
          )}

          <MetricsStrip {...strip} />

          {outcome && <OutcomePanel {...outcomePanel} />}

          <div style={css('flex:1; display:grid; grid-template-columns:64px minmax(0,1fr) 330px; gap:0; position:relative; min-height:0')}>
            <InboxRail unread={unread} items={inboxRail} onToggle={toggleInbox} onOpen={openById} />

            <TeamBoard hint={boardHint} legendOpen={s.legend} onToggleLegend={() => setState(x => ({ legend: !x.legend }))} periodUnit={periodUnit} columns={columns} />

            <ActionsPanel capacityLeft={cap} capacity={capacityPerPeriod} subPeriodUnit={subPeriodUnit} periodUnit={periodUnit} outOfCapacity={outOfDays}
              team={teamTiles} member={indiv} drawer={fl ? <ActionDrawer {...fl} /> : undefined} />

            <InboxDrawer open={s.inbox} subPeriodUnit={subPeriodUnit} items={inboxItems} sponsorName={sponsorFirst} onClose={toggleInbox} onOpen={openById}
              onLater={id => setState(x => ({ readIds: [...x.readIds, id] }))} />

            {pf && <ProfilePanel {...pf} />}
          </div>
      </>

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

      <CommandPalette open={s.pal} onClose={closePal} query={s.q} onQueryChange={q => setState({ q })} results={palItems} />
    </div>
  );
}
