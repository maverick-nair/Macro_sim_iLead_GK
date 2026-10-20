/**
 * Assessment verdicts (D75, rules in D76, amended by D169). Pure functions of levels on the storyline's rating
 * scale and the run's outcome gates, so the server, the individual report and the group report agree. The bar
 * is `report.assessment.bar`: `overall`, the overall level the role expects, and `floor`, the lowest level any
 * one skill may show. The overall level is the capped one (D168), and `gates` says what the outcomes did:
 *
 * - Exceeds the bar: the overall level is above the bar, no rated skill is below the bar's level, no outcome
 *   gate was triggered, business and people outcomes were both strong, and no core dimension is weak.
 * - Meets the bar: the overall level is at or above the bar (so no cap held it below the bar), no rated skill
 *   is below the floor, no outcome gate was triggered (business, people, stakeholders, decisions) and no core
 *   dimension is weak (the contradiction guard, D170).
 * - Approaching the bar: one level short overall at most, at most one rated skill below the floor, and no
 *   outcome gate holding the level below the bar.
 * - Below the bar: anything else.
 * - No verdict without an overall level (not enough evidence).
 *
 * Without `gates` (none triggered, strong outcomes) the rules are D76's.
 * Per skill: Strength above the bar's level, Meets at it, Development need below it; none when unrated.
 * Report only skills (a secondary lens) get no verdict and never count towards one.
 */

export type VerdictKey = 'exceeds' | 'meets' | 'approaching' | 'below';
export type SkillVerdictKey = 'strength' | 'meets' | 'development';
export interface Bar { overall: number; floor: number }
/** What the outcomes did (D169): an outcome gate triggered, one holding the level below the bar, business and people both strong, a core dimension weak. */
export interface VerdictGates { gated: boolean; belowBar: boolean; strong: boolean; contradicted: boolean }
const CLEAR: VerdictGates = { gated: false, belowBar: false, strong: true, contradicted: false };

export function overallVerdict(level: number | null, skillLevels: Array<number | null>, bar: Bar, gates: VerdictGates = CLEAR): VerdictKey | null {
  if (level === null) return null;
  const rated = skillLevels.filter((l): l is number => l !== null);
  const underFloor = rated.filter(l => l < bar.floor).length;
  const clear = !gates.gated && !gates.contradicted;
  if (level > bar.overall && rated.every(l => l >= bar.overall) && clear && gates.strong) return 'exceeds';
  if (level >= bar.overall && underFloor === 0 && clear) return 'meets';
  if (level >= bar.overall - 1 && underFloor <= 1 && !gates.belowBar) return 'approaching';
  return 'below';
}

export function skillVerdict(level: number | null, bar: Bar): SkillVerdictKey | null {
  if (level === null) return null;
  return level > bar.overall ? 'strength' : level === bar.overall ? 'meets' : 'development';
}
