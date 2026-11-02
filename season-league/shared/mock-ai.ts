/**
 * Mock mode: scripted character replies and fixed sample scores. Used by the server when no
 * ANTHROPIC_API_KEY is set, and by the game itself if the server cannot be reached.
 * Everything here is badged "Demo AI" on the score bug.
 */
import type {
  ChatRequest,
  PlanScoreRequest,
  RubricPass,
  TrustScore,
  TrustScoreRequest,
} from "./ai-contract.ts";

const OPENERS: Record<string, string> = {
  nadia:
    "Good morning. I have the payroll file for the 28th in front of me and a note that your test files were rejected. Tell me exactly what happens between now and the 28th, and who will confirm it to me.",
};

const GENERIC_OPENER = "Thank you for calling. Walk me through where things stand and what you need from me.";

/** Scripted follow ups, picked by what the squad has and has not covered yet. */
export function mockReply(req: ChatRequest): string {
  const squadTurns = req.transcript.filter((t) => t.who === "squad");
  if (squadTurns.length === 0) return OPENERS[req.character.id] ?? GENERIC_OPENER;

  const all = squadTurns.map((t) => t.text.toLowerCase()).join(" ");
  const last = squadTurns[squadTurns.length - 1]?.text.toLowerCase() ?? "";
  const mentionsDate =
    /\b(2[0-9](st|nd|rd|th)?|monday|tuesday|wednesday|thursday|friday|today|tomorrow|cut.?off)\b/.test(all);
  const mentionsOwner = /\b(i will|i'll|we will|kam|csm|sam|connectivity|owner|myself)\b/.test(all);
  const mentionsControl = /\b(dual|authori[sz]|signator|approv|control)\b/.test(all);
  const firstPromise = req.promises[0];

  if (/weather|football|joke|recipe|holiday/.test(last))
    return "I would rather keep this call on payroll. What is the plan for the 28th?";
  if (!mentionsDate)
    return "You have not given me a time. By when exactly, and what is the cut-off for the file?";
  if (!mentionsOwner) return "And who on your side owns that? I need one name I can call.";
  if (!mentionsControl)
    return "Only two of our four signatories are registered. How do you make sure payroll is released with the right approvals?";
  if (firstPromise && squadTurns.length < 4)
    return `I am writing this down: ${firstPromise.action}, owned by ${firstPromise.owner}, by the ${firstPromise.due.replace(/(st|nd|rd|th)$/, "")}. Is that correct?`;
  return "Good. Send me that in writing today, with the cut-off and the channel. I will hold you to the dates.";
}

/** Fixed sample rubric: 4, 3, 4, 4 (15 of 20), with a reason per line. */
export function mockRubric(req: PlanScoreRequest): RubricPass {
  const sample = [4, 3, 4, 4];
  const reasons = [
    "The plan names the rejected files and the missing signatories as the two causes.",
    "The interim channel is workable, but the controls on who releases payroll need one more check.",
    "Most actions have an owner and a date.",
    "The client message says what happens, by when, and who confirms it.",
  ];
  const text = [
    ...req.plan.headings.map((h) => h.text),
    ...req.plan.actions.map((a) => a.action),
    req.plan.clientMessage,
  ]
    .join(" ")
    .toLowerCase();
  const releasesWithoutAuthorizers =
    /(single|one) (signatory|approver|authori[sz]er)|without (dual|second) (approval|authori[sz]ation)|bypass/.test(
      text,
    );
  return {
    lines: req.lines.map((l, i) => ({
      id: l.id,
      score: sample[i] ?? 3,
      reason: reasons[i] ?? "Sample reason.",
    })),
    tryThis:
      "Add a named sign-off gate before the first live file, and read the cut-off time back to the client.",
    releasesPaymentWithoutAuthorizers: releasesWithoutAuthorizers,
  };
}

/** Fixed sample Trust Meter: 7 on every behavior, with one line in the client's voice. */
export function mockTrust(req: TrustScoreRequest): TrustScore {
  return {
    behaviors: req.behaviors.map((b) => ({ id: b.id, score: 7 })),
    verdict: "You gave me dates and names. Now I need to see them kept.",
  };
}
