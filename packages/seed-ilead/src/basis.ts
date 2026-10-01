/**
 * Where the seed's values come from, for reviewers and for the Governance "about this template" view.
 * Paths are stable paths (see @gk/schema pointer.ts). Anything not listed follows the Config Spec
 * "iLead default" column or, where that column is silent, the Gameplay Teardown.
 *
 * basis:
 *   teardown     observed in the current iLead build (Gameplay Teardown)
 *   design       iLead 2.0 AI Authored Interactive Simulation Design
 *   scoring      docs/scoring-and-report.md (your answer to Q5 and Q7)
 *   derived      computed so the engine reproduces Teardown observations (your answer to Q1)
 *   assumed      docs are silent; smallest reasonable default, logged as an A-xx assumption
 *   written      seed copy written for the iLead original where the docs give none
 */
export type SeedBasisKind = "teardown" | "design" | "scoring" | "derived" | "assumed" | "written";

export interface SeedBasisEntry {
  path: string;
  basis: SeedBasisKind;
  /** Decision log reference (A-xx, C-xx, D-xx) or doc section. */
  ref: string;
}

const TEAM = ["kent", "beth", "justin", "derick", "green", "lowe", "jack", "peter", "ruth", "mandy"] as const;

export const SEED_BASIS: readonly SeedBasisEntry[] = [
  // Cast: starting stats are observed; role fit for other stages is derived.
  ...TEAM.flatMap((id): SeedBasisEntry[] => [
    { path: `/cast/npcs/@${id}/stats/skill`, basis: "teardown", ref: "Teardown roster" },
    { path: `/cast/npcs/@${id}/stats/morale`, basis: "teardown", ref: "Teardown roster" },
    { path: `/cast/npcs/@${id}/stats/result`, basis: "teardown", ref: "Teardown roster" },
    { path: `/cast/npcs/@${id}/stats/trust`, basis: "assumed", ref: "C-07, your answer to Q2" },
    { path: `/cast/npcs/@${id}/stats/roleFit`, basis: "derived", ref: "A-12, A-30" },
    { path: `/cast/npcs/@${id}/persona`, basis: "written", ref: "A-41" },
  ]),
  { path: "/cast/npcs/@asha-raman", basis: "written", ref: "A-35" },
  { path: "/cast/npcs/@daniel-lim", basis: "written", ref: "A-35" },
  {
    path: "/cast/rippleRules/@jack-fairness",
    basis: "teardown",
    ref: "Teardown: Jack reacts to a bonus for a lower performer",
  },

  // Context.
  { path: "/context/scenario/sponsorStyle", basis: "assumed", ref: "A-33" },
  { path: "/context/scenario/tone", basis: "assumed", ref: "A-33" },

  // Branding.
  { path: "/branding/colours", basis: "assumed", ref: "A-36" },

  // Process.
  { path: "/process/throughput", basis: "derived", ref: "A-25" },
  { path: "/process/targets/secondary", basis: "assumed", ref: "A-34" },
  { path: "/process/targets/weeklyDrift", basis: "teardown", ref: "A-21" },

  // Leadership.
  { path: "/leadership/readinessBands", basis: "derived", ref: "A-11" },
  { path: "/leadership/fitMatrix", basis: "derived", ref: "A-11" },
  { path: "/leadership/roleMisfit", basis: "derived", ref: "A-22, A-30" },
  { path: "/leadership/deltaTable", basis: "derived", ref: "A-24" },
  { path: "/leadership/promises", basis: "assumed", ref: "A-04" },
  { path: "/leadership/intentVsAction", basis: "design", ref: "Design doc, intent versus action" },

  // Actions.
  { path: "/actions/catalogue/@swap-roles/prerequisites", basis: "derived", ref: "A-30" },
  { path: "/actions/catalogue/@reply-to-messages", basis: "assumed", ref: "A-31, A-32" },
  { path: "/actions/catalogue/@sponsor-briefing/unlock", basis: "assumed", ref: "A-31" },
  {
    path: "/actions/catalogue/@meet-face-to-face/interaction/consequences",
    basis: "design",
    ref: "Design doc, Kent example",
  },
  { path: "/actions/catalogue/@meet-face-to-face/interaction/calibrationSet", basis: "assumed", ref: "A-37" },

  // Events.
  { path: "/events/deck/@kent-message", basis: "design", ref: "Design doc, hybrid event example" },
  { path: "/events/deck/@kent-blocks-leads/trigger", basis: "assumed", ref: "A-39" },
  { path: "/events/deck/@transfer-request/target", basis: "assumed", ref: "A-39" },

  // Gamification and report follow the scoring spec.
  { path: "/gamification", basis: "scoring", ref: "docs/scoring-and-report.md sections 3 and 6" },
  { path: "/report/skillsFramework", basis: "scoring", ref: "docs/scoring-and-report.md section 5, A-40" },
  { path: "/report/narrativeBank", basis: "written", ref: "A-41" },
];
