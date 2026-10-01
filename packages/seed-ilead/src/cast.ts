import type { Cast, Npc } from "@gk/schema";
import { SPONSOR_ID, STAGES, builtin } from "./ids";

type StageKey = (typeof STAGES)[keyof typeof STAGES];
type Fit = [skill: number, motivation: number, performance: number];
type Personality = [
  openness: number,
  assertiveness: number,
  warmth: number,
  resilience: number,
  candour: number,
];

interface MemberInput {
  id: string;
  name: string;
  pronouns: string;
  ageBand: string;
  stage: StageKey;
  smr: [skill: number, morale: number, result: number];
  /** Role fit for the other four stages (derived; see basis.ts). The home stage equals the starting stats. */
  fit: Partial<Record<StageKey, Fit>>;
  jobTitle: string;
  previousCompany?: string;
  tenureMonths?: number;
  experienceYears?: number;
  skills: string[];
  remarks: string;
  concern: string;
  concernEvents?: string[];
  goal: string;
  archetype?: Npc["profile"]["archetype"];
  influence: number;
  personality: Personality;
  communicationStyle: Npc["persona"]["communicationStyle"];
  pressureResponse: Npc["persona"]["pressureResponse"];
}

const firstName = (name: string) => name.split(" ")[0] ?? name;

const persona = (m: {
  name: string;
  personality: Personality;
  communicationStyle: Npc["persona"]["communicationStyle"];
  pressureResponse: Npc["persona"]["pressureResponse"];
}): Npc["persona"] => ({
  personality: {
    openness: m.personality[0],
    assertiveness: m.personality[1],
    warmth: m.personality[2],
    resilience: m.personality[3],
    candour: m.personality[4],
  },
  communicationStyle: m.communicationStyle,
  attitudeToLeader: "neutral",
  pressureResponse: m.pressureResponse,
  openingLines: [`Hi, I'm ${firstName(m.name)}. How do you do?`],
  catchphrases: [],
  knowledgeScope: { areas: ["own_work", "team_gossip"] },
  offLimitsTopics: ["Personal health details", "Politics", "Anything the client's policies rule out"],
  memoryDepth: 5,
});

const voiceNone: Npc["voice"] = {
  source: "none",
  language: "en",
  pitch: 0,
  pace: 0,
  warmth: 0,
  emotionalRange: "moderate",
  moodLinked: true,
  pronunciation: [],
};

const uniform = { recognition: 1, criticism: 1, change: 1, workload: 1 };

function member(m: MemberInput): Npc {
  const roleFit: Record<string, { skill: number; motivation: number; performance: number }> = {};
  for (const stage of Object.values(STAGES)) {
    const f: Fit = stage === m.stage ? m.smr : (m.fit[stage] ?? m.smr);
    roleFit[stage] = { skill: f[0], motivation: f[1], performance: f[2] };
  }
  return {
    id: m.id,
    kind: "team_member",
    identity: { name: m.name, pronouns: m.pronouns, ageBand: m.ageBand },
    look: {
      portrait: builtin(`stock-${m.id}`, `Portrait of ${m.name}`),
      attire: "Office wear",
      setting: "Bank branch office",
      expressions: {},
      avatarMode: "static",
    },
    profile: {
      roleId: m.stage,
      jobTitle: m.jobTitle,
      ...(m.previousCompany ? { previousCompany: m.previousCompany } : {}),
      ...(m.tenureMonths !== undefined ? { tenureMonths: m.tenureMonths } : {}),
      ...(m.experienceYears !== undefined ? { experienceYears: m.experienceYears } : {}),
      skills: m.skills,
      remarks: m.remarks,
      hiddenConcern: { text: m.concern, linkedEventIds: m.concernEvents ?? [], linkedActionIds: [] },
      careerGoal: m.goal,
      ...(m.archetype ? { archetype: m.archetype } : {}),
    },
    stats: {
      skill: m.smr[0],
      morale: m.smr[1],
      result: m.smr[2],
      trust: 50,
      roleFit,
      sensitivity: uniform,
      influence: m.influence,
    },
    persona: persona(m),
    voice: voiceNone,
  };
}

/** The ten team members. Starting Skill, Morale and Result are exactly the Teardown roster. */
const team: Npc[] = [
  member({
    id: "kent",
    name: "Kent Goldberg",
    pronouns: "he, him",
    ageBand: "25 to 34",
    stage: STAGES.salesLead,
    smr: [30, 22, 49],
    fit: { qualify: [28, 25, 40], proposal: [20, 20, 30], negotiate: [35, 30, 40], conversion: [25, 20, 35] },
    jobTitle: "Sales associate",
    previousCompany: "The Japanese International Bank",
    tenureMonths: 1,
    experienceYears: 3,
    skills: ["Lead Generation", "Negotiation"],
    remarks: "Joined a month ago and expected more. Already complaining to others.",
    concern: "Feels the role is not what he was promised when he joined.",
    concernEvents: ["kent-personal", "kent-message"],
    goal: "Lead his own sales area within a year",
    archetype: "complainer",
    influence: 60,
    personality: [2, 4, 2, 2, 4],
    communicationStyle: "direct",
    pressureResponse: "argues",
  }),
  member({
    id: "beth",
    name: "Beth Killiney",
    pronouns: "she, her",
    ageBand: "25 to 34",
    stage: STAGES.salesLead,
    smr: [25, 73, 45],
    fit: { qualify: [39, 37, 38], proposal: [22, 50, 35], negotiate: [20, 45, 30], conversion: [28, 55, 38] },
    jobTitle: "Sales associate",
    previousCompany: "Beta Bank",
    skills: ["Lead Generation", "Customer service"],
    remarks: "Joined from Beta Bank, a rival, after leaving over poor management.",
    concern: "Worries she has swapped one poor manager for another.",
    concernEvents: ["beth-complaint"],
    goal: "Grow into client relationship management",
    archetype: "rival_hire",
    influence: 35,
    personality: [4, 3, 4, 3, 3],
    communicationStyle: "polite",
    pressureResponse: "withdraws",
  }),
  member({
    id: "justin",
    name: "Justin Keel",
    pronouns: "he, him",
    ageBand: "25 to 34",
    stage: STAGES.qualify,
    smr: [22, 40, 52],
    fit: {
      "sales-lead": [20, 35, 40],
      proposal: [25, 40, 42],
      negotiate: [18, 45, 35],
      conversion: [20, 94, 47],
    },
    jobTitle: "Sales associate",
    skills: ["Financial analysis", "Qualification"],
    remarks: "Finance major who wants to move to Conversion.",
    concern: "Wants to move to Conversion but is afraid to ask.",
    goal: "Move to Conversion",
    archetype: "role_seeker",
    influence: 25,
    personality: [3, 2, 3, 3, 2],
    communicationStyle: "terse",
    pressureResponse: "withdraws",
  }),
  member({
    id: "derick",
    name: "Derick Kaynes",
    pronouns: "he, him",
    ageBand: "35 to 44",
    stage: STAGES.qualify,
    smr: [70, 71, 62],
    fit: {
      "sales-lead": [65, 60, 58],
      proposal: [60, 62, 55],
      negotiate: [55, 58, 50],
      conversion: [58, 60, 52],
    },
    jobTitle: "Senior sales associate",
    skills: ["Qualification", "Product knowledge"],
    remarks: "Solid performer. No remarks.",
    concern: "Feels overlooked because he never causes problems.",
    goal: "Become the team's trainer",
    influence: 45,
    personality: [3, 3, 4, 4, 3],
    communicationStyle: "formal",
    pressureResponse: "over_promises",
  }),
  member({
    id: "green",
    name: "Green Bell",
    pronouns: "she, her",
    ageBand: "35 to 44",
    stage: STAGES.proposal,
    smr: [89, 56, 69],
    fit: {
      "sales-lead": [60, 45, 55],
      qualify: [70, 50, 60],
      negotiate: [72, 52, 62],
      conversion: [65, 48, 58],
    },
    jobTitle: "Proposal specialist",
    skills: ["Proposal writing", "Relationship building"],
    remarks: "Go to person for proposals, with influential contacts.",
    concern: "Feels her contacts are used without any credit to her.",
    concernEvents: ["green-leave"],
    goal: "Lead proposals for key accounts",
    influence: 70,
    personality: [4, 3, 3, 4, 3],
    communicationStyle: "verbose",
    pressureResponse: "argues",
  }),
  member({
    id: "lowe",
    name: "Lowe Rex",
    pronouns: "he, him",
    ageBand: "25 to 34",
    stage: STAGES.proposal,
    smr: [80, 45, 67],
    fit: {
      "sales-lead": [55, 40, 50],
      qualify: [78, 50, 66],
      negotiate: [77, 48, 65],
      conversion: [60, 42, 55],
    },
    jobTitle: "Proposal specialist",
    skills: ["Proposals", "Qualification", "Negotiation"],
    remarks: "Also skilled in qualification and negotiation.",
    concern: "Never gets credit for strong results.",
    concernEvents: ["lowe-uncongratulated"],
    goal: "Become a senior negotiator",
    influence: 40,
    personality: [3, 2, 3, 3, 3],
    communicationStyle: "polite",
    pressureResponse: "withdraws",
  }),
  member({
    id: "jack",
    name: "Jack Holt",
    pronouns: "he, him",
    ageBand: "35 to 44",
    stage: STAGES.negotiate,
    smr: [92, 85, 95],
    fit: {
      "sales-lead": [70, 60, 70],
      qualify: [75, 65, 75],
      proposal: [78, 70, 78],
      conversion: [85, 80, 88],
    },
    jobTitle: "Lead negotiator",
    skills: ["Negotiation", "Closing"],
    remarks: "Top performer with many positive appraisals.",
    concern: "Fears favouritism toward weaker colleagues.",
    goal: "Become assistant branch manager",
    archetype: "top_performer",
    influence: 80,
    personality: [4, 4, 3, 5, 4],
    communicationStyle: "direct",
    pressureResponse: "escalates",
  }),
  member({
    id: "peter",
    name: "Peter Higgins",
    pronouns: "he, him",
    ageBand: "35 to 44",
    stage: STAGES.negotiate,
    smr: [10, 15, 16],
    fit: {
      "sales-lead": [20, 25, 22],
      qualify: [25, 30, 26],
      proposal: [45, 50, 40],
      conversion: [20, 30, 22],
    },
    jobTitle: "Sales associate",
    previousCompany: "Law practice",
    skills: ["Contract law", "Negotiation"],
    remarks: "Lawyer turned salesperson. Declining, loyal, needs encouragement.",
    concern: "Doubts he belongs in sales after a run of lost deals.",
    goal: "Use his legal skills in contract negotiation",
    archetype: "low_performer",
    influence: 20,
    personality: [3, 1, 4, 2, 3],
    communicationStyle: "polite",
    pressureResponse: "withdraws",
  }),
  member({
    id: "ruth",
    name: "Ruth Ether",
    pronouns: "she, her",
    ageBand: "35 to 44",
    stage: STAGES.conversion,
    smr: [80, 50, 65],
    fit: {
      "sales-lead": [50, 40, 45],
      qualify: [60, 45, 55],
      proposal: [70, 55, 62],
      negotiate: [62, 45, 55],
    },
    jobTitle: "Closing specialist",
    skills: ["Closing", "Attention to detail"],
    remarks: "Perfectionist, strong in conversion.",
    concern: "Close to burning out from fixing other people's mistakes.",
    goal: "Own the premium client segment",
    influence: 45,
    personality: [3, 3, 2, 3, 4],
    communicationStyle: "formal",
    pressureResponse: "argues",
  }),
  member({
    id: "mandy",
    name: "Mandy Lobert",
    pronouns: "she, her",
    ageBand: "25 to 34",
    stage: STAGES.conversion,
    smr: [60, 80, 71],
    fit: {
      "sales-lead": [45, 60, 50],
      qualify: [40, 67, 52],
      proposal: [50, 65, 55],
      negotiate: [58, 70, 60],
    },
    jobTitle: "Closing specialist",
    skills: ["Closing", "Competitive deals"],
    remarks: "Known for closing tough deals won from competitors.",
    concern: "Wants recognition for winning deals from competitors.",
    goal: "Lead her own team",
    influence: 55,
    personality: [4, 4, 4, 4, 3],
    communicationStyle: "direct",
    pressureResponse: "over_promises",
  }),
];

const sponsor: Npc = {
  id: SPONSOR_ID,
  kind: "sponsor",
  identity: { name: "Roger Kent", pronouns: "he, him", ageBand: "45 to 54" },
  look: {
    portrait: builtin("stock-roger-kent", "Portrait of Roger Kent"),
    attire: "Business suit",
    setting: "CEO office",
    expressions: {},
    avatarMode: "static",
  },
  profile: {
    roleId: "sponsor",
    jobTitle: "Chief Executive Officer",
    skills: ["Strategy", "Banking"],
    remarks: "Expects the branch to recover this quarter.",
    hiddenConcern: {
      text: "Under pressure from the board to show that the branch can recover.",
      linkedEventIds: [],
      linkedActionIds: [],
    },
    careerGoal: "Prove the turnaround plan works",
  },
  persona: {
    personality: { openness: 3, assertiveness: 5, warmth: 2, resilience: 4, candour: 5 },
    communicationStyle: "direct",
    attitudeToLeader: "neutral",
    pressureResponse: "escalates",
    openingLines: ["Good to see you. Walk me through the numbers."],
    catchphrases: [],
    knowledgeScope: { areas: ["own_work", "policy"] },
    offLimitsTopics: ["Personal health details", "Politics", "Anything the client's policies rule out"],
    memoryDepth: "all",
  },
  voice: voiceNone,
};

const candidate = (
  id: string,
  name: string,
  pronouns: string,
  shown: [number, number, number],
  truth: [number, number, number],
  interviewPersona: string,
): Npc => ({
  id,
  kind: "candidate",
  identity: { name, pronouns, ageBand: "25 to 34" },
  look: {
    portrait: builtin(`stock-${id}`, `Portrait of ${name}`),
    attire: "Interview wear",
    setting: "Interview room",
    expressions: {},
    avatarMode: "static",
  },
  profile: {
    roleId: "candidate",
    jobTitle: "Candidate, sales associate",
    skills: ["Sales"],
    remarks: "Applied for the open sales associate role.",
    hiddenConcern: {
      text: "Has not shared everything about past results.",
      linkedEventIds: [],
      linkedActionIds: [],
    },
    careerGoal: "Join a growing sales team",
  },
  stats: {
    skill: shown[0],
    morale: shown[1],
    result: shown[2],
    roleFit: {},
    sensitivity: uniform,
    influence: 20,
  },
  persona: persona({
    name,
    personality: [3, 3, 3, 3, 3],
    communicationStyle: "polite",
    pressureResponse: "over_promises",
  }),
  voice: voiceNone,
  candidate: { trueStats: { skill: truth[0], morale: truth[1], result: truth[2] }, interviewPersona },
});

export const cast: Cast = {
  roster: {
    teamSize: 10,
    membersPerRole: { default: 2, perStage: {} },
    supportingCast: ["sponsor"],
    archetypeMix: ["top_performer", "low_performer", "complainer", "role_seeker", "rival_hire"],
    diversity: { mode: "mixed" },
    hiringPool: { count: 2, visibleToLearner: false },
  },
  npcs: [
    ...team,
    sponsor,
    candidate(
      "asha-raman",
      "Asha Raman",
      "she, her",
      [55, 70, 55],
      [65, 60, 62],
      "Modest about her results; strongest when asked for specific examples.",
    ),
    candidate(
      "daniel-lim",
      "Daniel Lim",
      "he, him",
      [70, 75, 68],
      [50, 55, 45],
      "Polished and confident; vague when probed on how he hit his numbers.",
    ),
  ],
  relationships: [],
  rippleRules: [
    {
      id: "jack-fairness",
      trigger: "rewarded",
      source: { kind: "any_team_member", except: ["jack"] },
      affected: { kind: "npc", npcId: "jack" },
      condition: "affected.result > source.result",
      deltas: { morale: -13, result: -20 },
      description: "Jack reacts when someone he outperforms gets a bonus.",
    },
  ],
};
