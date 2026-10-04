// Communication analysis: CEFR-style language proficiency plus sentiment/tone/clarity.
export const CEFR = {
  overall: "C1",
  band: "Advanced",
  summary:
    "Your language use reflects an Advanced (C1) command of professional English. You were fluent, well-structured, and precise, with only minor lapses in grammatical accuracy under more complex phrasing.",
  dimensions: [
    {
      name: "Fluency",
      level: "C1",
      note: "Smooth, spontaneous delivery with only occasional hesitation.",
    },
    {
      name: "Coherence",
      level: "C1",
      note: "Ideas linked logically with clear discourse markers.",
    },
    {
      name: "Vocabulary Range",
      level: "C2",
      note: "Broad, precise professional lexis used naturally.",
    },
    {
      name: "Grammatical Accuracy",
      level: "B2",
      note: "Generally accurate; minor slips under complex phrasing.",
    },
    {
      name: "Interaction",
      level: "C1",
      note: "Manages turn-taking and clarifying questions effectively.",
    },
  ],
};

export const SENTIMENT = [
  { label: "Positive", pct: 64, color: "#10b981" },
  { label: "Neutral", pct: 29, color: "#f59e0b" },
  { label: "Negative", pct: 7, color: "#f43f5e" },
];

export const TONE = [
  { label: "Professional", pct: 82 },
  { label: "Supportive", pct: 71 },
  { label: "Encouraging", pct: 58 },
  { label: "Assertive", pct: 41 },
];

export const CLARITY = {
  score: 7.8,
  note: "Your phrasing was easy to follow, with concise sentences and minimal filler. A few compound questions could be split for even sharper clarity.",
};
