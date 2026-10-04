// Signals that a reply actually belongs to *this* scenario, a contract renewal negotiation,
// rather than just being any well-formed sentence. XP is gated on these, not word count.
export const TOPIC_RX =
  /\b(price|pricing|cost|discount|quote|contract|renew|term|budget|value|saving|roi|deal|offer|proposal|competitor|freightwise|cfo|support|platform|volume|scope|margin|invoice|deadline|friday|delivery|deliveries|partner|commit|agreement|number|spend)\b/i;

// Each test maps to the objective at the same index, so completing one is behavioural, not automatic.
export const OBJECTIVE_TESTS: ((t: string) => boolean)[] = [
  (t) =>
    /\?/.test(t) &&
    /\b(what|how|why|tell me|describe|walk me|explain|share|which|when|could you|can you)\b/i.test(t),
  (t) =>
    /\b(in return|in exchange|if you|if we|trade|longer term|multi-year|volume|scope|commit|case study|price protection|saving|roi|value)\b/i.test(
      t,
    ),
  (t) =>
    /\b(you mentioned|you said|you talked|sounds like|so you|earlier you|you noted|i hear you|you described|following up|to clarify|if i understand|that means)\b/i.test(
      t,
    ),
];
