export type Page = "landing" | "session" | "summary";

export type Evidence = { time: string; quote: string; note: string; kind: "strength" | "gap" };

export type Skill = {
  name: string;
  desc: string;
  score: number;
  weight: number;
  peer: number;
  subskills: { name: string; score: number; note: string }[];
  observed: string[];
  missed: string[];
  evidence: Evidence[];
  feedback: string;
  recommendation: string;
  drill: string;
};

export type Line = { speaker: string; time: string; text: string; tag?: "strength" | "gap" };

export type SessionStats = {
  startXp: number;
  endXp: number;
  badges: string[];
  bestStreak: number;
  objectives: number;
  startRank: number;
  endRank: number;
};

export type ReportTab = "overview" | "skills" | "comm" | "transcript";
