import type { Governance } from "@gk/schema";

/** Config Spec defaults for "Governance". People are assigned per build in the database, not here. */
export const governance: Governance = {
  roles: ["admin", "author", "reviewer", "facilitator", "viewer"],
  locks: [],
  approval: {
    enabled: true,
    // TODO(decision): D-04 who may approve the Report area. Default keeps any reviewer.
    reportApprover: "any_reviewer",
    // TODO(decision): D-13 whether playtest sign off blocks publish. Default off.
    requirePlaytestSignOff: false,
  },
  versioning: { enabled: true },
  templates: { enabled: true },
  useDeclaration: "development",
};
