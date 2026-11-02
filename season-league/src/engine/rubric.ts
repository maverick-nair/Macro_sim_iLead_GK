/**
 * Plan scoring rules. The AI scorer returns passes; these rules decide the score.
 * Two passes; a third when any line differs by more than the tie-break gap; zero for a control bypass.
 */
import type { RubricPass } from "../../shared/ai-contract.ts";
import type { RubricFile } from "../../shared/content-schema.ts";
import type { RubricResult } from "./types.ts";

export function needsTieBreak(a: RubricPass, b: RubricPass, gap: number): boolean {
  return a.lines.some((line, i) => Math.abs(line.score - (b.lines[i]?.score ?? line.score)) > gap);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? 0;
};

export function controlBypassApplies(rubric: RubricFile, round: number): boolean {
  const r = rubric.controlBypassZero.rounds;
  return r === "all" || r.includes(round);
}

/**
 * Combines two or three passes into one score.
 * Two passes: the mean per line, rounded half up. Three passes: the median per line.
 * Reasons come from the pass whose score is closest to the final line score.
 */
export function combinePasses(
  passes: RubricPass[],
  rubric: RubricFile,
  round: number,
  opts: { zeroByDecision: boolean; scorer: string },
): RubricResult {
  if (passes.length < 2) throw new Error("At least two scoring passes are needed");
  const lines = rubric.lines.map((def, i) => {
    const scores = passes.map((p) => p.lines[i]?.score ?? 0);
    const score =
      passes.length >= 3
        ? median(scores)
        : Math.floor(scores.reduce((s, x) => s + x, 0) / scores.length + 0.5);
    const closest = passes.reduce((best, p) =>
      Math.abs((p.lines[i]?.score ?? 0) - score) < Math.abs((best.lines[i]?.score ?? 0) - score) ? p : best,
    );
    return { id: def.id, score, reason: closest.lines[i]?.reason ?? "" };
  });

  const bypassVotes = passes.filter((p) => p.releasesPaymentWithoutAuthorizers).length;
  const bypass = controlBypassApplies(rubric, round) && bypassVotes * 2 > passes.length;
  const zeroedBy = opts.zeroByDecision ? "decision" : bypass ? "control-bypass" : null;
  const raw = lines.reduce((s, l) => s + l.score, 0);

  return {
    lines,
    tryThis: passes[0]?.tryThis ?? "",
    passes,
    total: zeroedBy ? 0 : raw,
    zeroedBy,
    scorer: `${opts.scorer} / ${rubric.meta.version}`,
  };
}
