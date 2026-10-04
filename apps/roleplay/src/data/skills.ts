import type { Skill } from "../types";

export const SKILLS: Skill[] = [
  {
    name: "Negotiation Strategy",
    desc: "Planning and steering the negotiation: knowing your walk-away point, sequencing concessions, and trading value instead of giving it away.",
    score: 7,
    weight: 20,
    peer: 6.4,
    subskills: [
      {
        name: "Anchoring",
        score: 8,
        note: "Opened on value and held the list price through the first push.",
      },
      {
        name: "Concession Trading",
        score: 5,
        note: "One unconditional 10% offer at 6:40 with nothing asked in return.",
      },
      {
        name: "BATNA Awareness",
        score: 8,
        note: "Tested the switching cost behind the rival quote rather than taking it at face value.",
      },
      {
        name: "Closing & Next Steps",
        score: 7,
        note: "Agreed a Thursday call, but the owner of each action was left vague.",
      },
    ],
    observed: [
      "Set the agenda around outcomes before discussing price",
      "Raised migration risk and switching cost at the right moment",
      "Proposed a multi-year structure as an alternative to a flat discount",
    ],
    missed: [
      "Offered a discount without a condition attached",
      "Did not confirm who else signs off on the renewal",
    ],
    evidence: [
      {
        time: "4:52",
        quote:
          "Moving 40 depots mid-season is a real cost. Has that been priced into the Freightwise number?",
        note: "Reframed the competitor quote around total cost of switching.",
        kind: "strength",
      },
      {
        time: "6:40",
        quote: "I could probably look at around 10% off if that helps.",
        note: "Unconditional concession. Signals more room and weakens your anchor.",
        kind: "gap",
      },
    ],
    feedback:
      "You held your ground well when Margaret first raised the competitor quote, and your question about migration cost shifted the conversation from price to risk. The main slip came at 6:40, when you offered 10% without asking for anything back. That concession set a new floor and Margaret immediately pushed for more.",
    recommendation:
      "Never concede without a trade. Before you move on price, name what you need in return, such as a longer term, added volume, or a reference case, and tie it to details the client has already shared.",
    drill:
      'Rewrite three concessions from past deals in the form "If you can do X, I can do Y." Say them out loud until the conditional feels natural.',
  },
  {
    name: "Value Articulation",
    desc: "Connecting the offer to the client's own business outcomes, so the conversation is about return on investment rather than cost alone.",
    score: 8,
    weight: 20,
    peer: 6.9,
    subskills: [
      {
        name: "Business Impact",
        score: 8,
        note: "Linked the platform to fewer late deliveries and lower penalty costs.",
      },
      {
        name: "Client-specific Evidence",
        score: 9,
        note: "Used Northwind's own 14% improvement rather than generic claims.",
      },
      {
        name: "Differentiation",
        score: 7,
        note: "Named the dedicated account team, but did not quantify its value.",
      },
    ],
    observed: [
      "Quoted the client's own performance data",
      "Translated features into outcomes the CFO would care about",
    ],
    missed: ["Did not put a dollar figure on the savings before price came back up"],
    evidence: [
      {
        time: "3:15",
        quote:
          "Since go-live your late deliveries are down 14%. On your volumes that's roughly $310K a year in avoided penalties.",
        note: "Specific, client-owned evidence. Margaret's tone softened noticeably.",
        kind: "strength",
      },
    ],
    feedback:
      "This was your strongest area. Your reference to the 14% drop in late deliveries, and the $310K it represents, gave Margaret something concrete she could take to her CFO. You could have repeated that figure later, when she returned to the headline price, instead of letting the value case fade.",
    recommendation:
      "Quantify value in the client's own numbers and bring it back every time price resurfaces. A savings figure the buyer can repeat upstairs is far harder to set aside than a general claim.",
    drill:
      'For your next three accounts, prepare a one-line value statement in the format "Because of X, you saved Y, which is worth Z."',
  },
  {
    name: "Objection Handling",
    desc: "Staying composed under pressure, acknowledging concerns, and exploring objections instead of defending against them.",
    score: 6,
    weight: 15,
    peer: 6.1,
    subskills: [
      {
        name: "Composure Under Pressure",
        score: 7,
        note: "Tone stayed steady when the Friday deadline was raised.",
      },
      {
        name: "Acknowledgement",
        score: 6,
        note: "Acknowledged the pressure once, then moved quickly to a defence.",
      },
      {
        name: "Reframing",
        score: 5,
        note: "Reframed the quote in terms of risk only after the second objection.",
      },
    ],
    observed: ["Kept a calm, professional tone throughout the ultimatum"],
    missed: [
      "Defended pricing immediately instead of exploring the objection",
      "Did not ask what else the competitor quote included",
    ],
    evidence: [
      {
        time: "1:28",
        quote: "Our pricing reflects the uptime and support you've had over three years.",
        note: "A defence, not a question. It invited Margaret to repeat her position more firmly.",
        kind: "gap",
      },
    ],
    feedback:
      "When Margaret said 'match it by Friday or we walk', you responded straight away with a defence of your pricing. Pausing to ask what the rival quote included, or what her CFO actually needs to see, would have told you far more and given you room to reframe.",
    recommendation:
      "Treat an ultimatum as information, not a verdict. Acknowledge it, pause, and ask one clarifying question before you respond to the substance.",
    drill:
      "Practise the pattern Acknowledge, Ask, Answer on five common objections. Record yourself and check that a question always comes before your answer.",
  },
  {
    name: "Active Listening",
    desc: "Hearing what is said and what is not, reflecting it back accurately, and letting the client's words shape the next move.",
    score: 6,
    weight: 15,
    peer: 6.3,
    subskills: [
      { name: "Paraphrasing", score: 7, note: "Summarised the CFO mandate accurately at 2:40." },
      { name: "Picking Up Cues", score: 5, note: "Missed her hint about 'a longer commitment' at 7:55." },
      {
        name: "Use of Silence",
        score: 6,
        note: "Two interruptions, both while Margaret was explaining constraints.",
      },
    ],
    observed: ["Paraphrased the cost-reduction mandate correctly"],
    missed: [
      "Talked over Margaret twice while she was explaining constraints",
      "Did not follow up on her openness to a longer term",
    ],
    evidence: [
      {
        time: "7:55",
        quote: "Margaret: I'm not against a longer term, but I'd need price protection.",
        note: "A clear buying signal. You moved on to support hours instead.",
        kind: "gap",
      },
    ],
    feedback:
      "Your paraphrase of the CFO mandate showed you were tracking the big picture. However, you missed the most valuable signal in the call: at 7:55 Margaret opened the door to a longer term, and the conversation moved on without it being explored.",
    recommendation:
      "Listen for conditional language such as 'I'm not against' or 'I'd need'. These are openings. Reflect them back straight away and ask what that would look like.",
    drill:
      "In your next three calls, write down every conditional phrase the client uses. Afterwards, check how many you followed up on.",
  },
  {
    name: "Evidence-based Probing",
    desc: "Asking questions that uncover the interests, constraints, and decision criteria behind a client's stated position.",
    score: 5,
    weight: 15,
    peer: 5.8,
    subskills: [
      {
        name: "Open Questions",
        score: 6,
        note: "6 of 11 questions were open. Target for this scenario is 8 or more.",
      },
      { name: "Depth of Follow-up", score: 4, note: "Most follow-ups stopped after the first answer." },
      { name: "Decision Criteria", score: 5, note: "Never confirmed how the CFO will judge the renewal." },
    ],
    observed: ["Opened with a strong question about what success looks like"],
    missed: [
      "Accepted the first answer on the CFO's priorities without going deeper",
      "Did not ask what a 'win' would look like for Margaret personally",
    ],
    evidence: [
      {
        time: "0:34",
        quote:
          "Before we get into numbers, can you tell me what a successful renewal looks like from your CFO's side?",
        note: "Excellent opener that invited her real priorities.",
        kind: "strength",
      },
      {
        time: "1:02",
        quote: "Margaret: Lower cost, plain and simple.",
        note: "Accepted at face value. A second question would have found the real driver.",
        kind: "gap",
      },
    ],
    feedback:
      "Your opening question was one of the best moves in the call, but you did not build on it. When Margaret answered 'lower cost, plain and simple', you accepted that and moved on. Real priorities usually sit one or two questions deeper.",
    recommendation:
      "Use the rule of three: after any important answer, ask at least two follow-ups, such as 'What's behind that?' and 'How will that be measured?', before you respond with your own position.",
    drill:
      "Take one recent client objection and write five follow-up questions you could have asked, each going one level deeper than the last.",
  },
  {
    name: "Relationship Management",
    desc: "Protecting trust and goodwill while negotiating firmly, so the client wants to keep working with you after the deal.",
    score: 8,
    weight: 15,
    peer: 7.0,
    subskills: [
      { name: "Rapport", score: 8, note: "Warm, respectful tone that Margaret mirrored by the close." },
      { name: "Empathy", score: 8, note: "Recognised her pressure from the CFO without judging it." },
      {
        name: "Trust Building",
        score: 7,
        note: "Transparent about limits, but could offer more personal commitment.",
      },
    ],
    observed: [
      "Recognised the pressure Margaret is under",
      "Kept the tone collaborative after the ultimatum",
      "Closed with a shared next step",
    ],
    missed: ["Could have offered a personal commitment, such as a quarterly business review"],
    evidence: [
      {
        time: "2:40",
        quote:
          "It sounds like you're being asked to show real savings this year, and I want to help you do that.",
        note: "Positioned you on her side of the table.",
        kind: "strength",
      },
    ],
    feedback:
      "You kept the relationship intact under real pressure. Margaret's tone warmed noticeably after 2:40, and she finished by agreeing to a follow-up call. You could build more trust by making a personal commitment she can hold you to.",
    recommendation:
      "Balance firmness on terms with generosity on attention. Offer something personal, like an executive sponsor or quarterly review, that costs little but signals long-term partnership.",
    drill:
      "List three low-cost, high-value commitments you can offer any key account, and practise weaving one into a close.",
  },
];

export const RAW_SCORE =
  SKILLS.reduce((a, k) => a + k.score * k.weight, 0) / SKILLS.reduce((a, k) => a + k.weight, 0);
