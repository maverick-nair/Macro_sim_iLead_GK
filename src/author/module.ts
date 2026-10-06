import type { Brief, FrameworkDimension, LeadershipLensModule } from '../api/author';
import type { LensId } from '../engine/lens';
import { LENS_BY_ID } from './lenses';

/** The author's lens choice (module step 3) and the confirmed client framework (step 5). */
export interface LensSelection {
  primary: LensId;
  secondary: LensId | null;
  /** Confirmed client framework dimensions; used when either lens is the Client Leadership Model. */
  clientDimensions: FrameworkDimension[];
}

export const usesClientModel = (s: Pick<LensSelection, 'primary' | 'secondary'>) => s.primary === 'client_model' || s.secondary === 'client_model';

/** Scoring dimension names of a lens: the library's, or the confirmed client dimensions. */
export function dimensionNames(id: LensId, client: FrameworkDimension[]): string[] {
  return id === 'client_model' ? client.map(d => d.name) : LENS_BY_ID[id].dimensions.map(d => d.name);
}

/** The module's output on confirmation (leadership-lens-module.md, Output). */
export function buildModule(brief: Brief, sel: LensSelection, locked: boolean): LeadershipLensModule {
  const p = LENS_BY_ID[sel.primary];
  const client = usesClientModel(sel);
  const doc = brief.documents.find(d => d.text && brief.framework && d.text === brief.framework);
  return {
    library_version: 1,
    primary: {
      id: p.id, title: p.title, npc_design: p.npcDesign, event_design: p.eventDesign,
      action_classification: p.id === 'client_model' ? sel.clientDimensions.flatMap(d => d.behaviours.slice(0, 1)) : [...p.actionClassification],
      scoring_dimensions: dimensionNames(p.id, sel.clientDimensions)
    },
    secondary: sel.secondary ? { id: sel.secondary, title: LENS_BY_ID[sel.secondary].title, report_only_dimensions: dimensionNames(sel.secondary, sel.clientDimensions) } : null,
    client_model: {
      used: client,
      source_document: client ? doc?.name ?? (brief.framework ? 'Pasted text' : '') : '',
      confirmed_dimensions: client ? sel.clientDimensions.map(d => ({ name: d.name, behaviours: [...d.behaviours], levels: [...d.levels] })) : []
    },
    context: {
      industry: brief.industry ?? '', role_level: brief.roleLevel ?? '', team_size: String(brief.teamSize ?? 10),
      business_challenge: brief.challenge ?? '', client_name: brief.client ?? ''
    },
    locked
  };
}

/** The selection a module describes, for regenerating a draft from a saved module. */
export function selectionOf(m: LeadershipLensModule): LensSelection {
  return { primary: m.primary.id, secondary: m.secondary?.id ?? null, clientDimensions: m.client_model.confirmed_dimensions };
}
