/**
 * Assessment verdicts (D75, rules in D76). Pure functions of levels on the storyline's rating scale, so
 * the server, the individual report and the group report agree. The bar is `report.assessment.bar`:
 * `overall`, the overall level the role expects, and `floor`, the lowest level any one skill may show.
 *
 * - Exceeds the bar: the overall level is above the bar, and no rated skill is below the bar's level.
 * - Meets the bar: the overall level is at or above the bar, and no rated skill is below the floor.
 * - Approaching the bar: one level short overall at most, and at most one rated skill below the floor.
 * - Below the bar: anything else.
 * - No verdict without an overall level (not enough evidence).
 *
 * Per skill: Strength above the bar's level, Meets at it, Development need below it; none when unrated.
 * Report only skills (a secondary lens) get no verdict and never count towards one.
 */

export type VerdictKey = 'exceeds' | 'meets' | 'approaching' | 'below';
export type SkillVerdictKey = 'strength' | 'meets' | 'development';
export interface Bar { overall: number; floor: number }

export function overallVerdict(level: number | null, skillLevels: Array<number | null>, bar: Bar): VerdictKey | null {
  if (level === null) return null;
  const rated = skillLevels.filter((l): l is number => l !== null);
  const underFloor = rated.filter(l => l < bar.floor).length;
  if (level > bar.overall && rated.every(l => l >= bar.overall)) return 'exceeds';
  if (level >= bar.overall && underFloor === 0) return 'meets';
  if (level >= bar.overall - 1 && underFloor <= 1) return 'approaching';
  return 'below';
}

export function skillVerdict(level: number | null, bar: Bar): SkillVerdictKey | null {
  if (level === null) return null;
  return level > bar.overall ? 'strength' : level === bar.overall ? 'meets' : 'development';
}
