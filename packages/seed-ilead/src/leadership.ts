import type { Leadership } from "@gk/schema";
import { STYLES } from "./ids";

/**
 * Styles and definitions are the in game definitions (Teardown). Bands, misfit threshold and deltas are
 * derived from Teardown observations (A-11, A-22, A-24); see basis.ts.
 */
export const leadership: Leadership = {
  framework: "ilead",
  styles: [
    {
      id: STYLES.directing,
      name: "Directing",
      shortCode: "D",
      definition: "Be direct and give in-depth instructions",
      colour: "#1F6FD1",
    },
    {
      id: STYLES.guiding,
      name: "Guiding",
      shortCode: "G",
      definition: "Seek buy-in from the member to complete the task",
      colour: "#8F6BFF",
    },
    {
      id: STYLES.partnering,
      name: "Partnering",
      shortCode: "P",
      definition: "Encourage the member and help in achieving the task",
      colour: "#00A878",
    },
    {
      id: STYLES.entrusting,
      name: "Entrusting",
      shortCode: "E",
      definition: "Delegate by giving the big picture and monitor progress",
      colour: "#F2A33A",
    },
  ],
  // TODO(decision): D-10 global bands (A-11); per member exceptions stay empty.
  readinessBands: [
    { id: "low-skill-low-morale", label: "Low skill, low morale", skill: [0, 49], morale: [0, 59] },
    { id: "low-skill-high-morale", label: "Low skill, high morale", skill: [0, 49], morale: [60, 100] },
    { id: "high-skill-low-morale", label: "High skill, low morale", skill: [50, 100], morale: [0, 59] },
    { id: "high-skill-high-morale", label: "High skill, high morale", skill: [50, 100], morale: [60, 100] },
  ],
  fitMatrix: {
    "low-skill-low-morale": STYLES.directing,
    "low-skill-high-morale": STYLES.guiding,
    "high-skill-low-morale": STYLES.partnering,
    "high-skill-high-morale": STYLES.entrusting,
  },
  memberExceptions: [],
  roleMisfit: { roleFitSkillBelow: 25, strength: "strong", appliesTo: "moved_members" },
  deltaTable: { match: { morale: 2, result: 2 }, mismatch: { morale: -1, result: -1 } },
  teamFeedback: {
    below_half: ["Most of the team needed a different style from you this week."],
    half: ["Style matches around half the team."],
    majority: ["On the right track, majority positive.", "Majority happy, review the rest."],
    all: ["Every member got the style they needed this week."],
  },
  inferenceRules: [
    {
      styleId: STYLES.directing,
      indicators: [
        "Gives detailed step by step instructions",
        "Sets the plan and the deadlines for the person",
      ],
    },
    {
      styleId: STYLES.guiding,
      indicators: [
        "Explains why the task matters and asks for buy-in",
        "Decides, then sells the decision and answers questions",
      ],
    },
    {
      styleId: STYLES.partnering,
      indicators: ["Encourages and asks how they can help", "Solves the problem together with the person"],
    },
    {
      styleId: STYLES.entrusting,
      indicators: ["Asks for the person's own plan", "Gives the big picture and agrees check points only"],
    },
  ],
  intentVsAction: { enabled: true, gapWeeks: 2, trustDelta: -5 },
  promises: { keptTrustDelta: 3, brokenTrustDelta: -8 },
};
