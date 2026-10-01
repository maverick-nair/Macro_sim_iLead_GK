/** Stable ids used across the iLead original. */
export const STAGES = {
  salesLead: "sales-lead",
  qualify: "qualify",
  proposal: "proposal",
  negotiate: "negotiate",
  conversion: "conversion",
} as const;

export const STYLES = {
  directing: "directing",
  guiding: "guiding",
  partnering: "partnering",
  entrusting: "entrusting",
} as const;

export const SKILLS = {
  flexibility: "situational-flexibility",
  coaching: "coaching-for-growth",
  feedback: "giving-feedback",
  recognition: "recognition-and-fairness",
  change: "communicating-change",
  goals: "goal-setting-and-accountability",
  difficult: "handling-difficult-conversations",
  results: "results-ownership",
} as const;

export const ACTIONS = {
  meetTeam: "meet-the-team",
  energize: "energize-the-team",
  email: "send-email",
  swap: "swap-roles",
  training: "send-for-training",
  hire: "hire-member",
  fire: "fire-member",
  faceToFace: "meet-face-to-face",
  assess: "assess-member",
  reward: "reward-member",
  goals: "set-goals",
  coach: "coach-member",
  feedback: "give-feedback",
  reply: "reply-to-messages",
  briefing: "sponsor-briefing",
} as const;

export const SPONSOR_ID = "roger-kent";

/** A builtin asset shipped with the iLead original. */
export const builtin = (assetId: string, alt: string) => ({ source: "builtin" as const, assetId, alt });
