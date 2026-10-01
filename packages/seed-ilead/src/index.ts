import { CURRENT_SCHEMA_VERSION, type SimulationTemplate } from "@gk/schema";
import { access } from "./access";
import { actions } from "./actions";
import { branding } from "./branding";
import { cast } from "./cast";
import { context } from "./context";
import { events } from "./events";
import { gamification } from "./gamification";
import { governance } from "./governance";
import { leadership } from "./leadership";
import { processArea } from "./process";
import { report } from "./report";
import { time } from "./time";

/** Engine version the seed was last checked against. */
export const SEED_ENGINE_VERSION = "0.1.0";

/**
 * The iLead original: Secure Capital Bank. The only place client or scenario content lives (CLAUDE.md rule 9).
 * Every new build starts from a copy of this object (Config Spec, "How each setting gets its value").
 */
export const iLeadOriginal: SimulationTemplate = {
  meta: {
    templateId: "ilead-original",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: "ilead",
    engineVersion: SEED_ENGINE_VERSION,
    title: "iLead DEMO",
  },
  context,
  branding,
  cast,
  process: processArea,
  leadership,
  actions,
  events,
  time,
  gamification,
  report,
  access,
  governance,
};

export { SEED_BASIS, type SeedBasisEntry, type SeedBasisKind } from "./basis";
export { ACTIONS, SKILLS, SPONSOR_ID, STAGES, STYLES } from "./ids";
