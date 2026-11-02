/**
 * League table: v3.1 weights, pending categories marked, Trust Meter tie-break.
 * Each category is normalised to 0..1; a squad's points are the weighted sum over the
 * categories that have data, out of 100.
 */
import type { LeagueCategoryId, LeagueFile } from "../../shared/content-schema.ts";

export interface SquadRoundResult {
  decisionPoints: number;
  planScore: number;
  trust: number;
}

export interface SquadResults {
  squadId: string;
  name: string;
  colour: string;
  rounds: Record<string, SquadRoundResult>;
  /** Categories outside the rounds, each 0..1 once known (imported missions, boardroom, kudos and so on). */
  extra?: Partial<Record<LeagueCategoryId, number>>;
  demo?: boolean;
}

export interface Standing {
  squadId: string;
  name: string;
  colour: string;
  points: number;
  trustAverage: number;
  categories: {
    id: LeagueCategoryId;
    label: string;
    weight: number;
    value: number | null;
    points: number | null;
  }[];
  pending: LeagueCategoryId[];
  rank: number;
  movement: number;
  demo: boolean;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const r1 = (v: number) => Math.round(v * 10) / 10;

export function categoryValues(s: SquadResults): Partial<Record<LeagueCategoryId, number>> {
  const rounds = Object.values(s.rounds);
  const out: Partial<Record<LeagueCategoryId, number>> = { ...(s.extra ?? {}) };
  if (rounds.length) {
    out.plan = mean(rounds.map((r) => r.planScore)) / 20;
    out.trust = mean(rounds.map((r) => r.trust)) / 10;
    out.decisions = rounds.reduce((t, r) => t + r.decisionPoints, 0) / (10 * rounds.length);
  }
  return out;
}

export function computeLeague(league: LeagueFile, squads: SquadResults[], previous?: string[]): Standing[] {
  const rows = squads.map((s) => {
    const values = categoryValues(s);
    const categories = league.categories.map((c) => {
      const v = values[c.id];
      return {
        id: c.id,
        label: c.label,
        weight: c.weight,
        value: v ?? null,
        points: v === undefined ? null : r1(v * c.weight),
      };
    });
    return {
      squadId: s.squadId,
      name: s.name,
      colour: s.colour,
      points: r1(categories.reduce((t, c) => t + (c.points ?? 0), 0)),
      trustAverage: values.trust ?? 0,
      categories,
      pending: categories.filter((c) => c.value === null).map((c) => c.id),
      rank: 0,
      movement: 0,
      demo: s.demo ?? false,
    };
  });
  rows.sort((a, b) => b.points - a.points || b.trustAverage - a.trustAverage || a.name.localeCompare(b.name));
  return rows.map((row, i) => {
    const before = previous?.indexOf(row.squadId) ?? -1;
    return { ...row, rank: i + 1, movement: before >= 0 ? before - i : 0 };
  });
}
