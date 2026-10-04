import { useEffect, useRef, useState } from 'react';
import type { Block, EngineView, Intent, MemberView, StyleKey } from '../../engine/contract';
import { EngineError } from '../../engine/client';
import { useEngineView, useIntent } from '../../engine/react';
import { useUi } from '../../app/uiStore';
import { MoneyProvider, useMoney } from '../../i18n/money';
import { useI18n } from '../../i18n';
import { Button } from '../../ds/Button';
import { Hud, type HudProps } from '../hud/Hud';
import { MetricsStrip, type MetricsStripProps } from '../metrics/MetricsStrip';
import { TeamBoard, type StageColumn, type TeamBoardHint } from '../team/TeamBoard';
import { ActionsPanel } from '../actions/ActionsPanel';
import { ActionDrawer, type ActionDrawerProps } from '../action/ActionDrawer';
import type { ActionBlock, ActionTileProps } from '../action/ActionTile';
import { useDays } from '../action/days';
import { InboxRail, type InboxRailItem } from '../inbox/InboxRail';
import { InboxDrawer, type InboxDrawerItem } from '../inbox/InboxDrawer';
import type { InboxSender } from '../inbox/sender';
import { OutcomePanel, type OutcomePerson } from '../outcome/OutcomePanel';
import { CommandPalette, type PaletteResult } from '../palette/CommandPalette';
import { Toast } from '../feedback/Toast';
import type { MetricKey } from '../../engine/contract';
import { ProfilePanel, type ProfilePanelProps } from '../profile/ProfilePanel';
import { Composer } from './Composer';
import { PeriodPanel } from './PeriodPanel';
import { EventCard } from './EventCard';
import { teamChips, type Chip } from './chips';

/**
 * The main board, rendered only from the engine view (brief, rule 1). Every button sends an intent;
 * the board never computes outcomes, scores or availability. UI state (selection, open panels) lives
 * in the UI store and local state.
 */
const PLACEHOLDER = '/assets/npc/placeholder.svg';
const TOAST_MS = 3400;
const first = (n: string) => n.split(' ')[0];

/** The action being planned: which drawer card is chosen, who is picked, and whether the nudge was waved off. */
interface Flow { key: string; choice: string | null; picks: string[]; nudgeOk: boolean }

export interface EngineBoardProps {
  /** Client theme: the HUD shows the client's logo. */
  client?: boolean;
  onPause: () => void;
  onSettings: () => void;
}

export function EngineBoard(props: EngineBoardProps) {
  const q = useEngineView();
  const { t } = useI18n();
  if (!q.data) return <div role="status" className="flex flex-1 items-center justify-center text-14 text-fg-secondary">{t('board.loading')}</div>;
  return (
    <MoneyProvider money={q.data.money}>
      <Board view={q.data} {...props} />
    </MoneyProvider>
  );
}

function Board({ view: v, ...app }: EngineBoardProps & { view: EngineView }) {
  const { t } = useI18n();
  const ui = useUi();
  const intent = useIntent();
  const money = useMoney();
  const unit = v.clock.subPeriodUnit, periodUnit = v.clock.periodUnit;
  const amount = useDays(unit);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [draft, setDraft] = useState<Record<string, StyleKey>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [legend, setLegend] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const [query, setQuery] = useState('');
  const [reveal, setReveal] = useState<string | null>(null);
  const [liveTitle, setLiveTitle] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };
  const send = async (i: Intent) => {
    try {
      return await intent.mutateAsync(i);
    } catch (e) {
      say(t('board.error', { code: e instanceof EngineError ? e.code : 'other' }));
      return null;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setQuery(''); setPal(true); }
      if (e.key === 'Escape') { setFlow(null); setLegend(false); ui.openPanel('none'); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(toastTimer.current); };
  }, [ui]);

  // A new period clears the style draft and any half planned action.
  useEffect(() => { setDraft({}); setFlow(null); }, [v.clock.period]);

  const styling = v.phase === 'style';
  const busy = intent.isPending;
  const member = (id: string) => v.members.find(m => m.id === id);
  const action = (key: string) => v.actions.find(a => a.key === key);
  const img = (m: { img: string | null } | undefined) => m?.img ?? PLACEHOLDER;
  const chipName = (c: Chip) => (c.subject === 'team' ? t('board.chip.team') : c.subject === 'group' ? t('board.chip.people', { n: c.count }) : first(member(c.subject)?.name ?? ''));
  const stageName = (key: string) => v.funnel.find(st => st.key === key)?.name ?? key;

  /** Words an engine block reason in the storyline's units. */
  const blockText = (b: Exclude<Block, { reason: 'capacity' }>): string => {
    switch (b.reason) {
      case 'locked': return t('board.block.locked', { unit: periodUnit, n: b.period });
      case 'cooldown': return t('board.block.cooldown', { amount: amount(b.in) });
      case 'away': return t('board.block.away', { kind: b.kind, amount: amount(b.for) });
      case 'rewarded': return t('board.block.rewarded', { amount: amount(b.in) });
      case 'gone': return t('board.block.gone');
      case 'lastInStage': return t('board.block.lastInStage', { stage: stageName(b.stage) });
      case 'noCover': return t('board.block.noCover', { stage: stageName(b.stage) });
      case 'teamFull': return t('board.block.teamFull');
    }
  };
  const block = (b: Block | null): ActionBlock | undefined => {
    if (!b) return undefined;
    if (b.reason === 'capacity') return { reason: 'days', need: b.need, have: b.have };
    return { reason: b.reason === 'locked' ? 'locked' : 'cooldown', text: blockText(b) };
  };
  const blockLine = (b: Block | null) => (!b ? '' : b.reason === 'capacity' ? t('action.blocked.days', { need: amount(b.need), have: amount(b.have) }) : blockText(b));

  type ActionV = EngineView['actions'][number];
  /**
   * What the drawer offers: one card per option, except an option where you pick a stage
   * (reassign), which becomes one card per stage it could move to.
   */
  const choicesOf = (a: ActionV, picks: string[]) => a.options.flatMap(o => o.pickStage
    ? v.funnel.filter(st => !picks.some(id => member(id)?.stage === st.key)).map(st => ({ id: `${o.key}@${st.key}`, option: o, stage: st.key as string | null }))
    : [{ id: o.key, option: o, stage: null as string | null }]);
  const limits = (a: ActionV, choice: { option: ActionV['options'][number] } | undefined) => choice?.option.targets ?? a.targets;

  const pick = (key: string, memberId: string | null) => {
    const a = action(key);
    if (!a || styling) return;
    ui.openPanel('none');
    const picks = memberId ? [memberId] : [];
    const choices = choicesOf(a, picks);
    setFlow({ key, choice: choices.length === 1 ? choices[0].id : null, picks, nudgeOk: false });
  };
  const tile = (key: string, memberId: string | null): ActionTileProps => {
    const a = action(key)!;
    const b = styling ? { reason: 'locked' as const, text: t('board.error', { code: 'wrongPhase' }) } : block(memberId ? a.blockedFor[memberId] ?? null : a.blocked);
    return { name: a.name, kind: a.kind, days: a.cost, block: b, onPick: () => { if (!b) pick(key, memberId); } };
  };

  const f = flow, fa = f ? action(f.key) : undefined;
  const choices = f && fa ? choicesOf(fa, f.picks) : [];
  const choice = f && f.choice !== null ? choices.find(c => c.id === f.choice) : undefined;
  const [minPick, maxPick] = fa ? limits(fa, choice) : [0, 0];
  const picking = !!(f && fa && maxPick > 0 && (fa.scope === 'team' || maxPick > 1 || f.picks.length === 0));
  const selected = ui.selectedIds[0] ?? null;

  /** Why someone cannot be picked for the action being planned, worded, or undefined. */
  const ineligible = (m: MemberView): string | undefined => {
    if (!f || !fa) return undefined;
    const b = fa.scope === 'member' ? fa.blockedFor[m.id] ?? null : m.away ? { reason: 'away' as const, kind: m.awayReason ?? 'leave', for: m.away } : null;
    if (b) return blockLine(b);
    if (choice?.option.distinctStages && !f.picks.includes(m.id)) {
      const same = f.picks.map(id => member(id)).find(p => p?.stage === m.stage);
      if (same) return t('board.pick.sameStage', { name: first(same.name) });
    }
    return undefined;
  };

  const clickCard = (m: MemberView) => {
    if (picking && f && fa) {
      if (ineligible(m)) return;
      const has = f.picks.includes(m.id);
      let picks = has ? f.picks.filter(x => x !== m.id) : [...f.picks, m.id];
      if (picks.length > maxPick) picks = picks.slice(picks.length - maxPick);
      setFlow({ ...f, picks, nudgeOk: false });
      return;
    }
    setFlow(null);
    ui.toggleMember(m.id);
  };

  const styleOf = (m: MemberView) => (styling ? draft[m.id] ?? null : m.style);
  const columns: StageColumn[] = v.funnel.map(st => ({
    key: st.key, name: st.name, count: st.members, ideal: st.ideal, bottleneck: st.bottleneck,
    cards: v.members.filter(m => m.stage === st.key).map(m => ({
      id: m.id, name: m.name, title: m.title, img: img(m), mood: m.mood, away: m.away > 0,
      skill: m.skill, morale: m.morale, result: m.result, trust: m.trust, statsHidden: !m.statsRevealed,
      style: styleOf(m), unread: m.unread, promise: m.promise ?? undefined,
      selected: picking && f ? f.picks.includes(m.id) : selected === m.id,
      unavailableReason: picking ? ineligible(m) : undefined,
      onSelect: () => clickCard(m),
      onOpenProfile: () => openProfile(m.id),
      onStyleChange: (k: StyleKey) => { if (styling) setDraft(d => ({ ...d, [m.id]: k })); else say(t('board.style.locked', { unit: periodUnit })); }
    }))
  }));

  const openProfile = (id: string) => {
    setFlow(null);
    if (selected !== id) ui.toggleMember(id);
    ui.openPanel('profile', id);
    if (!member(id)?.statsRevealed) void send({ type: 'openProfile', memberId: id });
  };

  // ---- profile: everything the engine logged with this person, newest first ----
  const pm = ui.panel === 'profile' && ui.profileId ? member(ui.profileId) : undefined;
  let profile: ProfilePanelProps | null = null;
  if (pm) {
    const fact = (x: string | null | undefined) => (x && x.trim() ? x : null);
    profile = {
      name: pm.name, title: pm.title, img: img(pm), mood: pm.mood, away: pm.away > 0,
      stats: { skill: pm.skill, morale: pm.morale, result: pm.result, trust: pm.trust }, style: pm.style,
      facts: [
        { key: 'previous', value: fact(pm.profile.previous) }, { key: 'tenure', value: fact(pm.profile.tenure) },
        { key: 'experience', value: fact(pm.profile.experience) }, { key: 'skills', value: fact(pm.profile.skills) },
        { key: 'remarks', value: fact(pm.profile.remarks) }, { key: 'careerGoal', value: pm.careerGoal },
        { key: 'relationships', value: fact(pm.profile.relations) }
      ],
      shared: pm.shared, periodUnit, subPeriodUnit: unit,
      timeline: v.history.filter(l => l.memberIds.includes(pm.id) || (l.memberIds.length === 0 && l.kind !== 'periodEnd')).slice().reverse().map(l => {
        const mine = l.changes.filter((c): c is typeof c & { metric: MetricKey } => c.subject === pm.id && c.metric !== 'confidence');
        const net = mine.reduce((a, c) => a + c.delta, 0);
        return { id: l.id, when: { period: l.period, sub: Math.min(l.sub + 1, v.clock.capacity) }, title: l.title, quote: l.quote, tone: net > 0 ? 'pos' : net < 0 ? 'neg' : 'neutral', changes: mine.map(c => ({ metric: c.metric, delta: c.delta })) };
      }),
      promises: v.promises.filter(x => x.memberId === pm.id).map(x => ({ text: x.text, status: x.state })),
      actions: v.actions.filter(a => a.scope === 'member').map(a => tile(a.key, pm.id)),
      onClose: () => ui.openPanel('none')
    };
  }

  const chosen = v.members.filter(m => draft[m.id]).length;
  const confirmStyles = () => { if (chosen === v.members.length) void send({ type: 'confirmStyles', styles: draft }); };

  // ---- action drawer ----
  let drawer: ActionDrawerProps | null = null;
  if (f && fa) {
    const names = f.picks.map(id => first(member(id)?.name ?? ''));
    const list = names.length > 1 ? t('action.list.pair', { rest: names.slice(0, -1).join(', '), last: names[names.length - 1] }) : names[0] ?? '';
    const cost = choice?.option.cost ?? fa.cost;
    const label = (c: (typeof choices)[number]) => (c.stage ? t('board.option.moveTo', { stage: stageName(c.stage) }) : c.option.label);
    const detail = (c: (typeof choices)[number]) => [
      c.option.blocked ? blockLine(c.option.blocked) : '',
      c.option.cost !== fa.cost ? t('board.option.cost', { cost: amount(c.option.cost) }) : '',
      c.option.away ? t('board.option.away', { amount: amount(c.option.away) }) : '',
      c.option.targets ? t('board.option.people', { n: c.option.targets[1], distinct: c.option.distinctStages ? 'yes' : 'no' }) : ''
    ].filter(Boolean).join(' ');

    // Prerequisite nudge (spec): where each picked person would move, and whether they were assessed for it.
    const pre = fa.prerequisite ? action(fa.prerequisite) : undefined;
    const destination = (id: string): string | null => {
      if (choice?.stage) return choice.stage;
      if (choice?.option.distinctStages && f.picks.length === 2) return member(f.picks.find(x => x !== id)!)?.stage ?? null;
      return null;
    };
    const unassessed = pre && !f.nudgeOk ? f.picks.map(id => ({ m: member(id)!, to: destination(id) })).find(x => x.m && x.to && !x.m.assessedStages.includes(x.to)) : undefined;

    const isStatic = fa.kind !== 'live';
    drawer = {
      name: fa.name, kind: fa.kind, days: cost, description: fa.description,
      options: choices.length > 1 ? choices.map(c => ({ name: label(c), detail: detail(c) })) : undefined,
      option: choice ? choices.indexOf(choice) : null, onOption: i => setFlow({ ...f, choice: choices[i].id, nudgeOk: false }),
      people: picking ? { mode: 'pick', max: maxPick, limit: minPick === maxPick ? t('board.pick.exact', { n: maxPick }) : t('board.pick.range', { min: minPick, max: maxPick }) } : f.picks.length ? { mode: 'with' } : { mode: 'who' },
      picks: f.picks.map(id => { const m = member(id); return { id, name: m?.name ?? '', img: img(m) }; }),
      nudge: unassessed && pre ? {
        name: first(unassessed.m.name), area: stageName(unassessed.to!), days: pre.cost,
        onAssess: async () => {
          const r = await send({ type: 'planAction', action: pre.key, memberIds: [unassessed.m.id], stage: unassessed.to! });
          if (r) say(t('action.toast.assessed', { name: first(unassessed.m.name), area: stageName(unassessed.to!), cost: amount(pre.cost) }));
        },
        onContinue: () => setFlow({ ...f, nudgeOk: true })
      } : undefined,
      summary: t('board.summary', { action: fa.name, option: isStatic && choice && choices.length > 1 ? label(choice) : 'none', list: list || 'none', cost: amount(cost) }),
      cta: fa.kind === 'static' ? 'confirm' : fa.format === 'email' ? 'composer' : 'start',
      canConfirm: !busy && !unassessed && f.picks.length >= minPick && f.picks.length <= maxPick && (choices.length <= 1 || !!choice) && !choice?.option.blocked,
      onConfirm: async () => {
        const r = await send({ type: 'planAction', action: fa.key, option: choice?.option.key, memberIds: f.picks, stage: choice?.stage ?? undefined });
        if (!r) return;
        setFlow(null);
        if (r.interactionId) { setLiveTitle(t('board.composer.title', { action: fa.name, name: names.length === 1 ? names[0] : 'none' })); ui.setInteraction(r.interactionId); }
        else say(t('board.planned', { action: fa.name }));
      },
      onBack: () => setFlow(null)
    };
  }

  // ---- live interaction (text composer until the M4 live shell) ----
  const iid = ui.interactionId;
  const submit = async (text: string) => {
    if (!iid) return;
    const r = await send({ type: 'submitInteraction', interactionId: iid, text });
    if (r) ui.setInteraction(null);
  };
  const composer = iid ? <Composer key={iid} title={liveTitle} busy={busy} onSubmit={text => void submit(text)} /> : null;

  // ---- inbox ----
  const inbox = v.inbox.filter(x => !readIds.includes(x.id));
  const sender = (from: string): InboxSender => (from === 'sponsor' ? { kind: 'sponsor', initials: v.sponsor.name.split(' ').map(w => w[0]).join('').slice(0, 2) } : from === 'news' ? { kind: 'news' } : { kind: 'member', img: img(member(from)) });
  const openMessage = async (id: string) => {
    const msg = v.inbox.find(x => x.id === id);
    ui.openPanel('none');
    if (!msg) return;
    if (msg.kind === 'news') { setReadIds(r => [...r, id]); return; }
    const r = await send({ type: 'openConversation', kind: msg.from === 'sponsor' ? 'sponsor' : 'reply', messageId: id });
    if (r?.interactionId) { setFlow(null); setLiveTitle(t('inbox.tag', { type: msg.kind, name: msg.from === 'sponsor' ? first(v.sponsor.name) : first(member(msg.from)?.name ?? '') })); ui.setInteraction(r.interactionId); }
  };
  const railItems: InboxRailItem[] = inbox.map(x => ({ id: x.id, label: x.title, sender: sender(x.from), urgent: x.urgent }));
  const drawerItems: InboxDrawerItem[] = inbox.map(x => ({
    id: x.id, sender: sender(x.from), title: x.title, preview: x.body, meta: '', urgent: x.urgent,
    due: x.dueInSubPeriods === null ? null : t('board.due', { amount: amount(x.dueInSubPeriods) }),
    tag: t('inbox.tag', { type: x.kind, name: x.from === 'sponsor' ? first(v.sponsor.name) : x.from === 'news' ? '' : first(member(x.from)?.name ?? '') }),
    cta: x.kind === 'news' ? 'impact' : 'reply'
  }));

  // ---- HUD and strip ----
  const periods = v.clock.periods;
  const hud: HudProps = {
    clientLogo: app.client, nav: [], onNav: () => undefined,
    clock: { period: v.clock.period, periodUnit, subPeriod: v.clock.subPeriod, subPeriodUnit: unit, capacity: v.clock.capacity, capacityLeft: v.clock.capacityLeft },
    sessionClock: null, onPause: app.onPause,
    score: { total: v.score.total, business: v.score.business, people: v.score.people, leadership: v.score.leadership, periodMax: v.score.periodMax },
    pillarScale: v.score.periodMax * periods, scoreOpen, onScoreOpenChange: setScoreOpen,
    streak: v.streak, onPalette: () => { setQuery(''); setPal(true); }, onSettings: app.onSettings,
    onEndPeriod: () => { if (!styling && !busy) void send({ type: 'endPeriod' }); },
    endEmphasis: f || styling ? 'secondary' : 'primary'
  };
  const elapsed = (v.clock.period - 1 + (v.clock.subPeriod - 1) / Math.max(1, v.clock.capacity)) / periods;
  const strip: MetricsStripProps = {
    kpis: v.kpis.map(k => ({ metric: k.metric, value: k.value, trend: { kind: 'direction', direction: k.value > k.start ? 'up' : k.value < k.start ? 'down' : 'flat' } })),
    pulse: v.pulse,
    target: { label: t('board.target', { n: periods, unit: periodUnit }), value: v.money.value, target: v.money.target, pace: Math.min(1, elapsed), pacePeriod: { unit: periodUnit, n: v.clock.period } },
    sponsor: { level: v.sponsor.level, causes: v.sponsor.causes, open: sponsorOpen, onToggle: () => setSponsorOpen(o => !o) }
  };

  // ---- outcome ----
  const oc = v.outcome;
  const person = (id: string): OutcomePerson => {
    const m = member(id);
    return m ? { id, name: m.name, shortName: first(m.name), img: img(m) } : { id, name: v.sponsor.name, shortName: first(v.sponsor.name), img: v.sponsor.img ?? PLACEHOLDER };
  };
  const outcome = oc && (() => {
    const who = person(oc.speaker);
    const lead = oc.changes.find(c => c.reason.evidence.length) ?? oc.changes[0];
    const shown = oc.changes.filter((c): c is typeof c & { metric: MetricKey } => c.metric !== 'confidence' && !!member(c.subject));
    return (
      <OutcomePanel
        person={who} headline={oc.headline} reply={oc.reply} onReplay={() => undefined}
        why={{ cause: lead?.reason.cause ?? '', rule: lead?.reason.rule ?? '', evidence: lead?.reason.evidence.map(e => e.quote).join(' ') ?? '', judgedByAI: !!lead?.reason.evidence.some(e => e.judgedByAI) }}
        whyOpen={ui.whyOpen === oc.id} onToggleWhy={() => ui.setWhy(ui.whyOpen === oc.id ? null : oc.id)}
        affected={oc.affected.map(person)} revealed={reveal}
        reaction={reveal && oc.reactions[reveal] ? { name: first(person(reveal).name), text: oc.reactions[reveal] } : undefined}
        onReveal={id => setReveal(r => (r === id ? null : id))}
        changes={teamChips(shown, v.members.length).map(c => ({ name: chipName(c), metric: c.metric, delta: c.delta }))}
        showNumbers={ui.showNumbers} onToggleNumbers={() => ui.setShowNumbers(!ui.showNumbers)}
        ripple={oc.ripple ?? ''} changed={oc.changed}
        onDismiss={() => { setReveal(null); void send({ type: 'clearOutcome' }); }} onOpenHistory={() => undefined}
      />
    );
  })();

  // ---- palette ----
  const needle = query.trim().toLowerCase();
  const palette: PaletteResult[] = [
    ...v.members.map(m => ({ id: 'member:' + m.id, name: m.name, detail: m.title, img: img(m), tone: (m.away ? 'away' : m.mood === 'concerned' || m.mood === 'frustrated' ? 'warm' : 'calm') as PaletteResult['tone'],
      onRun: () => { setPal(false); setFlow(null); if (selected !== m.id) ui.toggleMember(m.id); } })),
    ...v.actions.filter(a => a.scope === 'team').map(a => ({ id: 'action:' + a.key, name: a.name, detail: amount(a.cost), tone: 'brand' as const,
      onRun: () => { setPal(false); tile(a.key, null).onPick(); } }))
  ].filter(i => !needle || i.name.toLowerCase().includes(needle)).slice(0, 9);

  const sm = selected ? member(selected) : undefined;
  const hint: TeamBoardHint = picking ? { kind: 'picking' } : sm ? { kind: 'selected', name: sm.name } : { kind: 'idle' };
  const card = v.cards[0];

  return (
    <div aria-label={t('board.aria')} className="relative flex flex-1 flex-col">
      <Hud {...hud} />
      <MetricsStrip {...strip} />
      {styling && (
        <div role="region" aria-label={t('board.style.confirm')} className="mx-6 mb-3 flex items-center gap-4 rounded-18 border border-accent-secondary bg-surface-card px-4 py-3">
          <div className="flex flex-1 flex-col">
            <b className="text-15">{t('board.style.title', { unit: periodUnit })}</b>
            <span className="text-13 text-fg-secondary">{t('board.style.body', { done: chosen, total: v.members.length })}</span>
          </div>
          <Button variant="primary" size="md" disabled={chosen < v.members.length || busy} onClick={confirmStyles}>{t('board.style.confirm')}</Button>
        </div>
      )}
      {outcome}
      <div className="relative grid min-h-0 flex-1 grid-cols-(--il-board-columns)">
        {/* Tab order follows the spec: HUD, team board, actions, then inbox. The grid places the rail first. */}
        <div className="col-start-2 row-start-1 flex min-h-0 min-w-0 flex-col"><TeamBoard hint={hint} legendOpen={legend} onToggleLegend={() => setLegend(l => !l)} periodUnit={periodUnit} columns={columns} /></div>
        <div className="col-start-3 row-start-1 flex min-h-0 flex-col"><ActionsPanel
          capacityLeft={v.clock.capacityLeft} capacity={v.clock.capacity} subPeriodUnit={unit} periodUnit={periodUnit} outOfCapacity={!styling && v.clock.capacityLeft <= 0}
          team={v.actions.filter(a => a.scope === 'team').map(a => tile(a.key, null))}
          member={sm ? { firstName: first(sm.name), tiles: v.actions.filter(a => a.scope === 'member').map(a => tile(a.key, sm.id)) } : null}
          drawer={composer ?? (drawer ? <ActionDrawer {...drawer} /> : undefined)}
        /></div>
        <div className="col-start-1 row-start-1 flex min-h-0 flex-col"><InboxRail unread={inbox.length} items={railItems} onToggle={() => ui.openPanel(ui.panel === 'inbox' ? 'none' : 'inbox')} onOpen={id => void openMessage(id)} /></div>
        {profile && <ProfilePanel {...profile} />}
        <InboxDrawer open={ui.panel === 'inbox'} subPeriodUnit={unit} items={drawerItems} sponsorName={first(v.sponsor.name)}
          onClose={() => ui.openPanel('none')} onOpen={id => void openMessage(id)} onLater={id => setReadIds(r => [...r, id])} />
      </div>
      {card && !oc && <EventCard card={card} busy={busy} nameOf={chipName} everyone={v.members.length} onDismiss={() => void send({ type: 'dismissCard', cardId: card.id })} />}
      {(v.phase === 'periodEnd' || v.phase === 'ended') && <PeriodPanel view={v} busy={busy} money={money.format} onIntent={i => void send(i)} />}
      <CommandPalette open={pal} onClose={() => setPal(false)} query={query} onQueryChange={setQuery} results={palette} />
      <Toast message={toast} />
    </div>
  );
}
