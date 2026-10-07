import { parseStoryline, type Purpose, type StorylineConfig, type StorylineInput } from '../../../src/engine/config';
import salesElevator from '../../../src/engine/storylines/sales-elevator.json';
import { withSixStyles } from '../../../src/engine/storylines/sixStyles';
import type { Repository } from '../store';

/**
 * Storylines the server plays. Published versions come from the repository (GenieKreator publishes them
 * through `POST /api/admin/storylines`); the built in samples (version 0) stand in until then. A run keeps
 * a snapshot of its storyline input, so a later version never changes a run in progress or its replay.
 */
export const BUILT_IN: Record<string, () => StorylineInput> = {
  sales_elevator: () => structuredClone(salesElevator) as unknown as StorylineInput,
  sales_elevator_six_styles: () => ({ ...withSixStyles(structuredClone(salesElevator) as unknown as StorylineInput), id: 'sales_elevator_six_styles' })
};

export class StorylineError extends Error {
  constructor(message: string, readonly code: 'unknownStoryline' | 'badStoryline') { super(message); }
}

export interface ResolvedStoryline { id: string; version: number; input: StorylineInput; config: StorylineConfig }

/** Parses a snapshot (a run's stored input), throwing on issues. */
export function configOf(input: unknown): StorylineConfig {
  const r = parseStoryline(input);
  if (!r.ok) throw new StorylineError(r.issues.slice(0, 5).join('; '), 'badStoryline');
  return r.config;
}

export class Storylines {
  constructor(private readonly repo: Repository, readonly defaultId: string) {}

  /** The storyline to start a run with: the latest published version, else a built in sample. `purpose` overrides the storyline's. */
  async resolve(id: string | null | undefined, purpose?: Purpose | null): Promise<ResolvedStoryline> {
    const key = id || this.defaultId;
    const row = await this.repo.getStoryline(key);
    let input: StorylineInput;
    let version: number;
    if (row) { input = row.config as StorylineInput; version = row.version; }
    else if (BUILT_IN[key]) { input = BUILT_IN[key](); version = 0; }
    else throw new StorylineError(`No published storyline "${key}"`, 'unknownStoryline');
    if (purpose) input = { ...input, purpose };
    return { id: key, version, input, config: configOf(input) };
  }
}
