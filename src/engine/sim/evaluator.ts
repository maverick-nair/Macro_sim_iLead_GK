import type { Band, Evaluation, PlanFields } from './types';
import type { Style } from './rules';

/**
 * The AI evaluator reads the participant's words and reports style, band, evidence and flags
 * (docs/SIMULATION.md 5.1). It never decides consequences; the rules do.
 *
 * The real evaluator is a server side model call. `heuristicEvaluator` stands in for it in the mock
 * engine, tests and calibration: transparent keyword rules, so outcomes in demos are explainable.
 */
export interface EvaluationInput {
  format: string;
  /** Everything the participant said or wrote, in order. */
  text: string;
  usedVoice?: boolean;
  /** Rubric dimensions for this interaction; defaults per format. */
  rubric?: Array<{ key: string }>;
  /** Skills this interaction rates (Report 2.0 linkage matrix); each gets a band as an observation. */
  skills?: string[];
  /** The lens's styles (D70): the style shown is one of these keys. Readiness Based Leadership when left out. */
  styles?: Array<{ key: string; name: string; short: string }>;
  /** A written plan's fields (D85): its rubric reads the fields, not only the words. */
  plan?: PlanFields;
}

export interface Evaluator {
  evaluate(input: EvaluationInput): Evaluation | Promise<Evaluation>;
  /**
   * The other person's reply when the client sent none. The real one is an AI model streamed to the
   * client (M4); the heuristic gives a short line that fits how the words landed.
   */
  reply?(input: { format: string; text: string; band: Band }): string | Promise<string>;
}

const REPLIES: Record<Band, string[]> = {
  strong: ['That really helps. Thank you for hearing me out.', 'Okay, I can work with that. Thanks for making time.', 'Good, that is clear. I know what to do now.'],
  adequate: ['Alright, I will give it a go.', 'Fair enough. Let us see how it goes.', 'Okay. I think I understand what you need.'],
  weak: ['Okay. If you say so.', 'I am not sure that solves it, but fine.', 'Right. I will try.'],
  harmful: ['Right. I will just get on with it then.', 'That is not really what I needed to hear.', 'Fine.']
};

/** Readiness Based Leadership cues, by its style keys. A lens that keeps a key keeps its cues. */
const CUES: Record<string, RegExp[]> = {
  D: [/\bi need you to\b/i, /\bstep by step\b/i, /\bhere(?:'s| is) (?:the|my) plan\b/i, /\bin detail\b/i, /\bfirst,? .*then\b/i, /\bexactly\b/i, /\bcheck in (?:daily|every day)\b/i, /\bdo (?:this|it) (?:by|today|now)\b/i],
  G: [/\bthe reason\b/i, /\bwhy (?:this|it) matters\b/i, /\blet me explain\b/i, /\bi(?:'ll| will) (?:coach|guide|show)\b/i, /\bbuy in\b/i, /\bdoes (?:that|this) make sense\b/i, /\bpractise\b|\bpractice\b/i],
  P: [/\btogether\b/i, /\bwhat do you think\b/i, /\bhow can i help\b/i, /\blet'?s\b/i, /\byour (?:ideas|view|input)\b/i, /\bwe can\b/i, /\bhelp me understand\b/i],
  E: [/\byou decide\b/i, /\bup to you\b/i, /\bi trust you\b/i, /\byour call\b/i, /\bown (?:it|this)\b/i, /\bhow you (?:want|choose)\b/i, /\bi(?:'ll| will) step back\b/i]
};
const STOP = new Set(['you', 'your', 'yours', 'with', 'they', 'them', 'their', 'that', 'this', 'what', 'when', 'where', 'then', 'than', 'and', 'the', 'for', 'from', 'into', 'over', 'have', 'will', 'just', 'each', 'every', 'more', 'most', 'about', 'while', 'work', 'team']);

/**
 * Cues for each lens style, in lens order: a key the default lens has keeps its cues; any other style
 * is read from the words of its name and short line (the mock stands in for the model, which gets the
 * lens's styles in its input).
 */
export function styleCues(styles?: EvaluationInput['styles']): Array<[Style, RegExp[]]> {
  if (!styles) return Object.entries(CUES);
  return styles.map(s => {
    if (CUES[s.key]) return [s.key, CUES[s.key]];
    const words = [...new Set(`${s.name} ${s.short}`.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter(w => !STOP.has(w));
    return [s.key, words.map(w => new RegExp(`\\b${w}`, 'i'))];
  });
}

const ACK = /\b(?:sorry|thank(?:s| you)|appreciate|i hear you|i understand|that sounds|must be)\b/i;
const OPEN_Q = /\b(?:what|how|why|tell me|walk me through)\b[^?]*\?/gi;
const OPEN_Q_ONE = /\b(?:what|how|why|tell me|walk me through)\b[^?]*\?/i;
const INVITE = /\b(?:what do you think|your (?:ideas|view|input)|help me|how would you|what would you)\b/i;
const NEXT_STEP = /\b(?:by (?:monday|tuesday|wednesday|thursday|friday|tomorrow|end of (?:day|week))|tomorrow|this week|next step|on day \d)\b/i;
const CONCERN = /\b(?:what'?s on your mind|what is on your mind|what'?s bothering|how are you (?:feeling|doing)|what'?s really going on|is something wrong)\b/i;
const ABUSE = /\b(?:idiot|stupid|useless|pathetic|shut up|incompetent|worthless)\b/i;
const PROMISE = /\bi(?:'ll| will) ([^.?!]{4,80}?)\s+(by [a-z ]+|tomorrow|this week|on day \d)\b/i;
const CONGRATS = /\b(?:well done|great (?:work|job)|congrat\w*|thank you for|proud)\b/i;
const WARN = /\b(?:concern(?:ed)?|below (?:target|expectations)|need(?:s)? to improve|not acceptable|warning|falling short)\b/i;

const DUE: Record<string, number> = { tomorrow: 1, 'this week': 3 };

function sentences(text: string) {
  return text.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);
}

/** Default rubric dimensions per format (Design doc, Action by action; Configuration Spec). */
export const DEFAULT_RUBRIC: Record<string, string[]> = {
  roleplay: ['listening', 'clarity', 'involvement'],
  chat: ['responsiveness', 'clarity', 'listening'],
  email: ['specificity', 'tone', 'fairness'],
  meeting: ['agenda', 'inclusion', 'clarity'],
  sponsor: ['ownership', 'honesty', 'plan'],
  interview: ['structure', 'probing', 'fairness'],
  plan: ['specific', 'measurable', 'involvement'],
  // Stakeholders outside the team (D161): a meeting, a presentation and a negotiation.
  stakeholder: ['listening', 'clarity', 'influence'],
  present: ['ownership', 'honesty', 'plan'],
  negotiate: ['interests', 'options', 'agreement']
};

const BAND_ORDER: Band[] = ['harmful', 'weak', 'adequate', 'strong'];
/** Overall band: any red flag forces Harmful; otherwise the median of the dimension bands, ties to the lower band. */
export function overallBand(dimensions: Array<{ band: Band }>, redFlags: string[]): Band {
  if (redFlags.length) return 'harmful';
  if (!dimensions.length) return 'weak';
  const ranks = dimensions.map(d => BAND_ORDER.indexOf(d.band)).sort((a, b) => a - b);
  return BAND_ORDER[ranks[Math.floor((ranks.length - 1) / 2)]];
}

const RED_FLAGS: Array<[string, RegExp]> = [
  ['abuse', /\b(?:idiot|stupid|useless|pathetic|shut up|incompetent|worthless)\b/i],
  ['blame', /\b(?:(?:it'?s|this is) (?:all )?your fault|you always mess|you never get anything)\b/i],
  ['discrimination', /\b(?:how old are you|are you (?:married|pregnant)|do you (?:have|plan to have) (?:kids|children)|what(?:'s| is) your religion|where are you really from)\b/i],
  ['policyBreach', /\b(?:don'?t tell hr|keep (?:this|it) off the record|fudge the numbers|backdate)\b/i]
];

/** Cue patterns per dimension; 2 or more hits read Strong, 1 Adequate, none Weak. */
const DIM_CUES: Record<string, RegExp[]> = {
  listening: [OPEN_Q_ONE, ACK, /\b(?:tell me more|help me understand|what i(?:'m| am) hearing|so you(?:'re| are) saying)\b/i],
  clarity: [NEXT_STEP, /\b(?:the plan|first|then|by (?:when|day)|so that)\b/i, /\b(?:i need|we need|the goal is)\b/i],
  involvement: [INVITE, /\b(?:together|your (?:plan|idea|call))\b/i, /\bhow would you\b/i],
  responsiveness: [ACK, /\b(?:right away|today|now|this afternoon)\b/i, OPEN_Q_ONE],
  specificity: [/\b(?:\d+|specifically|for example|the [a-z]+ account)\b/i, NEXT_STEP, /\b(?:because|since)\b/i],
  tone: [ACK, /\b(?:thank|appreciate|well done|great work)\b/i, /\b(?:please|let me know)\b/i],
  fairness: [/\b(?:everyone|the whole team|each of you|fair)\b/i, /\b(?:because|based on|the result(?:s)?)\b/i, /\b(?:example|evidence)\b/i],
  agenda: [/\b(?:agenda|today we|three things|first|then|finally)\b/i, NEXT_STEP, /\b(?:goal|purpose)\b/i],
  inclusion: [INVITE, /\b(?:what do you all think|anyone|[A-Z][a-z]+, what)\b/, OPEN_Q_ONE],
  ownership: [/\b(?:i own|i take (?:responsibility|ownership)|my call|on me)\b/i, /\bi(?:'ll| will)\b/i, /\bwe(?:'ll| will)\b/i],
  honesty: [/\b(?:behind|missed|below|short of|the truth|honestly)\b/i, /\b(?:risk|problem|issue)\b/i, /\b\d+\b/],
  plan: [NEXT_STEP, /\b(?:plan|steps|by (?:week|day)|milestone)\b/i, /\b(?:support|need from you|resources)\b/i],
  structure: [OPEN_Q_ONE, /\b(?:tell me about a time|walk me through|give me an example)\b/i, /\b(?:next question|another question)\b/i],
  probing: [/\b(?:what happened next|why|how did you|what did you learn|tell me more)\b/i, OPEN_Q_ONE, /\b(?:result|outcome)\b/i],
  specific: [/\b\d+\b/, /\b(?:specifically|exactly|each)\b/i, NEXT_STEP],
  measurable: [/\b\d+\s*(?:%|percent|deals|leads|calls|meetings)\b/i, /\bby (?:day|week|monday|tuesday|wednesday|thursday|friday)\b/i, /\b(?:measure|track|target)\b/i],
  // Stakeholder conversations (D161).
  influence: [/\b(?:because|so that|the benefit|for you|for your|it means)\b/i, /\b(?:i propose|i suggest|i recommend|my proposal|what i(?:'d| would) like)\b/i, NEXT_STEP],
  interests: [OPEN_Q_ONE, /\b(?:what matters|what do you need|your priorit|for you|from your side)\b/i, ACK],
  options: [/\b(?:option|alternative|we could|what if|either|or we|instead)\b/i, /\b(?:in return|trade|meet (?:you )?halfway|if you can)\b/i, /\b\d+\b/],
  agreement: [NEXT_STEP, /\b(?:agree|agreed|deal|commit|so we(?:'re| are) clear|to confirm)\b/i, /\b(?:i(?:'ll| will)|we(?:'ll| will))\b/i],
  // Skills of the leadership framework (scoring-and-report.md 5.2).
  situational_flexibility: [ACK, INVITE, /\b(?:right now you need|for now|this week you|given where you are)\b/i],
  coaching_for_growth: [/\b(?:coach|practi[cs]e|learn|grow|develop|try it)\b/i, OPEN_Q_ONE, /\b(?:next (?:call|time)|walk through|together)\b/i],
  difficult_conversations: [ACK, /\b(?:honest(?:ly)?|concern|difficult|hard|the truth)\b/i, NEXT_STEP],
  goal_setting: [/\b\d+\b/, NEXT_STEP, /\b(?:goal|target|measure|track|check in)\b/i],
  giving_feedback: [/\b(?:because|specifically|for example)\b/i, /\b(?:when you|i noticed|i saw|you did)\b/i, NEXT_STEP],
  recognition_fairness: [/\b(?:thank|well done|great (?:work|job)|appreciate|proud)\b/i, /\b(?:everyone|fair|the whole team|each of you)\b/i, /\b(?:because|specifically|for example)\b/i],
  communicating_change: [/\b(?:why|the reason|because|change)\b/i, /\b(?:first|then|plan|what it means)\b/i, INVITE],
  results_ownership: [/\b(?:i own|on me|my responsibility|i take (?:responsibility|ownership))\b/i, /\b(?:\d+|target|pipeline|revenue|behind|risk)\b/i, /\b(?:i|we)(?:'ll| will)\b/i]
};

/**
 * A written plan's dimensions from its fields (D85), the way an assessor would read a plan:
 * - specific: goals of six words or more are Strong, three or more Adequate, else Weak;
 * - measurable: a number in the measures and a due date are Strong, either one Adequate, else Weak;
 * - involvement: an owner and the support you will give are Strong, either one Adequate, else Weak.
 */
export function planBand(key: string, plan: PlanFields): { band: Band; evidence: string[] } | null {
  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  const level = (n: number): Band => (n >= 2 ? 'strong' : n === 1 ? 'adequate' : 'weak');
  if (key === 'specific') return { band: words(plan.goals) >= 6 ? 'strong' : words(plan.goals) >= 3 ? 'adequate' : 'weak', evidence: plan.goals.trim() ? [plan.goals.trim()] : [] };
  if (key === 'measurable') return { band: level(Number(/\d/.test(plan.measures)) + Number(plan.due !== null)), evidence: plan.measures.trim() ? [plan.measures.trim()] : [] };
  if (key === 'involvement') return { band: level(Number(!!plan.owner.trim()) + Number(!!plan.support.trim())), evidence: plan.support.trim() ? [plan.support.trim()] : [] };
  return null;
}

function dimensionBand(key: string, text: string): { band: Band; evidence: string[] } {
  const cues = DIM_CUES[key] ?? DIM_CUES.clarity;
  const hits = cues.filter(rx => rx.test(text)).length;
  const evidence = sentences(text).filter(sn => cues.some(rx => rx.test(sn))).slice(0, 2);
  return { band: hits >= 2 ? 'strong' : hits === 1 ? 'adequate' : 'weak', evidence };
}

export const heuristicEvaluator: Evaluator = {
  reply({ text, band }) {
    const lines = REPLIES[band];
    return lines[text.length % lines.length];
  },
  evaluate({ format, text, usedVoice, rubric, skills, styles, plan }) {
    const cues = styleCues(styles);
    const scores = cues.map(([s, rxs]) => [s, rxs.filter(rx => rx.test(text)).length] as const);
    const total = scores.reduce((a, [, n]) => a + n, 0);
    const [styleUsed, top] = [...scores].sort((a, b) => b[1] - a[1])[0];
    const openQuestions = (text.match(OPEN_Q) ?? []).length;
    const flags: Evaluation['flags'] = {
      openQuestions,
      acknowledged: ACK.test(text),
      invitedContribution: INVITE.test(text),
      specificNextStep: NEXT_STEP.test(text),
      concernSurfaced: CONCERN.test(text),
      abusive: ABUSE.test(text)
    };
    const pm = text.match(PROMISE);
    if (pm) {
      const when = pm[2].toLowerCase();
      flags.promise = { text: `I'll ${pm[1]} ${pm[2]}`, dueInSubPeriods: DUE[when] ?? 3, fulfilledBy: ['f2f', 'goals', 'coach', 'feedback', 'reward', 'training', 'swap'] };
    }
    // A band per rubric dimension, then the overall band (scoring-and-report.md 4).
    const keys = rubric?.map(r => r.key) ?? DEFAULT_RUBRIC[format] ?? DEFAULT_RUBRIC.roleplay;
    const dimensions = keys.map(key => ({ key, ...((plan && planBand(key, plan)) || dimensionBand(key, text)) }));
    const redFlags = RED_FLAGS.filter(([, rx]) => rx.test(text)).map(([k]) => k);
    const band = overallBand(dimensions, redFlags);
    const all = cues.flatMap(([, rxs]) => rxs);
    const cueSentences = sentences(text).filter(s => all.some(rx => rx.test(s)) || ACK.test(s) || INVITE.test(s));
    return {
      // No cue: the lens's second style (Guiding in Readiness Based Leadership), the middle ground.
      styleUsed: top > 0 ? styleUsed : cues[Math.min(1, cues.length - 1)][0],
      confidence: total ? top / total : 0.25,
      band,
      evidence: (cueSentences.length ? cueSentences : sentences(text)).slice(0, 2),
      flags,
      emailIntent: format === 'email' ? (WARN.test(text) ? 'warn' : CONGRATS.test(text) ? 'congratulate' : 'neutral') : undefined,
      usedVoice,
      dimensions,
      // A red flag makes every rated skill Harmful, as it does the overall band.
      skills: (skills ?? []).map(key => ({ key, ...dimensionBand(key, text), ...(redFlags.length ? { band: 'harmful' as Band } : {}) })),
      redFlags
    };
  }
};
