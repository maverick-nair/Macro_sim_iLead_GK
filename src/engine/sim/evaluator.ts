import type { Band, Evaluation } from './types';
import type { Style } from './rules';

/**
 * The AI evaluator reads the participant's words and reports style, band, evidence and flags
 * (docs/SIMULATION.md 5.1). It never decides consequences; the rules do.
 *
 * The real evaluator is a server side model call. `heuristicEvaluator` stands in for it in the mock
 * engine, tests and calibration: transparent keyword rules, so outcomes in demos are explainable.
 */
export interface Evaluator {
  evaluate(input: { format: string; text: string; usedVoice?: boolean }): Evaluation | Promise<Evaluation>;
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

const CUES: Record<Style, RegExp[]> = {
  D: [/\bi need you to\b/i, /\bstep by step\b/i, /\bhere(?:'s| is) (?:the|my) plan\b/i, /\bin detail\b/i, /\bfirst,? .*then\b/i, /\bexactly\b/i, /\bcheck in (?:daily|every day)\b/i, /\bdo (?:this|it) (?:by|today|now)\b/i],
  G: [/\bthe reason\b/i, /\bwhy (?:this|it) matters\b/i, /\blet me explain\b/i, /\bi(?:'ll| will) (?:coach|guide|show)\b/i, /\bbuy in\b/i, /\bdoes (?:that|this) make sense\b/i, /\bpractise\b|\bpractice\b/i],
  P: [/\btogether\b/i, /\bwhat do you think\b/i, /\bhow can i help\b/i, /\blet'?s\b/i, /\byour (?:ideas|view|input)\b/i, /\bwe can\b/i, /\bhelp me understand\b/i],
  E: [/\byou decide\b/i, /\bup to you\b/i, /\bi trust you\b/i, /\byour call\b/i, /\bown (?:it|this)\b/i, /\bhow you (?:want|choose)\b/i, /\bi(?:'ll| will) step back\b/i]
};
const ACK = /\b(?:sorry|thank(?:s| you)|appreciate|i hear you|i understand|that sounds|must be)\b/i;
const OPEN_Q = /\b(?:what|how|why|tell me|walk me through)\b[^?]*\?/gi;
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

export const heuristicEvaluator: Evaluator = {
  reply({ text, band }) {
    const lines = REPLIES[band];
    return lines[text.length % lines.length];
  },
  evaluate({ format, text, usedVoice }) {
    const scores = (Object.keys(CUES) as Style[]).map(s => [s, CUES[s].filter(rx => rx.test(text)).length] as const);
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
    // Rubric: up to 2 points per criterion, five criteria (5.1).
    const points = (flags.acknowledged ? 2 : 0) + Math.min(2, openQuestions) + (flags.invitedContribution ? 2 : 0) + (flags.specificNextStep ? 2 : 0) + (top > 0 ? 2 : 0);
    const share = points / 10;
    const band: Band = flags.abusive ? 'harmful' : share >= 0.8 ? 'strong' : share >= 0.5 ? 'adequate' : 'weak';
    const cueSentences = sentences(text).filter(s => Object.values(CUES).flat().some(rx => rx.test(s)) || ACK.test(s) || INVITE.test(s));
    return {
      styleUsed: top > 0 ? styleUsed : 'G',
      confidence: total ? top / total : 0.25,
      band,
      evidence: (cueSentences.length ? cueSentences : sentences(text)).slice(0, 2),
      flags,
      emailIntent: format === 'email' ? (WARN.test(text) ? 'warn' : CONGRATS.test(text) ? 'congratulate' : 'neutral') : undefined,
      usedVoice
    };
  }
};
