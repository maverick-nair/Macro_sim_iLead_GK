/**
 * The game store. It owns the clock (the engine never reads time), runs the round machine on every
 * tick, fires AI calls on phase entry, saves after every change and syncs results for the league.
 */
import { create } from "zustand";
import type { PromiseItem, Turn } from "../../shared/ai-contract.ts";
import type { Content, LoadedRound, OptionId } from "../../shared/content-schema.ts";
import * as ai from "../ai/client.ts";
import {
  commitRound,
  evidenceFor,
  leadershipScore,
  resolveRound,
  revealsDue,
} from "../engine/consequences.ts";
import { computeLeague, type SquadResults, type Standing } from "../engine/league.ts";
import { clockSeconds, type RoundEvent, startRound, step } from "../engine/round-machine.ts";
import { combinePasses, needsTieBreak } from "../engine/rubric.ts";
import { captainFor, type FixtureContext, newSeason, nextPlayableRound } from "../engine/season.ts";
import type { Member, PlanDraft, Reveal, RoundRecord, SeasonState, TrustResult } from "../engine/types.ts";
import { localStore, type SquadStorage } from "./storage.ts";
import { cue } from "../components/sound.ts";

export type Squad = Content["squads"]["squads"][number];

export function ksaTime(ms: number): string {
  return new Date(ms + 3 * 3600_000).toISOString().replace(/\.\d+Z$/, "+03:00");
}

interface GameState {
  content: Content;
  unlockAt: Record<number, number>;
  storage: SquadStorage;
  aiMode: "live" | "mock";
  demo: boolean;
  now: number;
  squad: Squad | null;
  season: SeasonState | null;
  unlockOverride: boolean;
  muted: boolean;
  reducedMotion: boolean;
  thinking: boolean;
  scoringStatus: string | null;
  challengeBusy: boolean;
  remoteResults: Record<string, SquadResults>;
  previousOrder: string[];
  breaking: Reveal | null;

  init(): Promise<void>;
  tick(): void;
  checkIn(code: string): string | null;
  signOut(): void;
  confirmRoster(members: Member[], matchday: number): void;
  setUnlockOverride(v: boolean): void;
  setMuted(v: boolean): void;
  setReducedMotion(v: boolean): void;
  kickOff(): void;
  dispatch(event: RoundEvent): void;
  updatePlan(plan: PlanDraft): void;
  sendTurn(speaker: string, text: string): Promise<void>;
  challenge(target: "plan" | "trust"): Promise<void>;
  dismissBreaking(): void;
  standings(): Standing[];
  fixtureContext(): FixtureContext;
  currentRound(): LoadedRound | null;
}

const audit = (s: SeasonState, now: number, kind: string, detail: string): SeasonState => ({
  ...s,
  audit: [...s.audit, { at: ksaTime(now), kind, detail }].slice(-500),
});

export function promisesFrom(plan: PlanDraft): PromiseItem[] {
  return plan.actions.filter((a) => a.action.trim());
}

function squadResultsFor(squad: Squad, season: SeasonState): SquadResults {
  const rounds: SquadResults["rounds"] = {};
  for (const [k, r] of Object.entries(season.records))
    rounds[k] = { decisionPoints: r.decisionPoints, planScore: r.planScore, trust: r.trust?.average ?? 0 };
  return { squadId: squad.id, name: squad.name, colour: squad.colour, rounds };
}

export const useGame = create<GameState>()((set, get) => {
  const save = (season: SeasonState) => {
    get().storage.save(season);
    set({ season });
  };

  const history = (season: SeasonState, content: Content): string[] =>
    Object.values(season.records).map((r) => {
      const round = content.rounds.rounds[r.round - 1];
      const opt = round?.loaded ? round.options.find((o) => o.id === r.decision) : undefined;
      return `Round ${r.round} (${round?.title ?? ""}): ${opt ? `chose ${opt.id}, ${opt.text}` : "no play called"}`;
    });

  const chatRequest = (round: LoadedRound, season: SeasonState, transcript: Turn[]) => {
    const { content } = get();
    const live = season.live!;
    const opt = round.options.find((o) => o.id === live.plan.decision);
    return {
      character: content.characters[round.character]!,
      round: {
        number: round.round,
        title: round.title,
        scenario: round.scenario,
        prompt: round.prompt,
        inject: round.inject.text,
      },
      decision: opt ? { id: opt.id, text: opt.text } : null,
      clientMessage: live.plan.clientMessage,
      promises: promisesFrom(live.plan),
      history: history(season, content),
      transcript,
    };
  };

  const characterOpens = async () => {
    const { season } = get();
    const round = get().currentRound();
    if (!season?.live || !round || season.live.transcript.length > 0) return;
    set({ thinking: true });
    const out = await ai.chat(chatRequest(round, season, []));
    set({ thinking: false });
    const now = Date.now();
    get().dispatch({
      type: "ADD_TURN",
      turn: { who: "character", speaker: round.character, text: out.reply, at: ksaTime(now) },
    });
  };

  const syncResults = async (extra?: { breaking?: unknown; trust?: unknown }) => {
    const { squad, season, storage } = get();
    if (!squad || !season) return;
    const body = { squadId: squad.id, results: squadResultsFor(squad, season), ...extra };
    const queue = [...storage.getQueue(), body];
    const remaining: unknown[] = [];
    for (const item of queue) if (!(await ai.pushResults(item))) remaining.push(item);
    storage.setQueue(remaining.slice(-20));
    void refreshRemote();
  };

  const refreshRemote = async () => {
    const data = await ai.fetchResults();
    if (!data) return;
    const remote: Record<string, SquadResults> = {};
    for (const [id, r] of Object.entries(data.results))
      if (r && typeof r === "object") remote[id] = r as SquadResults;
    set({ remoteResults: remote });
  };

  const runScoring = async () => {
    const { content, season } = get();
    const round = get().currentRound();
    if (!season?.live || !round) return;
    const live = season.live;
    const opt = round.options.find((o) => o.id === live.plan.decision) ?? null;
    const evidence = evidenceFor(round, season);
    const planReq = (pass: number) => ({
      roundNumber: round.round,
      roundTitle: round.title,
      scenario: round.scenario,
      prompt: round.prompt,
      evidence: evidence.map((e) => `${e.title}: ${e.text}`),
      lines: content.rubric.lines,
      lineMax: content.rubric.lineMax,
      plan: {
        headings: round.planHeadings.map((h, i) => ({ heading: h, text: live.plan.headings[i] ?? "" })),
        actions: promisesFrom(live.plan),
        clientMessage: live.plan.clientMessage,
        decision: opt ? { id: opt.id, text: opt.text } : null,
      },
      pass,
    });
    const character = content.characters[round.character]!;
    const trustReq = {
      character,
      behaviors: content.trustMeter.behaviors,
      promises: promisesFrom(live.plan),
      transcript: live.transcript,
      roundTitle: round.title,
    };

    set({ scoringStatus: "The scorers are reviewing the plan and the call" });
    const [p1, p2, t] = await Promise.all([
      ai.scorePlan(planReq(1)),
      ai.scorePlan(planReq(2)),
      ai.scoreTrust(trustReq),
    ]);
    const passes = [p1.pass, p2.pass];
    let modeUsed = p1.mode === "live" && p2.mode === "live" ? "live" : "mock";
    if (needsTieBreak(p1.pass, p2.pass, content.rubric.tieBreakGap)) {
      set({ scoringStatus: "The scorers disagree. A third pass settles it" });
      const p3 = await ai.scorePlan(planReq(3));
      passes.push(p3.pass);
      if (p3.mode !== "live") modeUsed = "mock";
    }
    const zeroByDecision = opt?.effects.zeroPlan === true;
    const rubric = combinePasses(passes, content.rubric, round.round, {
      zeroByDecision,
      scorer: modeUsed === "live" ? "AI rubric scorer" : "Demo AI rubric scorer",
    });
    const trust: TrustResult = {
      behaviors: t.score.behaviors,
      average:
        Math.round((t.score.behaviors.reduce((s, b) => s + b.score, 0) / t.score.behaviors.length) * 10) / 10,
      verdict: t.score.verdict,
      scorer:
        t.mode === "live" ? `${character.name}, AI Trust Meter` : `${character.name}, Demo AI Trust Meter`,
    };

    const latest = get().season;
    if (!latest?.live) return;
    const now = Date.now();
    const outcome = resolveRound(
      latest,
      { round, decision: live.plan.decision, planScore: rubric.total },
      content.consequence,
    );
    const record: RoundRecord = {
      round: round.round,
      decision: live.plan.decision,
      decisionPoints: outcome.decisionPoints,
      planScore: outcome.planScore,
      rubric,
      trust,
      metricsBefore: latest.metrics,
      metricsAfter: outcome.metricsAfter,
      promises: promisesFrom(live.plan),
      transcript: live.transcript,
      autoSubmitted: live.autoSubmitted,
      challenge: null,
      captain: captainFor(latest.roster, round.round)?.name ?? "",
      completedAt: ksaTime(now),
    };
    let next = commitRound(latest, record, outcome, content.consequence);
    next = audit(
      next,
      now,
      "score",
      `Round ${round.round}: decision ${outcome.decisionPoints}, plan ${outcome.planScore} (${rubric.scorer}), trust ${trust.average}`,
    );
    set({
      previousOrder: get()
        .standings()
        .map((s) => s.squadId),
      scoringStatus: null,
    });
    save(next);
    get().dispatch({ type: "SCORED", now });
    cue("whistle", get().muted);
    void syncResults({
      trust: { squad: get().squad?.name, round: round.round, average: trust.average, verdict: trust.verdict },
    });
  };

  const onEnter = (phase: string) => {
    if (phase === "LOCKED_IN") {
      const s = get().season!;
      save(
        audit(
          s,
          Date.now(),
          "decision",
          `Round ${s.live!.round}: ${s.live!.plan.decision ?? "no play"}${s.live!.autoSubmitted ? " (auto-submitted)" : ""}`,
        ),
      );
    }
    if (phase === "INJECT") cue("reveal", get().muted);
    if (phase === "ON_AIR") void characterOpens();
    if (phase === "SCORING") void runScoring();
  };

  return {
    content: undefined as unknown as Content,
    unlockAt: {},
    storage: localStore,
    aiMode: "mock",
    demo: true,
    now: Date.now(),
    squad: null,
    season: null,
    unlockOverride: false,
    muted: true,
    reducedMotion: false,
    thinking: false,
    scoringStatus: null,
    challengeBusy: false,
    remoteResults: {},
    previousOrder: [],
    breaking: null,

    async init() {
      const { storage } = get();
      set({
        muted: storage.getSetting("muted", true),
        reducedMotion: storage.getSetting("reducedMotion", false),
        unlockOverride: storage.getSetting("unlockOverride", false),
      });
      const current = storage.currentSquad();
      if (current) {
        const squad = get().content.squads.squads.find((s) => s.id === current) ?? null;
        const season = squad ? storage.load(squad.id) : null;
        if (squad && season) set({ squad, season });
      }
      const h = await ai.health();
      set({ aiMode: h.mode, demo: h.demo, unlockOverride: h.demo ? get().unlockOverride : false });
      void refreshRemote();
      // Resume: a call that was mid-scoring when the device went away is scored again.
      const s = get().season;
      if (s?.live?.phase === "SCORING") void runScoring();
      if (s?.live?.phase === "ON_AIR" && s.live.transcript.length === 0) void characterOpens();
    },

    tick() {
      const now = Date.now();
      set({ now });
      const { season } = get();
      if (season?.live) get().dispatch({ type: "TICK", now });
      if (Math.floor(now / 1000) % 15 === 0) {
        if (get().storage.getQueue().length) void syncResults();
        else void refreshRemote();
      }
    },

    checkIn(code) {
      const { content, storage } = get();
      const squad = content.squads.squads.find(
        (s) => s.code.toUpperCase() === code.trim().toUpperCase() && !s.bot,
      );
      if (!squad) return "That squad code is not recognised. Check the card and try again.";
      const season = storage.load(squad.id) ?? newSeason(squad.id, content);
      storage.setCurrentSquad(squad.id);
      storage.save(season);
      set({ squad, season });
      return null;
    },

    signOut() {
      get().storage.setCurrentSquad(null);
      set({ squad: null, season: null });
    },

    confirmRoster(members, matchday) {
      const s = get().season;
      if (!s) return;
      const now = Date.now();
      save(
        audit(
          { ...s, roster: members, checkins: { ...s.checkins, [String(matchday)]: members } },
          now,
          "check-in",
          `Matchday ${matchday}: ${members.map((m) => `${m.name} (${m.role})`).join(", ")}`,
        ),
      );
    },

    setUnlockOverride(v) {
      if (!get().demo) return;
      get().storage.setSetting("unlockOverride", v);
      set({ unlockOverride: v });
    },
    setMuted(v) {
      get().storage.setSetting("muted", v);
      set({ muted: v });
    },
    setReducedMotion(v) {
      get().storage.setSetting("reducedMotion", v);
      set({ reducedMotion: v });
    },

    kickOff() {
      const { season, content } = get();
      if (!season || season.live) return;
      const r = nextPlayableRound(content, season, get().fixtureContext());
      if (!r || !r.loaded) return;
      const now = Date.now();
      let next: SeasonState = { ...season, live: startRound(r.round, r.planMinutes, now) };
      next = audit(next, now, "kick-off", `Round ${r.round}: ${r.title}`);
      const due = revealsDue(next, r.round);
      if (due.length) {
        next = { ...next, reveals: next.reveals.map((x) => (due.includes(x) ? { ...x, shown: true } : x)) };
        set({ breaking: due[0] ?? null });
        void syncResults({ breaking: due[0] });
      }
      save(next);
      cue("kickoff", get().muted);
    },

    dispatch(event) {
      const { season, content } = get();
      if (!season?.live) return;
      const round = content.rounds.rounds[season.live.round - 1];
      const ctx = { timers: content.schedule.timers, onAirMinutes: round?.loaded ? round.onAirMinutes : 6 };
      const before = season.live.phase;
      const live = step(season.live, event, ctx);
      if (live === season.live) return;
      save({ ...season, live });
      if (live && live.phase !== before) onEnter(live.phase);
      if (!live) void refreshRemote();
    },

    updatePlan(plan) {
      get().dispatch({ type: "UPDATE_PLAN", plan });
    },

    async sendTurn(speaker, text) {
      const { season } = get();
      const round = get().currentRound();
      if (!season?.live || season.live.phase !== "ON_AIR" || !round || !text.trim()) return;
      const now = Date.now();
      get().dispatch({
        type: "ADD_TURN",
        turn: { who: "squad", speaker, text: text.trim(), at: ksaTime(now) },
      });
      const after = get().season!;
      set({ thinking: true });
      const out = await ai.chat(chatRequest(round, after, after.live!.transcript));
      set({ thinking: false });
      get().dispatch({
        type: "ADD_TURN",
        turn: { who: "character", speaker: round.character, text: out.reply, at: ksaTime(Date.now()) },
      });
    },

    async challenge(target) {
      const { season, content } = get();
      const round = get().currentRound();
      if (!season?.live || !round) return;
      const record = season.records[String(round.round)];
      if (!record || record.challenge) return;
      set({ challengeBusy: true });
      const now = Date.now();
      let after = target === "plan" ? record.planScore : (record.trust?.average ?? 0);
      let patched: RoundRecord = record;
      if (target === "plan" && record.rubric) {
        if (record.rubric.zeroedBy === "decision") {
          after = 0;
        } else {
          const opt = round.options.find((o) => o.id === record.decision);
          const req = (pass: number) => ({
            roundNumber: round.round,
            roundTitle: round.title,
            scenario: round.scenario,
            prompt: round.prompt,
            evidence: evidenceFor(round, season).map((e) => `${e.title}: ${e.text}`),
            lines: content.rubric.lines,
            lineMax: content.rubric.lineMax,
            plan: {
              headings: round.planHeadings.map((h, i) => ({
                heading: h,
                text: season.live!.plan.headings[i] ?? "",
              })),
              actions: record.promises,
              clientMessage: season.live!.plan.clientMessage,
              decision: opt ? { id: opt.id, text: opt.text } : null,
            },
            pass,
          });
          const [a, b] = await Promise.all([ai.scorePlan(req(10)), ai.scorePlan(req(11))]);
          const fresh = combinePasses([a.pass, b.pass], content.rubric, round.round, {
            zeroByDecision: false,
            scorer: record.rubric.scorer.split(" / ")[0] ?? "",
          });
          after = fresh.total;
          patched = {
            ...record,
            planScore: after,
            rubric: { ...fresh, scorer: `${fresh.scorer} (challenge pass)` },
          };
        }
      } else if (target === "trust" && record.trust) {
        const t = await ai.scoreTrust({
          character: content.characters[round.character]!,
          behaviors: content.trustMeter.behaviors,
          promises: record.promises,
          transcript: record.transcript,
          roundTitle: round.title,
        });
        after =
          Math.round((t.score.behaviors.reduce((s, x) => s + x.score, 0) / t.score.behaviors.length) * 10) /
          10;
        patched = {
          ...record,
          trust: { ...record.trust, behaviors: t.score.behaviors, average: after, verdict: t.score.verdict },
        };
      }
      const before = target === "plan" ? record.planScore : (record.trust?.average ?? 0);
      patched = { ...patched, challenge: { target, before, after, at: ksaTime(now) } };
      const latest = get().season!;
      const delta = target === "plan" ? after - before : 0;
      let next: SeasonState = {
        ...latest,
        pointsEarned: latest.pointsEarned + delta,
        records: { ...latest.records, [String(round.round)]: patched },
      };
      next = audit(next, now, "challenge", `Round ${round.round} ${target}: ${before} to ${after} (final)`);
      save(next);
      set({ challengeBusy: false });
      void syncResults();
    },

    dismissBreaking() {
      set({ breaking: null });
    },

    standings() {
      const { content, squad, season, remoteResults, previousOrder } = get();
      const mine = squad && season ? squadResultsFor(squad, season) : null;
      const all: Record<string, SquadResults> = { ...remoteResults };
      if (mine) all[mine.squadId] = mine;
      const playedRounds = new Set(Object.values(all).flatMap((r) => Object.keys(r.rounds)));
      const rows: SquadResults[] = content.squads.squads.map((s) => {
        if (s.bot) {
          const fixed = content.squads.botResults[s.id] ?? {};
          const rounds = Object.fromEntries(Object.entries(fixed).filter(([k]) => playedRounds.has(k)));
          return { squadId: s.id, name: s.name, colour: s.colour, rounds, demo: true };
        }
        return all[s.id] ?? { squadId: s.id, name: s.name, colour: s.colour, rounds: {} };
      });
      return computeLeague(content.league, rows, previousOrder.length ? previousOrder : undefined);
    },

    fixtureContext() {
      const { unlockAt, now, unlockOverride, demo } = get();
      return { unlockAt, now, unlockOverride: demo && unlockOverride };
    },

    currentRound() {
      const { season, content } = get();
      const r = season?.live ? content.rounds.rounds[season.live.round - 1] : undefined;
      return r?.loaded ? r : null;
    },
  };
});

export function useClock(): number | null {
  return useGame((s) => clockSeconds(s.season?.live ?? null, s.now));
}

export function useLeadership(): number {
  return useGame((s) =>
    s.season ? leadershipScore(s.season.pointsEarned, s.season.pointsAvailable, s.content.consequence) : 50,
  );
}

export type { OptionId };
