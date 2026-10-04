export const SCORE = 7;
export const MAX_SCORE = 10;
export const LEVEL = "Proficient";
export const DURATION = "13:46";
export const SCENARIO_TITLE = "Renewal Negotiation with Margaret Hale";
export const ROLE_DESCRIPTION =
  "You are a senior account executive at Cloudline, a logistics software company. You're meeting Margaret Hale, VP of Procurement at Northwind Freight, to renew a three-year platform contract worth $1.2M a year. She is sharp, well prepared, and under pressure from her CFO to cut costs.";
export const GOAL_DESCRIPTION =
  "Secure the renewal on terms that protect your margin and the long-term relationship. Understand what is really driving Margaret's position, trade value rather than discounts, and leave with a clear, agreed next step.";
export const CRITICAL_CHALLENGE =
  "Early in the meeting, Margaret puts a competitor's quote on the table that is 22% lower and says she needs you to match it by Friday or she walks. The room goes quiet and the pressure is on you.";

export const ASSESSED_SKILLS = [
  { name: "Negotiation Strategy", desc: "How you plan, pace and trade concessions under pressure" },
  { name: "Value Articulation", desc: "How clearly you tie your offer to outcomes the client cares about" },
  { name: "Objection Handling", desc: "How you respond when price, timing or trust is challenged" },
  { name: "Active Listening", desc: "How well you hear, reflect and build on what is said" },
  {
    name: "Evidence-based Probing",
    desc: "How you use questions and data to surface what is really going on",
  },
  { name: "Relationship Management", desc: "How you keep trust intact while holding your position" },
];

// Outcome-only quests: they state what winning looks like, never how to get there.
// Completion criteria stay hidden so the same call works for practice and for assessment.
export const LANDING_OBJECTIVES = [
  { label: "Break the Deadlock", sub: "Get the conversation moving past the opening standoff", xp: 60 },
  {
    label: "Protect the Margin",
    sub: "Close the call with a deal you can take back to your own team",
    xp: 50,
  },
  { label: "Win Her Over", sub: "Walk out with an ally, not just a signature", xp: 40 },
];

// Peer comparison is only statistically meaningful once enough people have played.
export const PEER_THRESHOLD = 50;
export const PLAYERS_COMPLETED = 64;

export const GUIDELINES = [
  "You have 15 minutes to complete this roleplay.",
  "You will engage in a conversational interaction where you can choose to respond via audio or text input.",
  "The conversation will be adaptive; your responses will influence the outcomes of this interaction.",
  "Make sure your responses directly support the goal and help overcome the stated challenge.",
  "You need to achieve an overall score of 8 or above for the conversation to be successful.",
  "Your score and detailed feedback report will be shared at the end of the conversation.",
];

export const PORTRAIT_SRC =
  "https://images.unsplash.com/photo-1610721193651-e6aca85b45aa?w=900&h=1200&fit=crop&auto=format&q=80";
export const SCENE_SRC =
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&h=700&fit=crop&auto=format&q=80";

export const OBJECTIVES = LANDING_OBJECTIVES.map((o) => o.label);
