import {
  useState,
  useEffect,
  useRef,
  useContext,
  createContext,
  type ReactNode,
} from "react"

const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({
  dark: true,
  toggle: () => {},
})

function ThemeToggle() {
  const { dark, toggle } = useContext(ThemeContext)
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="flex items-center justify-center w-8 h-8 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      style={{
        borderColor: "rgb(var(--ink) / 0.15)",
        color: "rgb(var(--ink) / 0.7)",
      }}
    >
      {dark ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="3.2" />
          <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05" />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13.5 9.5A5.5 5.5 0 116.5 2.5a4.5 4.5 0 007 7z" />
        </svg>
      )}
    </button>
  )
}

type Page = "landing" | "session" | "summary"

// Returns black or white — whichever meets WCAG AA contrast — for text on a solid hex fill.
function readableOn(hex: string) {
  const h = hex.replace("#", "")
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  const L = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
  return L > 0.18 ? "#0c0c0f" : "#ffffff"
}

// Knolskape band palette: rust red, orange, yellow, light green, dark green.
const KNOLSKAPE_BANDS = [
  { label: "Novice", min: 1, max: 2, color: "#b5472f" },
  { label: "Emerging", min: 3, max: 4, color: "#e07b2e" },
  { label: "Competent", min: 5, max: 6, color: "#efc23a" },
  { label: "Proficient", min: 7, max: 8, color: "#8dc063" },
  { label: "Role Model", min: 9, max: 10, color: "#2f7a34" },
]

const bandFor = (score: number) =>
  KNOLSKAPE_BANDS[Math.min(4, Math.max(0, Math.ceil(Math.round(score) / 2) - 1))]

function TenPointScale({
  score,
  raw,
  description,
}: {
  score: number
  raw?: number
  description: string
}) {
  const active = bandFor(score)

  return (
    <div
      className="flex flex-col p-6 md:p-8 rounded-2xl border border-ink/10"
      style={{ background: "var(--surface)" }}
    >
      <p className="text-ink/70 text-xs font-bold tracking-widest uppercase mb-5">
        Overall Negotiation Score
      </p>

      <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-10">
        <div className="flex items-baseline gap-2">
          <span className="text-8xl font-display font-bold leading-none text-ink tabular-nums">
            {score}
          </span>
          <span className="text-3xl text-ink/70 font-display">/10</span>
        </div>
        <div className="flex flex-col gap-3 max-w-md sm:mt-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold tracking-wide"
              style={{ background: active.color, color: readableOn(active.color) }}
            >
              {active.label.toUpperCase()}
            </span>
            {raw !== undefined && (
              <span className="text-ink/70 text-xs tabular-nums">
                Weighted average {raw.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-ink/80 text-sm leading-relaxed">{description}</p>
        </div>
      </div>

      <p className="text-ink/70 text-[11px] font-bold tracking-widest uppercase mb-4">
        Knolskape Ten-Point Scale
      </p>
      <div
        className="grid grid-cols-5 gap-2 md:gap-3"
        role="img"
        aria-label={`Score ${score} of 10, ${active.label} band (${active.min} to ${active.max})`}
      >
        {KNOLSKAPE_BANDS.map((b) => {
          const on = b === active
          return (
            <div key={b.label} className="flex flex-col">
              <div
                className="grid grid-cols-2 gap-0.5 p-1 rounded-lg transition-all duration-500"
                style={
                  on
                    ? {
                        background: "var(--surface)",
                        transform: "translateY(-4px)",
                        boxShadow: `0 14px 28px -10px ${b.color}, 0 4px 10px -4px rgb(0 0 0 / 0.35), inset 0 0 0 1.5px ${b.color}`,
                      }
                    : { background: "transparent" }
                }
              >
                {[b.min, b.max].map((n) => {
                  const here = on && n === score
                  return (
                    <div
                      key={n}
                      className="h-9 flex items-center justify-center text-xs font-display font-bold tabular-nums rounded-md"
                      style={{
                        background: b.color,
                        opacity: on ? 1 : 0.32,
                        color: on ? readableOn(b.color) : "transparent",
                        outline: here ? `2px solid rgb(var(--ink))` : "none",
                        outlineOffset: 2,
                      }}
                    >
                      {n}
                    </div>
                  )
                })}
              </div>
              <span
                className={`mt-3 text-center text-xs font-display ${on ? "font-bold text-ink" : "font-medium text-ink/70"}`}
              >
                {b.label}
              </span>
              <span className="text-center text-[11px] text-ink/70 tabular-nums">
                {b.min}–{b.max}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SCORE = 7
const MAX_SCORE = 10
const LEVEL = "Proficient"
const DURATION = "13:46"
const SCENARIO_TITLE = "Renewal Negotiation with Margaret Hale"
const ROLE_DESCRIPTION =
  "You are a senior account executive at Cloudline, a logistics software company. You're meeting Margaret Hale, VP of Procurement at Northwind Freight, to renew a three-year platform contract worth $1.2M a year. She is sharp, well prepared, and under pressure from her CFO to cut costs."
const GOAL_DESCRIPTION =
  "Secure the renewal on terms that protect your margin and the long-term relationship. Understand what is really driving Margaret's position, trade value rather than discounts, and leave with a clear, agreed next step."
const CRITICAL_CHALLENGE =
  "Early in the meeting, Margaret puts a competitor's quote on the table that is 22% lower and says she needs you to match it by Friday or she walks. The room goes quiet and the pressure is on you."

const ASSESSED_SKILLS = [
  { name: "Negotiation Strategy", desc: "How you plan, pace and trade concessions under pressure" },
  { name: "Value Articulation", desc: "How clearly you tie your offer to outcomes the client cares about" },
  { name: "Objection Handling", desc: "How you respond when price, timing or trust is challenged" },
  { name: "Active Listening", desc: "How well you hear, reflect and build on what is said" },
  { name: "Evidence-based Probing", desc: "How you use questions and data to surface what is really going on" },
  { name: "Relationship Management", desc: "How you keep trust intact while holding your position" },
]

// Outcome-only quests: they state what winning looks like, never how to get there.
// Completion criteria stay hidden so the same call works for practice and for assessment.
const LANDING_OBJECTIVES = [
  { label: "Break the Deadlock", sub: "Get the conversation moving past the opening standoff", xp: 60 },
  { label: "Protect the Margin", sub: "Close the call with a deal you can take back to your own team", xp: 50 },
  { label: "Win Her Over", sub: "Walk out with an ally, not just a signature", xp: 40 },
]

// Peer comparison is only statistically meaningful once enough people have played.
const PEER_THRESHOLD = 50
const PLAYERS_COMPLETED = 64

type Evidence = { time: string; quote: string; note: string; kind: "strength" | "gap" }

type Skill = {
  name: string
  desc: string
  score: number
  weight: number
  peer: number
  subskills: { name: string; score: number; note: string }[]
  observed: string[]
  missed: string[]
  evidence: Evidence[]
  feedback: string
  recommendation: string
  drill: string
}

const SKILLS: Skill[] = [
  {
    name: "Negotiation Strategy",
    desc: "Planning and steering the negotiation: knowing your walk-away point, sequencing concessions, and trading value instead of giving it away.",
    score: 7,
    weight: 20,
    peer: 6.4,
    subskills: [
      { name: "Anchoring", score: 8, note: "Opened on value and held the list price through the first push." },
      { name: "Concession Trading", score: 5, note: "One unconditional 10% offer at 6:40 with nothing asked in return." },
      { name: "BATNA Awareness", score: 8, note: "Tested the switching cost behind the rival quote rather than taking it at face value." },
      { name: "Closing & Next Steps", score: 7, note: "Agreed a Thursday call, but the owner of each action was left vague." },
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
      { time: "4:52", quote: "Moving 40 depots mid-season is a real cost. Has that been priced into the Freightwise number?", note: "Reframed the competitor quote around total cost of switching.", kind: "strength" },
      { time: "6:40", quote: "I could probably look at around 10% off if that helps.", note: "Unconditional concession. Signals more room and weakens your anchor.", kind: "gap" },
    ],
    feedback:
      "You held your ground well when Margaret first raised the competitor quote, and your question about migration cost shifted the conversation from price to risk. The main slip came at 6:40, when you offered 10% without asking for anything back. That concession set a new floor and Margaret immediately pushed for more.",
    recommendation:
      "Never concede without a trade. Before you move on price, name what you need in return, such as a longer term, added volume, or a reference case, and tie it to details the client has already shared.",
    drill: "Rewrite three concessions from past deals in the form \"If you can do X, I can do Y.\" Say them out loud until the conditional feels natural.",
  },
  {
    name: "Value Articulation",
    desc: "Connecting the offer to the client's own business outcomes, so the conversation is about return on investment rather than cost alone.",
    score: 8,
    weight: 20,
    peer: 6.9,
    subskills: [
      { name: "Business Impact", score: 8, note: "Linked the platform to fewer late deliveries and lower penalty costs." },
      { name: "Client-specific Evidence", score: 9, note: "Used Northwind's own 14% improvement rather than generic claims." },
      { name: "Differentiation", score: 7, note: "Named the dedicated account team, but did not quantify its value." },
    ],
    observed: [
      "Quoted the client's own performance data",
      "Translated features into outcomes the CFO would care about",
    ],
    missed: [
      "Did not put a dollar figure on the savings before price came back up",
    ],
    evidence: [
      { time: "3:15", quote: "Since go-live your late deliveries are down 14%. On your volumes that's roughly $310K a year in avoided penalties.", note: "Specific, client-owned evidence. Margaret's tone softened noticeably.", kind: "strength" },
    ],
    feedback:
      "This was your strongest area. Your reference to the 14% drop in late deliveries, and the $310K it represents, gave Margaret something concrete she could take to her CFO. You could have repeated that figure later, when she returned to the headline price, instead of letting the value case fade.",
    recommendation:
      "Quantify value in the client's own numbers and bring it back every time price resurfaces. A savings figure the buyer can repeat upstairs is far harder to set aside than a general claim.",
    drill: "For your next three accounts, prepare a one-line value statement in the format \"Because of X, you saved Y, which is worth Z.\"",
  },
  {
    name: "Objection Handling",
    desc: "Staying composed under pressure, acknowledging concerns, and exploring objections instead of defending against them.",
    score: 6,
    weight: 15,
    peer: 6.1,
    subskills: [
      { name: "Composure Under Pressure", score: 7, note: "Tone stayed steady when the Friday deadline was raised." },
      { name: "Acknowledgement", score: 6, note: "Acknowledged the pressure once, then moved quickly to a defence." },
      { name: "Reframing", score: 5, note: "Reframed the quote in terms of risk only after the second objection." },
    ],
    observed: ["Kept a calm, professional tone throughout the ultimatum"],
    missed: [
      "Defended pricing immediately instead of exploring the objection",
      "Did not ask what else the competitor quote included",
    ],
    evidence: [
      { time: "1:28", quote: "Our pricing reflects the uptime and support you've had over three years.", note: "A defence, not a question. It invited Margaret to repeat her position more firmly.", kind: "gap" },
    ],
    feedback:
      "When Margaret said 'match it by Friday or we walk', you responded straight away with a defence of your pricing. Pausing to ask what the rival quote included, or what her CFO actually needs to see, would have told you far more and given you room to reframe.",
    recommendation:
      "Treat an ultimatum as information, not a verdict. Acknowledge it, pause, and ask one clarifying question before you respond to the substance.",
    drill: "Practise the pattern Acknowledge, Ask, Answer on five common objections. Record yourself and check that a question always comes before your answer.",
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
      { name: "Use of Silence", score: 6, note: "Two interruptions, both while Margaret was explaining constraints." },
    ],
    observed: ["Paraphrased the cost-reduction mandate correctly"],
    missed: [
      "Talked over Margaret twice while she was explaining constraints",
      "Did not follow up on her openness to a longer term",
    ],
    evidence: [
      { time: "7:55", quote: "Margaret: I'm not against a longer term, but I'd need price protection.", note: "A clear buying signal. You moved on to support hours instead.", kind: "gap" },
    ],
    feedback:
      "Your paraphrase of the CFO mandate showed you were tracking the big picture. However, you missed the most valuable signal in the call: at 7:55 Margaret opened the door to a longer term, and the conversation moved on without it being explored.",
    recommendation:
      "Listen for conditional language such as 'I'm not against' or 'I'd need'. These are openings. Reflect them back straight away and ask what that would look like.",
    drill: "In your next three calls, write down every conditional phrase the client uses. Afterwards, check how many you followed up on.",
  },
  {
    name: "Evidence-based Probing",
    desc: "Asking questions that uncover the interests, constraints, and decision criteria behind a client's stated position.",
    score: 5,
    weight: 15,
    peer: 5.8,
    subskills: [
      { name: "Open Questions", score: 6, note: "6 of 11 questions were open. Target for this scenario is 8 or more." },
      { name: "Depth of Follow-up", score: 4, note: "Most follow-ups stopped after the first answer." },
      { name: "Decision Criteria", score: 5, note: "Never confirmed how the CFO will judge the renewal." },
    ],
    observed: ["Opened with a strong question about what success looks like"],
    missed: [
      "Accepted the first answer on the CFO's priorities without going deeper",
      "Did not ask what a 'win' would look like for Margaret personally",
    ],
    evidence: [
      { time: "0:34", quote: "Before we get into numbers, can you tell me what a successful renewal looks like from your CFO's side?", note: "Excellent opener that invited her real priorities.", kind: "strength" },
      { time: "1:02", quote: "Margaret: Lower cost, plain and simple.", note: "Accepted at face value. A second question would have found the real driver.", kind: "gap" },
    ],
    feedback:
      "Your opening question was one of the best moves in the call, but you did not build on it. When Margaret answered 'lower cost, plain and simple', you accepted that and moved on. Real priorities usually sit one or two questions deeper.",
    recommendation:
      "Use the rule of three: after any important answer, ask at least two follow-ups, such as 'What's behind that?' and 'How will that be measured?', before you respond with your own position.",
    drill: "Take one recent client objection and write five follow-up questions you could have asked, each going one level deeper than the last.",
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
      { name: "Trust Building", score: 7, note: "Transparent about limits, but could offer more personal commitment." },
    ],
    observed: [
      "Recognised the pressure Margaret is under",
      "Kept the tone collaborative after the ultimatum",
      "Closed with a shared next step",
    ],
    missed: ["Could have offered a personal commitment, such as a quarterly business review"],
    evidence: [
      { time: "2:40", quote: "It sounds like you're being asked to show real savings this year, and I want to help you do that.", note: "Positioned you on her side of the table.", kind: "strength" },
    ],
    feedback:
      "You kept the relationship intact under real pressure. Margaret's tone warmed noticeably after 2:40, and she finished by agreeing to a follow-up call. You could build more trust by making a personal commitment she can hold you to.",
    recommendation:
      "Balance firmness on terms with generosity on attention. Offer something personal, like an executive sponsor or quarterly review, that costs little but signals long-term partnership.",
    drill: "List three low-cost, high-value commitments you can offer any key account, and practise weaving one into a close.",
  },
]

const RAW_SCORE =
  SKILLS.reduce((a, k) => a + k.score * k.weight, 0) /
  SKILLS.reduce((a, k) => a + k.weight, 0)

const REPORT_META = {
  id: "RPT-2026-0930-4417",
  date: "30 Sep 2026, 10:42",
  percentile: 72,
}

const KPIS = [
  { label: "Talk : Listen", value: "58 : 42", target: "Target 45 : 55", ok: false },
  { label: "Questions Asked", value: "11", target: "6 open, 5 closed", ok: true },
  { label: "Concessions", value: "2", target: "1 conditional, 1 not", ok: false },
  { label: "Interruptions", value: "2", target: "Target 0", ok: false },
  { label: "Speaking Pace", value: "148 wpm", target: "Ideal 130 to 160", ok: true },
  { label: "Deal Outcome", value: "Open", target: "Follow-up agreed", ok: true },
]

const STRENGTHS = [
  { title: "Client-specific value case", detail: "Used Northwind's own 14% improvement and a $310K figure to reframe price as return.", time: "3:15" },
  { title: "Strong opening question", detail: "Asked what success looks like for the CFO before discussing numbers.", time: "0:34" },
  { title: "Composure under an ultimatum", detail: "Kept a calm, collaborative tone when the Friday deadline was raised.", time: "1:02" },
]

const DEVELOPMENT = [
  { title: "Unconditional concession", detail: "Offered 10% without asking for a longer term or volume in return.", time: "6:40" },
  { title: "Missed buying signal", detail: "Margaret's openness to a longer term was not explored.", time: "7:55" },
  { title: "Shallow follow-up", detail: "Accepted 'lower cost, plain and simple' without probing the real driver.", time: "1:02" },
]

// Communication analysis — CEFR-style language proficiency plus sentiment/tone/clarity.
const CEFR = {
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
}

const SENTIMENT = [
  { label: "Positive", pct: 64, color: "#10b981" },
  { label: "Neutral", pct: 29, color: "#f59e0b" },
  { label: "Negative", pct: 7, color: "#f43f5e" },
]

const TONE = [
  { label: "Professional", pct: 82 },
  { label: "Supportive", pct: 71 },
  { label: "Encouraging", pct: 58 },
  { label: "Assertive", pct: 41 },
]

const CLARITY = {
  score: 7.8,
  note: "Your phrasing was easy to follow, with concise sentences and minimal filler. A few compound questions could be split for even sharper clarity.",
}

const GUIDELINES = [
  "You have 15 minutes to complete this roleplay.",
  "You will engage in a conversational interaction where you can choose to respond via audio or text input.",
  "The conversation will be adaptive; your responses will influence the outcomes of this interaction.",
  "Make sure your responses directly support the goal and help overcome the stated challenge.",
  "You need to achieve an overall score of 8 or above for the conversation to be successful.",
  "Your score and detailed feedback report will be shared at the end of the conversation.",
]

type Line = { speaker: string; time: string; text: string; tag?: "strength" | "gap" }

const TRANSCRIPT: Line[] = [
  {
    speaker: "Margaret Hale",
    time: "0:12",
    text: "Thanks for coming in. I'll be direct. We like the platform, but I have a mandate to cut spend this year and I can't renew at the current rate.",
  },
  {
    speaker: "You",
    time: "0:34",
    text: "I appreciate you being upfront, Margaret. Before we get into numbers, can you tell me what a successful renewal looks like from your CFO's side?",
  },
  {
    speaker: "Margaret Hale",
    time: "1:02",
    text: "Lower cost, plain and simple. And frankly, I have a quote from Freightwise that comes in 22% under yours. If you can't match it by Friday, we're moving.",
  },
  {
    speaker: "You",
    time: "1:28",
    text: "I understand. Our pricing reflects the uptime and support you've had over three years, and I'd hate to see that put at risk over a headline number.",
  },
  {
    speaker: "Margaret Hale",
    time: "2:05",
    text: "Uptime is expected. I need something I can take upstairs. So what can you actually do on price?",
  },
]

const FULL_TRANSCRIPT: Line[] = [
  { ...TRANSCRIPT[0] },
  { ...TRANSCRIPT[1], tag: "strength" },
  { ...TRANSCRIPT[2] },
  { ...TRANSCRIPT[3], tag: "gap" },
  { ...TRANSCRIPT[4] },
  { speaker: "You", time: "2:40", text: "It sounds like you're being asked to show real savings this year, and I want to help you do that. Can I share what the platform has actually saved you so far?", tag: "strength" },
  { speaker: "Margaret Hale", time: "2:58", text: "Go ahead, but keep it short." },
  { speaker: "You", time: "3:15", text: "Since go-live your late deliveries are down 14%. On your volumes that's roughly $310K a year in avoided penalties.", tag: "strength" },
  { speaker: "Margaret Hale", time: "3:52", text: "That's helpful. But my CFO sees an invoice that's 22% higher than the alternative. Savings are harder to see than costs." },
  { speaker: "You", time: "4:52", text: "Moving 40 depots mid-season is a real cost. Has that been priced into the Freightwise number?", tag: "strength" },
  { speaker: "Margaret Hale", time: "5:30", text: "They've offered free onboarding. I'll admit the migration worries my operations team." },
  { speaker: "You", time: "6:40", text: "I could probably look at around 10% off if that helps.", tag: "gap" },
  { speaker: "Margaret Hale", time: "7:05", text: "Ten is a start. It doesn't close the gap, though." },
  { speaker: "Margaret Hale", time: "7:55", text: "I'm not against a longer term, but I'd need price protection and a real reason to commit." },
  { speaker: "You", time: "8:20", text: "Understood. On support, we can also extend your coverage hours to include weekends.", tag: "gap" },
  { speaker: "Margaret Hale", time: "9:40", text: "Weekend support is nice, but it's not what moves the number." },
  { speaker: "You", time: "10:55", text: "What if we looked at a three-year term with pricing locked, and I include the dedicated migration team at no cost if you add the two new depots?" },
  { speaker: "Margaret Hale", time: "11:48", text: "Now that's something I can take to my CFO. Send me the numbers in writing." },
  { speaker: "You", time: "12:30", text: "I'll have a proposal to you by Wednesday. Can we set a call for Thursday to walk your CFO through it together?" },
  { speaker: "Margaret Hale", time: "13:20", text: "Thursday works. Don't make me regret it." },
]

function ScoreRing({
  score,
  max = 10,
  size = 120,
  level,
}: {
  score: number
  max?: number
  size?: number
  level: string
}) {
  const radius = (size - 20) / 2
  const circ = 2 * Math.PI * radius
  const pct = score / max
  const dash = pct * circ

  const color = bandFor(score).color

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--ink) / 0.07)"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1s ease-out",
            
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold text-ink"
          style={{ fontSize: size * 0.26, lineHeight: 1 }}
        >
          {score}
        </span>
        <span
          style={{
            fontSize: size * 0.1,
            color: "rgb(var(--ink) / 0.65)",
            fontFamily: "Inter",
          }}
        >
          /{max}
        </span>
      </div>
    </div>
  )
}

function WaveBar({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-full"
      style={{
        width: 3,
        background: "linear-gradient(to top, var(--accent), var(--brand))",
        animationName: "wave-bar",
        animationDuration: "1.2s",
        animationTimingFunction: "ease-in-out",
        animationIterationCount: "infinite",
        animationDelay: `${delay}s`,
      }}
    />
  )
}

function SectionLabel({
  index,
  children,
}: {
  index: string
  children: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="font-display text-xs font-semibold tracking-[0.2em] text-brand tabular-nums">
        {index}
      </span>
      <span className="h-px flex-none w-6 bg-ink/15" />
      <h2 className="font-display font-semibold text-ink text-base tracking-tight">
        {children}
      </h2>
    </div>
  )
}

const PORTRAIT_SRC =
  "https://images.unsplash.com/photo-1610721193651-e6aca85b45aa?w=900&h=1200&fit=crop&auto=format&q=80"
const SCENE_SRC =
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&h=700&fit=crop&auto=format&q=80"

// Live tile field: a grid of cells over the static box pattern. Cells breathe on staggered
// timers, a diagonal wave sweeps the grid, and a soft spotlight trails the pointer.
const TILE = 72
function BoxField() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [dims, setDims] = useState({ cols: 0, rows: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setDims({ cols: Math.ceil(el.clientWidth / TILE), rows: Math.min(14, Math.ceil(el.clientHeight / TILE)) })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const host = el.parentElement
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty("--mx", `${e.clientX - r.left}px`)
      el.style.setProperty("--my", `${e.clientY - r.top}px`)
      el.style.setProperty("--spot", "1")
    }
    const leave = () => el.style.setProperty("--spot", "0")
    host?.addEventListener("pointermove", move)
    host?.addEventListener("pointerleave", leave)
    return () => {
      ro.disconnect()
      host?.removeEventListener("pointermove", move)
      host?.removeEventListener("pointerleave", leave)
    }
  }, [])
  // Deterministic pseudo-random so the layout is stable across renders.
  const rnd = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  const cells = []
  for (let y = 0; y < dims.rows; y++)
    for (let x = 0; x < dims.cols; x++) {
      const i = y * dims.cols + x
      const live = rnd(i + 1) > 0.72
      cells.push(
        <span
          key={i}
          className={live ? "box-cell box-cell--live" : "box-cell"}
          style={{
            left: x * TILE,
            top: y * TILE,
            animationDelay: live ? `${(rnd(i + 7) * 9).toFixed(2)}s, ${((x + y) * 0.12).toFixed(2)}s` : `${((x + y) * 0.12).toFixed(2)}s`,
            animationDuration: live ? `${(5 + rnd(i + 3) * 6).toFixed(2)}s, 9s` : "9s",
          }}
        />,
      )
    }
  return (
    <div ref={ref} aria-hidden className="box-field">
      {cells}
      <span className="box-spot" />
    </div>
  )
}

function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="relative isolate min-h-full overflow-auto"
      style={{ background: "transparent" }}
    >
      <div aria-hidden className="box-pattern" />
      <BoxField />
      {/* Nav */}
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-10 h-16 border-b border-ink/10"
        style={{
          background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <span className="text-white text-sm font-bold font-display leading-none">
              AI
            </span>
          </div>
          <span className="text-ink font-display font-semibold text-base tracking-tight">
            RolePlay
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
            <span className="text-ink/70 text-xs font-medium font-display tracking-wide uppercase">
              Ready to Join
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero — text 70% / portrait 30% */}
      <header className="max-w-7xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-14 animate-fade-in-up">
        <div className="grid md:grid-cols-10 gap-10 md:gap-12 items-center">
          {/* Text */}
          <div className="md:col-span-7">
            <div
              className="inline-flex items-center gap-2.5 mb-7 px-3 py-1 text-xs font-medium font-display tracking-wide"
              style={{
                background: "rgb(var(--accent-rgb) / 0.12)",
                color: "var(--brand)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              Sales Negotiation
            </div>
            <h1 className="font-display font-bold text-4xl md:text-6xl text-ink tracking-tight leading-[1.03] mb-6">
              The Renewal
              <br />
              with Margaret Hale
            </h1>
            <p className="text-ink/70 text-sm leading-relaxed max-w-xl mb-9">
              Step in as the account executive on a seven-figure renewal. A
              tough procurement lead, a cheaper rival quote, and a Friday
              deadline. Fifteen adaptive minutes that score how you hold value
              under pressure.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onStart}
                className="group inline-flex items-center gap-3 px-8 py-4 font-display font-semibold text-white text-sm tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--accent-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--accent)")
                }
              >
                Join Call
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="flex items-center gap-5 text-ink/75 text-sm font-display">
                <span>15 min</span>
                <span className="w-px h-3.5 bg-ink/15" />
                <span>3 Objectives</span>
                <span className="w-px h-3.5 bg-ink/15" />
                <span>Up to 150 XP</span>
              </div>
            </div>

            {/* Player card */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 border border-ink/15 max-w-2xl" style={{ background: "var(--surface)" }}>
              {[
                { k: "Level", v: "Competent", sub: <span className="block mt-2 h-1 w-full" style={{ background: "rgb(var(--ink) / 0.12)" }}><span className="block h-full" style={{ width: "30%", background: "var(--brand)" }} /></span> },
                { k: "Season XP", v: <RollingNumber value={560} />, sub: <span className="text-ink/75 text-xs">140 XP to Proficient</span> },
                { k: "Badges", v: <span>0<span className="text-ink/70 text-sm">/{BADGES.length}</span></span>, sub: <span className="text-ink/75 text-xs">Unlock them in play</span> },
                { k: "Season Rank", v: "#4", sub: <span className="text-ink/75 text-xs">of {PLAYERS_COMPLETED} players</span> },
              ].map((c, i) => (
                <div key={c.k} className={`p-4 ${i ? "border-l border-ink/10" : ""} ${i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${i === 3 ? "max-sm:border-t" : ""}`}>
                  <p className="text-ink/75 text-[10px] font-display uppercase tracking-widest mb-1">{c.k}</p>
                  <p className="font-display font-bold text-ink text-lg">{c.v}</p>
                  {c.sub}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 max-w-2xl">
              <span className="text-ink/75 text-xs font-display uppercase tracking-widest mr-1">Badges up for grabs</span>
              {BADGES.map((b) => (
                <span key={b.id} className="flex items-center gap-2 text-xs text-ink/85" title={b.desc}>
                  <BadgeMedal mark={b.mark} earned={false} size={26} />
                  <span className="hidden md:inline">{b.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Portrait */}
          <div className="md:col-span-3">
            <figure
              className="relative aspect-[3/4] w-full overflow-hidden"
              style={{ background: "var(--surface-2)" }}
            >
              <img
                src={PORTRAIT_SRC}
                alt="Margaret Hale, VP of Procurement, in a white shirt"
                className="w-full h-full object-cover"
                style={{ filter: "grayscale(0.2) contrast(1.05)" }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, color-mix(in srgb, var(--bg) 92%, transparent) 0%, color-mix(in srgb, var(--bg) 70%, transparent) 30%, transparent 55%)",
                }}
              />
              <figcaption className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-display font-semibold text-ink text-sm">
                  Margaret Hale
                </p>
                <p className="text-ink/80 text-xs mt-0.5">
                  VP Procurement, Northwind Freight · Your client
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </header>

      {/* Scene band */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 pb-14">
        <div
          className="relative min-h-64 w-full overflow-hidden border border-ink/10 flex items-center"
          style={{ background: "var(--surface-2)" }}
        >
          <img
            src={SCENE_SRC}
            alt="A modern glass-walled meeting room"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "grayscale(0.35) brightness(0.5)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, var(--bg) 0%, color-mix(in srgb, var(--bg) 97%, transparent) 55%, color-mix(in srgb, var(--bg) 35%, transparent) 100%)",
            }}
          />
          <div className="relative flex flex-col justify-center px-7 md:px-10 py-8 max-w-xl">
            <p className="font-display text-xs font-semibold tracking-[0.2em] text-brand mb-2">
              THE SCENE
            </p>
            <p className="text-ink text-sm leading-relaxed">
              Northwind's glass-walled boardroom, three days before the
              contract expires. Margaret has done her homework, brought a rival
              quote, and made it clear she is willing to walk. Her team relies
              on your platform every day, but her CFO only sees the invoice.
              What you uncover in the next few minutes decides whether this
              becomes a price war or a partnership.
            </p>
          </div>
        </div>
      </section>

      {/* Briefing — concise, text-forward */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pb-16 animate-fade-in-up">
        <div
          className="grid md:grid-cols-3 border border-ink/10 mb-6"
          style={{ background: "rgb(var(--ink) / 0.08)", gap: 1 }}
        >
          <section className="p-7" style={{ background: "var(--surface)" }}>
            <SectionLabel index="01">Your Role</SectionLabel>
            <p className="text-ink/80 text-sm leading-relaxed">
              You are a senior account executive at Cloudline and have owned
              the Northwind account since it was signed. The contract is worth
              $1.2M a year and your quarter depends on it. You know the
              platform has cut their late deliveries, but you also know your
              price is the highest in the market.
            </p>
          </section>
          <section className="p-7" style={{ background: "var(--surface)" }}>
            <SectionLabel index="02">Your Goal</SectionLabel>
            <p className="text-ink/80 text-sm leading-relaxed">
              Renew the contract on terms that protect your margin and the
              relationship. Find out what is really driving Margaret's
              position, trade value rather than hand out discounts, and leave
              with an agreed next step that both of you can take back to your
              leadership.
            </p>
          </section>
          <section
            className="p-7"
            style={{
              background: "rgba(244,63,94,0.05)",
              boxShadow: "inset 0 0 0 1px rgba(244,63,94,0.25)",
            }}
          >
            <div className="flex items-baseline gap-3 mb-5">
              <span className="font-display text-xs font-semibold tracking-[0.2em] text-danger tabular-nums">
                03
              </span>
              <span
                className="h-px flex-none w-6"
                style={{ background: "rgba(244,63,94,0.4)" }}
              />
              <h2 className="font-display font-semibold text-danger text-base tracking-tight">
                The Challenge
              </h2>
            </div>
            <p className="text-ink/85 text-sm leading-relaxed">
              Margaret lays down a competitor quote 22% below yours and a
              Friday deadline. Hold your ground without losing her, and turn an
              ultimatum into a real negotiation.
            </p>
          </section>
        </div>

        {/* Skills + Essentials */}
        <div className="grid md:grid-cols-12 gap-6">
          <section
            className="md:col-span-7 border border-ink/10 p-7 flex flex-col"
            style={{ background: "var(--surface)" }}
          >
            <SectionLabel index="04">Skills being Assessed</SectionLabel>
            <ul className="flex-1 grid sm:grid-cols-2 auto-rows-fr gap-3">
              {ASSESSED_SKILLS.map((sk, i) => (
                <li
                  key={sk.name}
                  className="group relative flex flex-col justify-between gap-3 p-4 border border-ink/10 transition-colors hover:border-[var(--brand)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-display text-xs text-brand font-semibold tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span aria-hidden className="h-px w-8 bg-ink/15 group-hover:bg-[var(--brand)] transition-colors" />
                  </span>
                  <span>
                    <span className="block font-display font-semibold text-ink text-sm mb-1">
                      {sk.name}
                    </span>
                    <span className="block text-ink/75 text-xs leading-relaxed">
                      {sk.desc}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section
            className="md:col-span-5 border border-ink/10 p-7 flex flex-col"
            style={{ background: "var(--surface)" }}
          >
            <SectionLabel index="05">Objectives</SectionLabel>
            <p className="text-ink/75 text-xs leading-relaxed mb-3">
              How each quest is judged stays hidden until you complete it. Play it the way you would a real call.
            </p>
            <ul className="mb-7">
              {LANDING_OBJECTIVES.map((o) => (
                <li
                  key={o.label}
                  className="flex items-baseline justify-between gap-4 py-3 border-t border-ink/10 first:border-t-0"
                >
                  <span className="flex items-start gap-3 text-sm leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 flex-none bg-brand" />
                    <span>
                      <span className="block font-display font-semibold text-ink">{o.label}</span>
                      <span className="block text-ink/75">{o.sub}</span>
                    </span>
                  </span>
                  <span className="font-display font-semibold text-brand text-sm tabular-nums whitespace-nowrap">
                    +{o.xp} XP
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={onStart}
              className="group mt-auto inline-flex items-center justify-center gap-3 px-6 py-3.5 font-display font-semibold text-white text-sm tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
              style={{ background: "var(--accent)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--accent-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--accent)")
              }
            >
              Join Call
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

const LIVE_PHRASE =
  "That's fair, Margaret. Before I talk price, help me understand what the Freightwise quote includes, and what your CFO would need to see to justify staying with us?"

const NPC_REPLIES = [
  "Their quote covers the core platform and standard support. No dedicated account team, and onboarding is extra. But my CFO doesn't read the fine print, he reads the total.",
  "If you could show me hard savings in our own numbers, I might have something to work with. Right now all I have is a bigger invoice than the alternative.",
  "I'm not against a longer term, but I'd need price protection and a real reason to commit. What would you be willing to put on the table for that?",
]

// Live voice meter: bar heights follow a smoothed random signal each frame while active,
// so it reads as real speech rather than a looping CSS wave.
function VoiceWave({ active, color, bars = 24, className = "" }: { active: boolean; color: string; bars?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const kids = Array.from(el.children) as HTMLElement[]
    if (!active || reduceMotion()) {
      kids.forEach((k) => (k.style.transform = `scaleY(${active ? 0.5 : 0.12})`))
      return
    }
    const lv = kids.map(() => 0.2)
    let raf = 0
    let t = 0
    const tick = () => {
      t += 1
      // Syllable envelope plus per-bar jitter; occasional dips mimic pauses between words.
      const env = 0.55 + 0.45 * Math.sin(t / 6) * Math.sin(t / 17)
      const pause = Math.sin(t / 40) > 0.85 ? 0.25 : 1
      kids.forEach((k, i) => {
        const centre = 1 - Math.abs(i - bars / 2) / (bars / 1.6)
        const target = Math.max(0.1, Math.min(1, env * pause * centre * (0.5 + Math.random() * 0.8)))
        lv[i] += (target - lv[i]) * 0.35
        k.style.transform = `scaleY(${lv[i].toFixed(3)})`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, bars])
  return (
    <span ref={ref} aria-hidden className={`inline-flex items-center justify-center gap-[3px] h-10 ${className}`}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="w-[3px] h-full rounded-full origin-center transition-opacity" style={{ background: color, transform: "scaleY(0.12)", opacity: active ? 1 : 0.35 }} />
      ))}
    </span>
  )
}

// ---------- Gamification ----------
type SessionStats = { startXp: number; endXp: number; badges: string[]; bestStreak: number; objectives: number; startRank: number; endRank: number }

const BADGES = [
  { id: "icebreaker", name: "Icebreaker", desc: "First on-topic reply", mark: "IB" },
  { id: "hot-streak", name: "Hot Streak", desc: "Three strong replies in a row", mark: "HS" },
  { id: "detective", name: "Detective", desc: "Uncovered the real driver", mark: "DT" },
  { id: "trader", name: "Value Trader", desc: "Traded value, not discounts", mark: "VT" },
  { id: "listener", name: "Deep Listener", desc: "Reflected the client's words", mark: "DL" },
  { id: "clean-sweep", name: "Clean Sweep", desc: "Completed every objective", mark: "CS" },
]
const OBJECTIVE_BADGE = ["detective", "trader", "listener"]

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

// Rolls a number up to its new value (ease-out), so every XP gain is felt, not just shown.
function useCountUp(value: number, ms = 900) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduceMotion()) {
      setShown(value)
      from.current = value
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)))
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, ms])
  return shown
}

function RollingNumber({ value, className }: { value: number; className?: string }) {
  const v = useCountUp(value)
  return <span className={`tabular-nums ${className ?? ""}`}>{v.toLocaleString()}</span>
}

const CONFETTI_COLORS = ["#ff8a4c", "#c2410c", "#efc23a", "#8dc063", "#fb7185", "#ffffff", "#e8420f"]

// Full-screen confetti cannon. Re-key it to fire again.
// Without an origin it fountains up from the lower centre; with one (viewport px) it
// bursts outward from that point, so celebrations land where the achievement is shown.
function ConfettiBurst({ pieces = 90, origin }: { pieces?: number; origin?: { x: number; y: number } }) {
  const [bits] = useState(() =>
    Array.from({ length: pieces }, (_, i) => {
      const a = origin
        ? Math.random() * Math.PI * 2
        : (-90 + (Math.random() - 0.5) * 150) * (Math.PI / 180)
      const v = origin ? 60 + Math.random() * 220 : 260 + Math.random() * 380
      return {
        i,
        x: 50 + (Math.random() - 0.5) * 10,
        dx: Math.cos(a) * v,
        dy: Math.sin(a) * v,
        rot: (Math.random() - 0.5) * 1080,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        d: 1.4 + Math.random() * 1.1,
        delay: Math.random() * 0.12,
        round: Math.random() > 0.7,
      }
    }),
  )
  if (reduceMotion()) return null
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {bits.map((b) => (
        <span
          key={b.i}
          className="absolute confetti-piece"
          style={{
            left: origin ? origin.x : `${b.x}%`,
            top: origin ? origin.y : "58%",
            width: b.w,
            height: b.round ? b.w : b.h,
            borderRadius: b.round ? 999 : 2,
            background: b.c,
            ["--dx" as string]: `${b.dx}px`,
            ["--dy" as string]: `${b.dy}px`,
            ["--rot" as string]: `${b.rot}deg`,
            animationDuration: `${b.d}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.5c.6 2.4 3.8 3.9 3.8 7.4A3.8 3.8 0 0 1 8 12.7a3.8 3.8 0 0 1-3.8-3.8c0-1.6.8-2.6 1.6-3.4.2 1.1.8 1.8 1.5 2.1C7 5.6 7.2 3.4 8 1.5Z" fill="currentColor" />
      <path d="M8 14.5a2.2 2.2 0 0 1-2.2-2.2c0-1 .7-1.7 1.3-2.2.1.7.5 1 .9 1.2.1-.8.4-1.5 1-2.1.6 1 1.2 1.8 1.2 3.1A2.2 2.2 0 0 1 8 14.5Z" fill="currentColor" opacity=".55" />
    </svg>
  )
}

function BadgeMedal({ mark, earned = true, size = 44 }: { mark: string; earned?: boolean; size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center font-display font-bold flex-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.3,
        clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
        background: earned ? "linear-gradient(150deg, #ff8a4c, var(--accent) 55%, var(--accent-2))" : "rgb(var(--ink) / 0.1)",
        color: earned ? "#ffffff" : "rgb(var(--ink) / 0.7)",
      }}
    >
      {mark}
    </span>
  )
}

const OBJECTIVES = LANDING_OBJECTIVES.map((o) => o.label)

// Signals that a reply actually belongs to *this* scenario, a contract renewal negotiation,
// rather than just being any well-formed sentence. XP is gated on these, not word count.
const TOPIC_RX =
  /\b(price|pricing|cost|discount|quote|contract|renew|term|budget|value|saving|roi|deal|offer|proposal|competitor|freightwise|cfo|support|platform|volume|scope|margin|invoice|deadline|friday|delivery|deliveries|partner|commit|agreement|number|spend)\b/i

// Each test maps to the objective at the same index, so completing one is behavioural, not automatic.
const OBJECTIVE_TESTS: ((t: string) => boolean)[] = [
  (t) =>
    /\?/.test(t) &&
    /\b(what|how|why|tell me|describe|walk me|explain|share|which|when|could you|can you)\b/i.test(
      t,
    ),
  (t) =>
    /\b(in return|in exchange|if you|if we|trade|longer term|multi-year|volume|scope|commit|case study|price protection|saving|roi|value)\b/i.test(
      t,
    ),
  (t) =>
    /\b(you mentioned|you said|you talked|sounds like|so you|earlier you|you noted|i hear you|you described|following up|to clarify|if i understand|that means)\b/i.test(
      t,
    ),
]

const PEERS = [
  { name: "Sarah Kim", pts: 940, level: "Role Model" },
  { name: "Marcus Lee", pts: 815, level: "Proficient" },
  { name: "Priya Nair", pts: 690, level: "Proficient" },
  { name: "Diego Alvarez", pts: 555, level: "Competent" },
  { name: "Emma Wu", pts: 430, level: "Competent" },
]

// Compact, tactile control with a hover tooltip and an optional count badge.
function ToolButton({
  active,
  onClick,
  label,
  badge,
  badgeColor,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  badge?: ReactNode
  badgeColor?: string
  children: ReactNode
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className="tool-btn relative w-10 h-10 flex items-center justify-center"
        style={{
          background: active
            ? "rgb(var(--accent-rgb) / 0.16)"
            : "rgb(var(--ink) / 0.05)",
          color: active ? "var(--brand)" : "rgb(var(--ink) / 0.7)",
          border: active
            ? "1px solid rgb(var(--accent-rgb) / 0.45)"
            : "1px solid rgb(var(--ink) / 0.1)",
          boxShadow: active ? "0 0 0 3px rgb(var(--accent-rgb) / 0.1)" : "none",
        }}
      >
        {children}
        {badge != null && (
          <span
            key={String(badge)}
            className="badge-pop absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold font-display rounded-full tabular-nums"
            style={{
              background: badgeColor ?? "var(--brand)",
              color: "#0c0c0f",
            }}
          >
            {badge}
          </span>
        )}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-[11px] font-display rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:[animation:tip-in_0.15s_ease-out] z-50"
        style={{ background: "rgb(var(--ink) / 0.92)", color: "var(--bg)" }}
      >
        {label}
      </span>
    </div>
  )
}

// Owns its own interval so the per-second tick re-renders only these two lines,
// not the entire session view (video, panels, leaderboard, transcript).
function CountdownTimer({ initial }: { initial: number }) {
  const [t, setT] = useState(initial)
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])
  const mins = String(Math.floor(t / 60)).padStart(2, "0")
  const secs = String(t % 60).padStart(2, "0")
  return (
    <div className="hidden sm:flex flex-col items-center pr-2 mr-1 border-r border-ink/10">
      <span className="text-ink/70 text-[10px] font-medium tracking-widest uppercase font-display">
        Remaining
      </span>
      <span className="font-display font-bold text-ink text-base tracking-wide tabular-nums">
        {mins}:{secs}
      </span>
    </div>
  )
}

const LEADERBOARD_ICON = (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="6" width="3" height="7" fill="#cbd5e1" />
    <rect x="5.5" y="2" width="3" height="11" fill="#f59e0b" />
    <rect x="10" y="8" width="3" height="5" fill="#d97706" />
  </svg>
)

function SessionPage({
  onEnd,
}: {
  onEnd: (messages: typeof TRANSCRIPT, stats: SessionStats) => void
}) {
  const [timeLeft, setTimeLeft] = useState(459)
  const [muted, setMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [speaking, setSpeaking] = useState(true)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showObjectives, setShowObjectives] = useState(true)
  const [showTranscript, setShowTranscript] = useState(true)
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState(TRANSCRIPT)
  const [xp, setXp] = useState(560)
  const [streak, setStreak] = useState(2)
  const [turns, setTurns] = useState(0)
  const [combo, setCombo] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState<number | null>(null)
  const [burst, setBurst] = useState<{ n: number; origin?: { x: number; y: number } }>({ n: 0 })
  const [unlock, setUnlock] = useState<{ key: number; title: string; sub: string; xp: number; kind: "objective" | "level" | "badge" } | null>(null)
  const [badges, setBadges] = useState<string[]>([])
  const [bestStreak, setBestStreak] = useState(2)
  const [floats, setFloats] = useState<{ id: number; v: number; mult: boolean }[]>([])
  const startXpRef = useRef(560)
  const [metObjectives, setMetObjectives] = useState<boolean[]>([
    false,
    false,
    false,
  ])
  const [feedback, setFeedback] = useState<{
    gain: number
    note: string
    ok: boolean
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const startRef = useRef(Date.now())

  // Message timestamps derive from wall-clock, so the countdown can tick in its own
  // component without re-rendering the whole session every second.
  function nowStamp() {
    const e = 125 + Math.floor((Date.now() - startRef.current) / 1000)
    return `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`
  }

  // Opening line: Margaret finishes speaking before the floor opens.
  useEffect(() => {
    const id = window.setTimeout(() => setSpeaking(false), 3200)
    return () => window.clearTimeout(id)
  }, [])

  // Dictation: live transcript fills as you speak; when you finish (or tap stop) the
  // message is sent automatically, as it would be in a real call.
  const dictRef = useRef("")
  useEffect(() => {
    if (!isRecording) return
    const words = LIVE_PHRASE.split(" ")
    let i = 0
    dictRef.current = ""
    setDraft("")
    const id = setInterval(() => {
      i += 1
      dictRef.current = words.slice(0, i).join(" ")
      setDraft(dictRef.current)
      if (i >= words.length) {
        clearInterval(id)
        setIsRecording(false)
        handleSubmit(dictRef.current)
      }
    }, 150)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording])

  function toggleMic() {
    if (speaking) return
    if (isRecording) {
      setIsRecording(false)
      if (dictRef.current.trim()) handleSubmit(dictRef.current)
    } else setIsRecording(true)
  }

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, showTranscript])

  const level =
    xp >= 900
      ? "Role Model"
      : xp >= 700
        ? "Proficient"
        : xp >= 500
          ? "Competent"
          : "Emerging"
  const levelFloor = xp >= 900 ? 900 : xp >= 700 ? 700 : xp >= 500 ? 500 : 300
  const levelCeil = levelFloor + 200
  const levelPct = Math.min(
    100,
    ((xp - levelFloor) / (levelCeil - levelFloor)) * 100,
  )

  const objectivesDone = metObjectives.filter(Boolean).length
  const objectivesPct = (objectivesDone / OBJECTIVES.length) * 100
  const CONFETTI = [
    { a: -70, d: 26, c: "#ff8a4c" },
    { a: -35, d: 30, c: "#34d399" },
    { a: 0, d: 32, c: "#f59e0b" },
    { a: 35, d: 30, c: "#e8420f" },
    { a: 70, d: 26, c: "#fb7185" },
    { a: -110, d: 24, c: "#34d399" },
    { a: 110, d: 24, c: "#ff8a4c" },
    { a: 180, d: 22, c: "#f59e0b" },
  ]

  // Ranked board with the player folded in.
  const board = [...PEERS, { name: "You", pts: xp, you: true }]
    .sort((a, b) => b.pts - a.pts)
    .map((p, i) => ({ ...p, rank: i + 1 }))
  const myRank =
    board.find((p) => (p as { you?: boolean }).you)?.rank ?? board.length

  // Margaret takes the floor: a short think, then her line streams as she says it.
  // The player cannot interrupt; mic and composer stay locked until she finishes.
  function scheduleReply() {
    setSpeaking(true)
    const words = NPC_REPLIES[turns % NPC_REPLIES.length].split(" ")
    window.setTimeout(() => {
      setMessages((m) => [...m, { speaker: "Margaret Hale", time: nowStamp(), text: "" }])
      let i = 0
      const id = window.setInterval(() => {
        i += 1
        setMessages((m) => {
          const c = [...m]
          c[c.length - 1] = { ...c[c.length - 1], text: words.slice(0, i).join(" ") }
          return c
        })
        if (i >= words.length) {
          window.clearInterval(id)
          window.setTimeout(() => setSpeaking(false), 400)
        }
      }, 170)
    }, 900)
  }

  function handleSubmit(override?: string) {
    const text = (override ?? draft).trim()
    if (!text || speaking) return
    const lower = text.toLowerCase()
    const words = text.split(/\s+/).filter(Boolean)
    const substantive = words.length >= 4
    const onTopic = TOPIC_RX.test(lower)
    const matched = OBJECTIVE_TESTS.map((fn) => fn(lower))
    const newlyMet = matched.map((m, i) => m && !metObjectives[i])
    const newCount = newlyMet.filter(Boolean).length

    setMessages((m) => [...m, { speaker: "You", time: nowStamp(), text }])
    setDraft("")
    setIsRecording(false)
    setTurns((t) => t + 1)

    // Relevance gate: a line that neither engages the scenario nor advances an objective
    // earns nothing and breaks the streak — length alone is never rewarded.
    if (!onTopic && !matched.some(Boolean)) {
      setStreak(0)
      setFeedback({
        gain: 0,
        note: "Off-topic. Steer back to the negotiation",
        ok: false,
      })
      window.setTimeout(() => setFeedback(null), 2600)
      scheduleReply()
      return
    }

    // Context-weighted XP: relevance + objectives newly hit + a modest, capped length bonus.
    // A hot streak (3+ strong replies) multiplies the whole turn by 1.5.
    const nextStreak = streak + 1
    const mult = nextStreak >= 3
    const base =
      (onTopic ? 25 : 0) +
      newCount * 45 +
      (substantive ? Math.min(words.length, 20) : 0)
    const gain = Math.round(base * (mult ? 1.5 : 1))

    const earned: string[] = []
    const addBadge = (id: string) => {
      if (!badges.includes(id) && !earned.includes(id)) earned.push(id)
    }
    if (onTopic) addBadge("icebreaker")
    if (nextStreak >= 3) addBadge("hot-streak")
    newlyMet.forEach((m, i) => m && addBadge(OBJECTIVE_BADGE[i]))
    if (metObjectives.every((v, i) => v || newlyMet[i])) addBadge("clean-sweep")
    if (earned.length) setBadges((b) => [...b, ...earned])

    const levelOf = (v: number) => (v >= 900 ? "Role Model" : v >= 700 ? "Proficient" : v >= 500 ? "Competent" : "Emerging")
    const levelledUp = levelOf(xp + gain) !== levelOf(xp)

    if (newCount > 0) {
      setMetObjectives((prev) => prev.map((v, i) => v || newlyMet[i]))
      const idx = newlyMet.indexOf(true)
      setCelebrate(idx)
      window.setTimeout(() => setCelebrate(null), 1100)
    }

    // Celebrations, most important first: level up, then objective, then badge.
    const b0 = BADGES.find((b) => b.id === earned[0])
    const moment = levelledUp
      ? { title: `Level up: ${levelOf(xp + gain)}`, sub: "New rank unlocked on the leaderboard", xp: gain, kind: "level" as const }
      : newCount > 0
        ? { title: "Objective complete", sub: OBJECTIVES[newlyMet.indexOf(true)], xp: gain, kind: "objective" as const }
        : b0
          ? { title: `Badge unlocked: ${b0.name}`, sub: b0.desc, xp: gain, kind: "badge" as const }
          : null
    if (moment) {
      setUnlock({ key: Date.now(), ...moment })
      window.setTimeout(() => setUnlock(null), 2600)
      if (moment.kind !== "badge") {
        // Objective confetti fires from that objective in the open sidebar, or from the
        // top-bar Objectives button when the sidebar is closed.
        let origin: { x: number; y: number } | undefined
        if (moment.kind === "objective") {
          const row = document.querySelector<HTMLElement>(`[data-objective="${newlyMet.indexOf(true)}"]`)
          const btn = document.querySelector<HTMLElement>("[data-anchor='objectives-btn']")
          const el = row && row.getClientRects().length ? row : btn
          if (el) {
            const rc = el.getBoundingClientRect()
            origin = { x: rc.left + Math.min(rc.width / 2, 28), y: rc.top + rc.height / 2 }
          }
        }
        setBurst((b) => ({ n: b.n + 1, origin }))
      }
    }

    const fid = Date.now()
    setFloats((f) => [...f, { id: fid, v: gain, mult }])
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== fid)), 1400)

    setXp((x) => x + gain)
    setBestStreak((b) => Math.max(b, nextStreak))
    setStreak((s) => s + 1)
    setCombo(gain)
    const note =
      newCount > 0 ? `${OBJECTIVES[newlyMet.indexOf(true)]} complete` : "On topic"
    setFeedback({ gain, note, ok: true })
    window.setTimeout(() => {
      setCombo(null)
      setFeedback(null)
    }, 2400)
    scheduleReply()
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: "transparent" }}
    >
      {/* Top bar — participants named up top */}
      <div className="flex items-center justify-between px-5 md:px-8 h-16 border-b border-ink/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 flex items-center justify-center flex-none"
            style={{ background: "var(--accent)" }}
          >
            <span className="text-white text-sm font-bold font-display leading-none">
              AI
            </span>
          </div>
          <span
            className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 text-[11px] font-display uppercase tracking-wider"
            style={{ background: "rgba(52,211,153,0.12)", color: "var(--ok)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" /> Live
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* XP HUD: level, rolling XP, progress to next level, streak multiplier */}
          <div className="relative hidden md:flex items-center gap-3 pl-1 pr-3 py-1 border border-ink/15" style={{ background: "var(--surface)" }}>
            <span className="relative w-9 h-9 flex items-center justify-center" aria-hidden>
              <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(var(--ink) / 0.12)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(levelPct / 100) * 94.2} 94.2`} style={{ transition: "stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)" }} />
              </svg>
              <span className="absolute font-display font-bold text-[10px] text-ink">{level.split(" ").map((w) => w[0]).join("")}</span>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-ink/75 text-[10px] font-display uppercase tracking-widest">{level}</span>
              <span className="font-display font-bold text-ink text-sm">
                <RollingNumber value={xp} /> <span className="text-ink/70 font-medium text-xs">XP</span>
              </span>
            </span>
            <span
              className="flex items-center gap-1 px-2 py-1 text-xs font-display font-bold tabular-nums"
              style={streak >= 3 ? { background: "var(--accent)", color: "#fff" } : { background: "rgb(var(--ink) / 0.06)", color: "rgb(var(--ink) / 0.8)" }}
              aria-label={`Streak ${streak}${streak >= 3 ? ", 1.5 times XP active" : ""}`}
            >
              <FlameIcon size={13} />
              {streak}
              {streak >= 3 && <span className="text-[10px] font-semibold">x1.5</span>}
            </span>
            <span className="text-ink/75 text-xs font-display tabular-nums" aria-label={`${badges.length} badges earned`}>
              <span className="font-bold text-ink">{badges.length}</span>/{BADGES.length} badges
            </span>
            {floats.map((f) => (
              <span key={f.id} aria-hidden className="xp-float absolute left-12 -bottom-1 font-display font-bold text-sm" style={{ color: "var(--brand)" }}>
                +{f.v}{f.mult ? " x1.5" : ""}
              </span>
            ))}
          </div>
          <CountdownTimer initial={459} />

          <ToolButton
            active={showTranscript}
            onClick={() => setShowTranscript((v) => !v)}
            label="Transcript"
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <rect
                x="1"
                y="2"
                width="12"
                height="1.6"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                x="1"
                y="6.2"
                width="8"
                height="1.6"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                x="1"
                y="10.4"
                width="10"
                height="1.6"
                rx="0.8"
                fill="currentColor"
              />
            </svg>
          </ToolButton>
          <span data-anchor="objectives-btn" className="inline-flex">
          <ToolButton
            active={showObjectives}
            onClick={() => setShowObjectives((v) => !v)}
            label="Objectives"
            badge={`${objectivesDone}/${OBJECTIVES.length}`}
            badgeColor="var(--ok)"
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 7.5l3 3 7-7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ToolButton>
          </span>
          <ToolButton
            active={showLeaderboard}
            onClick={() => setShowLeaderboard((v) => !v)}
            label="Leaderboard"
            badge={`#${myRank}`}
            badgeColor="#f59e0b"
          >
            {LEADERBOARD_ICON}
          </ToolButton>
          <ThemeToggle />
          <button
            onClick={() =>
              onEnd(messages, {
                startXp: startXpRef.current,
                endXp: xp,
                badges,
                bestStreak,
                objectives: objectivesDone,
                startRank: 4,
                endRank: myRank,
              })
            }
            className="tool-btn px-3.5 py-2 text-xs font-semibold font-display"
            style={{
              background: "rgba(244,63,94,0.12)",
              color: "var(--danger)",
              border: "1px solid rgba(244,63,94,0.3)",
            }}
          >
            End Call
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Transcript — left panel */}
        {showTranscript && (
          <aside
            className="hidden md:flex w-80 flex-none border-r border-ink/10 flex-col overflow-hidden"
            style={{ background: "var(--surface-3)" }}
          >
            <div className="px-4 py-3 border-b border-ink/10 flex items-center justify-between flex-none">
              <span className="font-display font-semibold text-ink text-sm tracking-tight">
                Transcript
              </span>
              <div className="flex items-center gap-2">
                <span className="text-ink/70 text-xs tabular-nums">
                  {messages.length} lines
                </span>
                <button
                  onClick={() => setShowTranscript(false)}
                  className="tool-btn -mr-1 w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink/80 transition-colors"
                  aria-label="Hide transcript"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto px-4 py-4 space-y-4"
            >
              {messages.map((t, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-1 ${
                    t.speaker === "You" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink/70 text-[10px] font-display">
                      {t.speaker}
                    </span>
                    <span className="text-ink/70 text-[10px] tabular-nums">
                      {t.time}
                    </span>
                  </div>
                  <div
                    className="max-w-[88%] px-3 py-2 text-sm leading-relaxed"
                    style={
                      t.speaker === "You"
                        ? {
                            background: "rgb(var(--accent-rgb) / 0.16)",
                            color: "rgb(var(--ink) / 0.9)",
                            border: "1px solid rgb(var(--accent-rgb) / 0.3)",
                          }
                        : {
                            background: "rgb(var(--ink) / 0.05)",
                            color: "rgb(var(--ink) / 0.7)",
                            border: "1px solid rgb(var(--ink) / 0.08)",
                          }
                    }
                  >
                    {t.text}
                  </div>
                </div>
              ))}
              {speaking && messages[messages.length - 1]?.speaker === "You" && (
                <div
                  className="flex items-center gap-1 px-3 py-2 w-fit"
                  style={{
                    background: "rgb(var(--ink) / 0.05)",
                    border: "1px solid rgb(var(--ink) / 0.08)",
                  }}
                >
                  {[0, 0.15, 0.3].map((d, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-ink/40"
                      style={{
                        animation: `pulse ${1 + d}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 flex flex-col overflow-hidden px-4 md:px-8 py-5 gap-4">
          {/* RolePlay topic banner */}
          <div
            className="border border-ink/10 flex-none px-5 py-4"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[10px] font-display uppercase tracking-widest"
                style={{ color: "var(--brand)" }}
              >
                RolePlay Scenario
              </span>
              <span
                className="px-1.5 py-0.5 text-[10px] font-display uppercase tracking-wider"
                style={{
                  background: "rgba(52,211,153,0.14)",
                  color: "var(--ok)",
                }}
              >
                Live
              </span>
            </div>
            <h2 className="font-display font-bold text-ink text-lg md:text-xl tracking-tight leading-snug">
              {SCENARIO_TITLE}
            </h2>
            <p className="text-ink/70 text-sm mt-1 truncate">
              Protect the deal and the relationship under price pressure.
            </p>
          </div>

          {/* Video split */}
          <div
            className="flex-1 grid grid-cols-1 md:grid-cols-2 border border-ink/10 min-h-0"
            style={{ background: "rgb(var(--ink) / 0.08)", gap: 1 }}
          >
            {/* NPC frame */}
            <div
              className="relative overflow-hidden flex flex-col items-center justify-center min-h-[200px]"
              style={{ background: "var(--surface-3)" }}
            >
              <div className="relative flex flex-col items-center gap-5 z-10">
                <div className="relative">
                  {speaking && (
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "rgb(var(--accent-rgb) / 0.15)",
                        animation: "pulse-ring 2s ease-out infinite",
                        margin: -14,
                      }}
                    />
                  )}
                  <div
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: "var(--accent)",
                      border: speaking
                        ? "2px solid var(--brand)"
                        : "2px solid rgb(var(--ink) / 0.12)",
                      transition: "border-color 0.6s ease",
                    }}
                  >
                    <svg width="46" height="46" viewBox="0 0 36 36" fill="none">
                      <circle
                        cx="18"
                        cy="13"
                        r="7"
                        fill="rgb(var(--ink) / 0.9)"
                      />
                      <path
                        d="M4 34c0-7.732 6.268-14 14-14s14 6.268 14 14"
                        stroke="rgb(var(--ink) / 0.9)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
                <VoiceWave active={speaking} color="var(--brand)" className="w-44" />
                <p aria-live="polite" className="text-xs font-display uppercase tracking-widest text-ink/75 h-4">
                  {speaking ? "Speaking" : isRecording ? "Listening" : "Waiting for you"}
                </p>
              </div>
              <div
                className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-2"
                style={{ background: "rgba(0,0,0,0.5)" }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    speaking ? "bg-[var(--ok)] animate-pulse" : "bg-ink/30"
                  }`}
                />
                <span className="text-ink/85 text-xs font-medium font-display">
                  Margaret Hale
                </span>
              </div>
            </div>

            {/* User frame */}
            <div
              className="relative overflow-hidden flex flex-col items-center justify-center min-h-[200px]"
              style={{ background: "var(--surface-3)" }}
            >
              {cameraOn ? (
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&h=800&fit=crop&auto=format"
                    alt="Your camera view"
                    className="w-full h-full object-cover opacity-70"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, color-mix(in srgb, var(--bg) 85%, transparent), transparent 55%)",
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 opacity-60">
                  <div className="w-20 h-20 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center">
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-ink/70"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 21.75c-2.7 0-5.2-.58-7.5-1.63z"
                      />
                    </svg>
                  </div>
                  <span className="text-ink/70 text-sm font-medium">
                    Camera Off
                  </span>
                </div>
              )}
              <div
                className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-2 z-10"
                style={{ background: "rgba(0,0,0,0.5)" }}
              >
                {isRecording && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                )}
                <span className="text-ink/85 text-xs font-medium font-display">
                  You
                </span>
                {muted && (
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                    <line
                      x1="2"
                      y1="2"
                      x2="16"
                      y2="16"
                      stroke="var(--danger)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 3v5.5M5 7H3v4h2l4 3V4"
                      stroke="rgb(var(--ink) / 0.5)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-1">
                <VoiceWave active={isRecording} color="var(--danger)" className="w-44" />
                <p className="text-xs font-display uppercase tracking-widest text-ink/75 h-4">
                  {isRecording ? "You are speaking" : speaking ? "Listening" : "Your turn"}
                </p>
              </div>
              {combo !== null && (
                <div
                  role="status"
                  className="absolute top-3 right-3 px-2.5 py-1 font-display font-bold text-xs animate-fade-in-up z-10"
                  style={{
                    background: "rgba(16,185,129,0.22)",
                    color: "var(--ok)",
                  }}
                >
                  +{combo} XP
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 flex-none">
            <button
              className="w-12 h-12 flex items-center justify-center transition-colors"
              style={{
                background: cameraOn
                  ? "rgb(var(--ink) / 0.06)"
                  : "rgba(244,63,94,0.12)",
                border: cameraOn
                  ? "1px solid rgb(var(--ink) / 0.12)"
                  : "1px solid rgba(244,63,94,0.3)",
              }}
              onClick={() => setCameraOn((v) => !v)}
              aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
              aria-pressed={cameraOn}
            >
              {cameraOn ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgb(var(--ink) / 0.8)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 16v3a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
            <button
              className="w-12 h-12 flex items-center justify-center transition-colors"
              style={{
                background: muted
                  ? "rgba(244,63,94,0.12)"
                  : "rgb(var(--ink) / 0.06)",
                border: muted
                  ? "1px solid rgba(244,63,94,0.3)"
                  : "1px solid rgb(var(--ink) / 0.12)",
              }}
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
            >
              {muted ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <line
                    x1="2"
                    y1="2"
                    x2="16"
                    y2="16"
                    stroke="var(--danger)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9 3v5.5M5 7H3v4h2l4 3V4"
                    stroke="rgb(var(--ink) / 0.5)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M5 7H3v4h2l4 3V4L5 7z"
                    fill="rgb(var(--ink) / 0.8)"
                  />
                  <path
                    d="M12.5 5.5c1.167 1 1.167 5 0 6"
                    stroke="rgb(var(--ink) / 0.8)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Composer — ChatGPT-style input with dictation */}
          <div className="flex-none">
            {feedback && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 mb-2 px-3 py-2 text-xs font-display animate-fade-in-up"
                style={
                  feedback.ok
                    ? {
                        background: "rgba(16,185,129,0.16)",
                        color: "var(--ok)",
                        border: "1px solid rgba(16,185,129,0.4)",
                      }
                    : {
                        background: "rgba(244,63,94,0.14)",
                        color: "var(--danger)",
                        border: "1px solid rgba(244,63,94,0.45)",
                      }
                }
              >
                <span className="font-bold tabular-nums">
                  {feedback.gain > 0 ? `+${feedback.gain} XP` : "No XP"}
                </span>
                <span className="opacity-40">·</span>
                <span>{feedback.note}</span>
              </div>
            )}
            <div
              className="flex items-end gap-2 p-2 transition-colors"
              style={{
                background: "var(--surface)",
                opacity: speaking ? 0.7 : 1,
                border: isRecording
                  ? "1px solid rgb(var(--accent-rgb) / 0.55)"
                  : "1px solid rgb(var(--ink) / 0.12)",
              }}
            >
              <button
                onClick={toggleMic}
                disabled={speaking}
                aria-label={
                  speaking ? "Microphone locked while Margaret is speaking" : isRecording ? "Finish and send" : "Speak your response"
                }
                aria-pressed={isRecording}
                className="w-10 h-10 flex-none flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isRecording
                    ? "#e11d48"
                    : "rgb(var(--ink) / 0.06)",
                  border: isRecording
                    ? "none"
                    : "1px solid rgb(var(--ink) / 0.12)",
                }}
              >
                {isRecording ? (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <rect x="6" y="6" width="8" height="8" fill="white" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect
                      x="7.5"
                      y="3"
                      width="5"
                      height="9"
                      rx="2.5"
                      fill="rgb(var(--ink) / 0.75)"
                    />
                    <path
                      d="M4 10c0 3.314 2.686 6 6 6s6-2.686 6-6"
                      stroke="rgb(var(--ink) / 0.75)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1="10"
                      y1="16"
                      x2="10"
                      y2="19"
                      stroke="rgb(var(--ink) / 0.75)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
              <textarea
                value={draft}
                readOnly={isRecording}
                disabled={speaking}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                rows={1}
                placeholder={
                  speaking
                    ? "Margaret is speaking. Wait for your turn."
                    : isRecording
                      ? "Listening…"
                      : "Your turn. Tap the mic to speak, or type"
                }
                className="flex-1 min-w-0 resize-none bg-transparent text-ink text-sm leading-relaxed placeholder:text-ink/70 px-2 py-2.5 max-h-32 focus:outline-none"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={!draft.trim() || speaking || isRecording}
                aria-label="Send response"
                className="w-10 h-10 flex-none flex items-center justify-center transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                style={{
                  background: draft.trim() && !speaking && !isRecording
                    ? "var(--accent)"
                    : "rgb(var(--ink) / 0.08)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 13V3M4 7l4-4 4 4"
                    stroke={draft.trim() && !speaking && !isRecording ? "#fff" : "rgb(var(--ink) / 0.7)"}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className="text-ink/70 text-xs mt-2 px-1 flex items-center gap-1.5">
              {isRecording ? (
                <>
                  <VoiceWave active color="var(--danger)" bars={10} className="!h-3 w-12 !justify-start" />
                  Speaking. Your message sends when you finish, or tap stop.
                </>
              ) : speaking ? (
                <>Floor locked. You can reply once Margaret finishes.</>
              ) : (
                <>
                  Press <span className="text-ink/70 font-medium">Enter</span>{" "}
                  to send ·{" "}
                  <span className="text-ink/70 font-medium">Shift + Enter</span>{" "}
                  for a new line
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right column — objectives + leaderboard */}
        {(showObjectives || showLeaderboard) && (
          <div
            className="hidden lg:flex w-72 flex-none border-l border-ink/10 flex-col overflow-hidden"
            style={{ background: "var(--surface-3)" }}
          >
            {showObjectives && (
              <aside
                className={`flex flex-col overflow-hidden ${
                  showLeaderboard ? "border-b border-ink/10" : "flex-1"
                }`}
              >
                <div className="px-4 py-3 border-b border-ink/10 flex items-center justify-between flex-none">
                  <span className="font-display font-semibold text-ink text-sm tracking-tight">
                    Objectives
                  </span>
                  <button
                    onClick={() => setShowObjectives(false)}
                    className="tool-btn -mr-1 w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink/80 transition-colors"
                    aria-label="Close objectives"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                {/* Progress */}
                <div className="px-4 py-3 border-b border-ink/10 flex-none">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-ink/70 text-[10px] font-display uppercase tracking-widest">
                      Progress
                    </span>
                    <span className="font-display font-semibold text-ink text-xs tabular-nums">
                      {objectivesDone}/{OBJECTIVES.length}
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden"
                    style={{ background: "rgb(var(--ink) / 0.1)" }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${objectivesPct}%`,
                        background: "var(--ok)",
                      }}
                    />
                  </div>
                </div>
                <div className="py-2">
                  {OBJECTIVES.map((o, i) => {
                    const done = metObjectives[i]
                    const celebrating = celebrate === i
                    return (
                      <div
                        key={o}
                        data-objective={i}
                        className="flex items-center gap-3 px-4 py-2.5"
                      >
                        <div
                          className="relative w-9 h-9 flex-none flex items-center justify-center"
                          style={{
                            background: done
                              ? "rgba(52,211,153,0.14)"
                              : "rgb(var(--ink) / 0.05)",
                            border: done
                              ? "1px solid rgba(52,211,153,0.4)"
                              : "1px solid rgb(var(--ink) / 0.1)",
                          }}
                        >
                          {done ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 14 14"
                              fill="none"
                            >
                              <path
                                d="M2.5 7.5l2.8 2.8L11.5 4"
                                stroke="var(--ok)"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <span className="font-display font-semibold text-sm text-ink/70 tabular-nums">
                              {i + 1}
                            </span>
                          )}
                          {celebrating && (
                            <span
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              aria-hidden
                            >
                              {CONFETTI.map((p, k) => (
                                <span
                                  key={k}
                                  className="absolute w-1.5 h-1.5 rounded-[1px]"
                                  style={{
                                    background: p.c,
                                    ["--tx" as string]: `${Math.round(Math.cos((p.a * Math.PI) / 180) * p.d)}px`,
                                    ["--ty" as string]: `${Math.round(Math.sin((p.a * Math.PI) / 180) * p.d)}px`,
                                    animation:
                                      "confetti-burst 0.9s ease-out forwards",
                                  }}
                                />
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm leading-snug"
                            style={{
                              color: done
                                ? "rgb(var(--ink) / 0.85)"
                                : "rgb(var(--ink) / 0.62)",
                            }}
                          >
                            {o}
                          </p>
                          <p
                            className="text-[11px] font-display"
                            style={{
                              color: done
                                ? "var(--ok)"
                                : "rgb(var(--ink) / 0.62)",
                            }}
                          >
                            {done ? `Completed · +${LANDING_OBJECTIVES[i].xp} XP` : `Hidden criteria · ${LANDING_OBJECTIVES[i].xp} XP`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </aside>
            )}
            {showLeaderboard && (
              <aside className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-ink/10 flex items-center justify-between flex-none">
                  <span className="font-display font-semibold text-ink text-sm tracking-tight">
                    Cohort Leaderboard
                  </span>
                  <button
                    onClick={() => setShowLeaderboard(false)}
                    className="tool-btn -mr-1 w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink/80 transition-colors"
                    aria-label="Close leaderboard"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <p className="px-4 py-2.5 text-ink/70 text-xs border-b border-ink/10 flex-none">
                  Season XP · top of {PLAYERS_COMPLETED} players
                </p>
                <div className="flex-1 overflow-auto py-1">
                  {board.map((p) => {
                    const you = (p as { you?: boolean }).you
                    const medal =
                      p.rank === 1
                        ? "#f59e0b"
                        : p.rank === 2
                          ? "#cbd5e1"
                          : p.rank === 3
                            ? "#d97706"
                            : null
                    return (
                      <div
                        key={p.name}
                        className="flex items-center gap-3 px-4 py-2.5 border-l-2 transition-all duration-300 ease-out hover:translate-x-0.5 hover:bg-ink/[0.04]"
                        style={{
                          background: you
                            ? "rgb(var(--accent-rgb) / 0.12)"
                            : "transparent",
                          borderColor: you ? "var(--accent)" : "transparent",
                        }}
                      >
                        {medal ? (
                          <span
                            className="w-5 h-5 flex-none flex items-center justify-center rounded-full text-[10px] font-display font-bold"
                            style={{ background: medal, color: "#1a1500" }}
                          >
                            {p.rank}
                          </span>
                        ) : (
                          <span
                            className="font-display font-bold text-sm tabular-nums w-5 text-center flex-none"
                            style={{
                              color: you
                                ? "var(--brand)"
                                : "rgb(var(--ink) / 0.62)",
                            }}
                          >
                            {p.rank}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium truncate"
                            style={{
                              color: you ? "rgb(var(--ink))" : "rgb(var(--ink) / 0.8)",
                            }}
                          >
                            {p.name}
                            {you && <span className="text-brand"> (you)</span>}
                          </p>
                        </div>
                        <span
                          className="font-display font-semibold text-sm tabular-nums flex-none"
                          style={{
                            color: you
                              ? "var(--brand)"
                              : "rgb(var(--ink) / 0.7)",
                          }}
                        >
                          {p.pts.toLocaleString()}
                          <span className="text-[10px] font-normal text-ink/70"> XP</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="px-4 py-3 border-t border-ink/10 flex-none">
                  <p className="text-ink/70 text-xs">
                    You are{" "}
                    <span className="text-brand font-semibold">#{myRank}</span>{" "}
                    of {board.length}. Keep responding to climb.
                  </p>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {burst.n > 0 && <ConfettiBurst key={burst.n} origin={burst.origin} pieces={burst.origin ? 60 : 90} />}
      {unlock && (
        <div key={unlock.key} role="status" aria-live="assertive" className="fixed inset-x-0 top-24 z-[61] flex justify-center pointer-events-none px-4">
          <div className="unlock-pop flex items-center gap-4 pl-3 pr-6 py-3 border shadow-2xl" style={{ background: "var(--bg)", borderColor: "rgb(var(--accent-rgb) / 0.6)", boxShadow: "0 20px 60px -12px rgb(var(--accent-rgb) / 0.55)" }}>
            <BadgeMedal mark={unlock.kind === "level" ? "LV" : unlock.kind === "objective" ? "OK" : (BADGES.find((b) => unlock.title.endsWith(b.name))?.mark ?? "XP")} size={52} />
            <div>
              <p className="text-brand text-[11px] font-display font-bold uppercase tracking-widest">{unlock.title}</p>
              <p className="text-ink font-display font-semibold text-base">{unlock.sub}</p>
            </div>
            <p className="font-display font-bold text-2xl text-ink ml-2">
              +<RollingNumber value={unlock.xp} />
              <span className="text-sm text-ink/75"> XP</span>
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes wave-bar {
          from { height: 4px; }
          to { height: 16px; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

type ReportTab = "overview" | "skills" | "comm" | "transcript"

const scoreColor = (score: number) => bandFor(score).color
const scoreLabel = (score: number) =>
  score >= 9
    ? "Role Model"
    : score >= 7
      ? "Proficient"
      : score >= 5
        ? "Competent"
        : score >= 3
          ? "Emerging"
          : "Novice"
const cefrColor = (lvl: string) =>
  lvl.startsWith("C") ? "#c2410c" : lvl.startsWith("B") ? "#10b981" : "#f59e0b"

async function buildReportPdf(lines: Line[]) {
  // Loaded on demand so the PDF library stays out of the initial bundle.
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  let y = M
  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage()
      y = M
    }
  }
  const text = (t: string, size = 10, style: "normal" | "bold" | "italic" = "normal", color: [number, number, number] = [30, 26, 22]) => {
    doc.setFont("helvetica", style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const wrapped = doc.splitTextToSize(t, W - M * 2)
    ensure(wrapped.length * size * 1.35)
    doc.text(wrapped, M, y)
    y += wrapped.length * size * 1.35
  }
  const gap = (h = 10) => (y += h)
  const heading = (t: string) => {
    gap(8)
    ensure(30)
    doc.setDrawColor(194, 65, 12)
    doc.setLineWidth(1.5)
    doc.line(M, y, M + 28, y)
    gap(14)
    text(t, 13, "bold")
    gap(4)
  }
  const band = bandFor(SCORE)

  text("AI ROLEPLAY  ·  PERFORMANCE REPORT", 9, "bold", [184, 50, 15])
  gap(6)
  text(SCENARIO_TITLE, 20, "bold")
  text(`${REPORT_META.id}   ·   ${REPORT_META.date}   ·   Duration ${DURATION}`, 9, "normal", [90, 84, 78])

  heading("Performance Overview")
  text(`Overall score: ${SCORE}/10  (${band.label}, weighted average ${RAW_SCORE.toFixed(2)})`, 12, "bold")
  text("Knolskape ten-point scale: Novice 1–2, Emerging 3–4, Competent 5–6, Proficient 7–8, Role Model 9–10.", 9, "normal", [90, 84, 78])
  gap(6)
  text(KPIS.map((k) => `${k.label}: ${k.value} (${k.target})`).join("   |   "), 9)
  gap(6)
  text("Key strengths", 10, "bold")
  STRENGTHS.forEach((x) => text(`•  ${x.title} (${x.time}): ${x.detail}`, 10))
  gap(4)
  text("Development priorities", 10, "bold")
  DEVELOPMENT.forEach((x) => text(`•  ${x.title} (${x.time}): ${x.detail}`, 10))

  heading("Detailed Analysis")
  SKILLS.forEach((k, i) => {
    ensure(60)
    text(`${i + 1}. ${k.name}  ·  ${k.score}/10 ${scoreLabel(k.score)}  ·  weight ${k.weight}%`, 11, "bold")
    k.subskills.forEach((sub) => text(`    ${sub.name}: ${sub.score}/10. ${sub.note}`, 9))
    text(`Analysis: ${k.feedback}`, 9.5)
    text(`Recommendation: ${k.recommendation}`, 9.5)
    text(`Practice drill: ${k.drill}`, 9.5, "italic")
    gap(8)
  })

  heading("Communication Metrics")
  text(`CEFR level: ${CEFR.overall} (${CEFR.band}). ${CEFR.summary}`, 10)
  CEFR.dimensions.forEach((d) => text(`    ${d.name}: ${d.level}. ${d.note}`, 9))
  text(`Sentiment: ${SENTIMENT.map((x) => `${x.label} ${x.pct}%`).join(", ")}`, 10)
  text(`Tone: ${TONE.map((x) => `${x.label} ${x.pct}%`).join(", ")}`, 10)
  text(`Clarity: ${CLARITY.score.toFixed(1)}/10. ${CLARITY.note}`, 10)

  heading("Transcript")
  lines.forEach((l) => {
    text(`${l.time}  ${l.speaker}${l.tag ? `  [${l.tag === "strength" ? "Strength" : "Missed opportunity"}]` : ""}`, 9, "bold", [90, 84, 78])
    text(l.text, 10)
    gap(4)
  })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120, 114, 108)
    doc.text(`${REPORT_META.id}  ·  Page ${i} of ${pages}`, M, H - 24)
  }
  return doc
}

const PDF_NAME = `${REPORT_META.id}-renewal-negotiation.pdf`

function EmailDialog({ onClose, onDownload }: { onClose: () => void; onDownload: () => void }) {
  const [to, setTo] = useState("")
  const [note, setNote] = useState("")
  const [sent, setSent] = useState(false)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+(\s*,\s*[^\s@]+@[^\s@]+\.[^\s@]+)*$/.test(to.trim())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onClose])

  function send() {
    if (!valid) return
    const body = [
      note.trim(),
      note.trim() ? "" : null,
      `${SCENARIO_TITLE}`,
      `Overall score: ${SCORE}/10 (${scoreLabel(SCORE)})`,
      "",
      ...SKILLS.map((k) => `${k.name}: ${k.score}/10`),
      "",
      "Key strengths:",
      ...STRENGTHS.map((x) => `- ${x.title}`),
      "",
      "Development priorities:",
      ...DEVELOPMENT.map((x) => `- ${x.title}`),
      "",
      `The full PDF report (${PDF_NAME}) is attached.`,
    ]
      .filter((x) => x !== null)
      .join("\n")
    onDownload()
    window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(`Roleplay Report: ${SCENARIO_TITLE}`)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgb(0 0 0 / 0.55)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-title"
        className="w-full max-w-md rounded-2xl border border-ink/15 p-6 animate-fade-in-up"
        style={{ background: "var(--bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <>
            <h2 id="email-title" className="font-display font-semibold text-ink text-lg mb-2">Report ready to send</h2>
            <p className="text-ink/80 text-sm leading-relaxed mb-5">
              Your email app has opened with a summary addressed to <strong className="text-ink">{to}</strong>. The PDF has also been downloaded as <strong className="text-ink">{PDF_NAME}</strong>. Attach it before you send.
            </p>
            <button onClick={onClose} className="w-full px-5 py-3 rounded-xl font-display font-semibold text-sm text-white min-h-[44px]" style={{ background: "var(--accent)" }}>Done</button>
          </>
        ) : (
          <>
            <h2 id="email-title" className="font-display font-semibold text-ink text-lg mb-1">Email this report</h2>
            <p className="text-ink/75 text-sm mb-5">Share your results with a manager, coach, or yourself.</p>
            <label htmlFor="email-to" className="block text-ink text-xs font-semibold mb-1.5">Recipients</label>
            <input
              id="email-to"
              ref={inputRef}
              type="text"
              inputMode="email"
              autoComplete="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@company.com"
              aria-describedby="email-hint"
              className="w-full px-3.5 py-2.5 rounded-xl border border-ink/20 bg-transparent text-ink text-sm placeholder:text-ink/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            />
            <p id="email-hint" className="text-ink/70 text-xs mt-1.5 mb-4">Separate multiple addresses with commas.</p>
            <label htmlFor="email-note" className="block text-ink text-xs font-semibold mb-1.5">Message (optional)</label>
            <textarea
              id="email-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-ink/20 bg-transparent text-ink text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] mb-5"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-5 py-3 rounded-xl border border-ink/20 font-display font-semibold text-sm text-ink min-h-[44px]">Cancel</button>
              <button
                onClick={send}
                disabled={!valid}
                className="flex-1 px-5 py-3 rounded-xl font-display font-semibold text-sm text-white min-h-[44px] disabled:cursor-not-allowed"
                style={{ background: valid ? "var(--accent)" : "rgb(var(--ink) / 0.35)" }}
              >
                Send report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Ten-segment meter for a single skill: numeral, band, and exact position on the scale.
function SkillScore({ score }: { score: number }) {
  const b = bandFor(score)
  return (
    <div className="flex flex-col items-end gap-1.5 w-[8.5rem]" role="img" aria-label={`${score} out of 10, ${b.label}`}>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display font-bold text-ink text-2xl leading-none tabular-nums">{score}</span>
        <span className="text-ink/70 text-xs font-display">/10</span>
        <span className="ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold font-display" style={{ background: b.color, color: readableOn(b.color) }}>
          {b.label}
        </span>
      </div>
      <div className="flex gap-[3px] w-full" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1
          const inBand = n >= b.min && n <= b.max
          return (
            <span
              key={n}
              className="flex-1 h-2 rounded-[2px]"
              style={{
                background: n <= score ? b.color : "rgb(var(--ink) / 0.12)",
                boxShadow: inBand ? `0 0 0 1px ${b.color}` : undefined,
                marginLeft: n > 1 && n % 2 === 1 ? 3 : 0,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// Hexagonal radar of the six assessed skills on the 10-point scale, with an optional
// dashed peer-average outline.
function SkillRadar({ compare }: { compare: boolean }) {
  const size = 240
  const c = size / 2
  const R = 84
  const n = SKILLS.length
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [c + Math.cos(a) * R * (v / 10), c + Math.sin(a) * R * (v / 10)] as const
  }
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ")
  return (
    <figure className="w-full max-w-[15rem] mx-auto">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto overflow-visible" role="img" aria-label={`Skill profile radar. ${SKILLS.map((k) => `${k.name} ${k.score} of 10`).join(", ")}`}>
        {[2, 4, 6, 8, 10].map((g) => (
          <polygon key={g} points={poly(SKILLS.map(() => g))} fill="none" stroke="rgb(var(--ink) / 0.12)" strokeWidth={1} />
        ))}
        {SKILLS.map((_, i) => {
          const [x, y] = pt(i, 10)
          return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgb(var(--ink) / 0.12)" />
        })}
        {compare && (
          <polygon points={poly(SKILLS.map((k) => k.peer))} fill="none" stroke="rgb(var(--ink) / 0.7)" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        <polygon points={poly(SKILLS.map((k) => k.score))} fill="rgb(var(--accent-rgb) / 0.22)" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" />
        {SKILLS.map((k, i) => {
          const [x, y] = pt(i, k.score)
          return <circle key={k.name} cx={x} cy={y} r={3.5} fill={bandFor(k.score).color} stroke="var(--surface)" strokeWidth={1.5} />
        })}
        {SKILLS.map((k, i) => {
          const [x, y] = pt(i, 12.6)
          const words = k.name.split(" ")
          const mid = Math.ceil(words.length / 2)
          const lines = words.length > 1 ? [words.slice(0, mid).join(" "), words.slice(mid).join(" ")] : [k.name]
          return (
            <text key={k.name} x={x} y={y - (lines.length - 1) * 5} textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fill="rgb(var(--ink) / 0.8)">
              {lines.map((l, li) => (
                <tspan key={li} x={x} dy={li ? 11 : 0}>{l}</tspan>
              ))}
            </text>
          )
        })}
      </svg>
      {compare && (
        <figcaption className="flex justify-center gap-4 text-[11px] text-ink/75 mt-1">
          <span className="flex items-center gap-1.5"><span aria-hidden className="w-3 h-0.5 bg-[var(--brand)]" />You</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="w-3 border-t border-dashed border-ink/70" />Peers</span>
        </figcaption>
      )}
    </figure>
  )
}

function SummaryPage({
  transcript,
  stats,
}: {
  transcript: typeof TRANSCRIPT
  stats: SessionStats
}) {
  const [tab, setTab] = useState<ReportTab>("overview")
  const [expanded, setExpanded] = useState<number | null>(0)
  const peersReady = PLAYERS_COMPLETED > PEER_THRESHOLD
  const [compare, setCompare] = useState(peersReady)
  const [emailOpen, setEmailOpen] = useState(false)
  const [party, setParty] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setParty(false), 3000)
    return () => window.clearTimeout(t)
  }, [])
  const reportLines = transcript.length > TRANSCRIPT.length ? transcript : FULL_TRANSCRIPT
  const download = () => void buildReportPdf(reportLines).then((d) => d.save(PDF_NAME))
  const TABS: { id: ReportTab; label: string; icon: string }[] = [
    { id: "overview", label: "Performance Overview", icon: "◎" },
    { id: "skills", label: "Detailed Analysis", icon: "▤" },
    { id: "comm", label: "Communication", icon: "◈" },
    { id: "transcript", label: "Transcript", icon: "≡" },
  ]

  const CEFR_LADDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

  return (
    <div
      className="relative isolate min-h-full overflow-auto"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% 0%, rgb(var(--accent-rgb) / 0.14) 0%, transparent 60%)",
      }}
    >
      <div aria-hidden className="box-pattern" />
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-ink/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))" }}
          >
            <span className="text-white text-xs font-bold font-display">
              AI
            </span>
          </div>
          <span className="text-ink/70 font-display font-medium text-sm">
            AI RolePlay
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={download}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ink/85 text-xs font-semibold hover:text-ink border border-ink/15 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 2v7M4 6.5 7 9.5l3-3M2.5 12h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download PDF
          </button>
          <button
            onClick={() => setEmailOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ink/85 text-xs font-semibold hover:text-ink border border-ink/15 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="1.5" y="3" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
              <path d="m2 3.8 5 3.7 5-3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Email
          </button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-ink/70 text-xs uppercase tracking-widest font-medium mb-1">
              Roleplay Report
            </p>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-ink tracking-tight">
              {SCENARIO_TITLE}
            </h1>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink/75">
              {[
                ["Report", REPORT_META.id],
                ["Date", REPORT_META.date],
                ["Duration", DURATION],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <dt className="text-ink/70">{k}</dt>
                  <dd className="font-semibold text-ink tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {/* View toggle: peer comparison unlocks only past PEER_THRESHOLD players */}
          <div
            role="radiogroup"
            aria-label="Report view"
            className="inline-flex self-start lg:self-auto p-1 rounded-xl border border-ink/15"
            style={{ background: "var(--surface)" }}
          >
            {[
              { v: true, l: "Compare with peers" },
              { v: false, l: "Just me" },
            ].map((o) => (
              <button
                key={o.l}
                role="radio"
                aria-checked={compare === o.v}
                disabled={o.v && !peersReady}
                title={o.v && !peersReady ? `Unlocks once more than ${PEER_THRESHOLD} people have played (${PLAYERS_COMPLETED} so far)` : undefined}
                onClick={() => setCompare(o.v)}
                className="px-3.5 py-2 rounded-lg text-xs font-display font-semibold min-h-[36px] transition-colors disabled:cursor-not-allowed disabled:line-through focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                style={
                  compare === o.v
                    ? { background: "rgb(var(--ink))", color: "var(--bg)" }
                    : { color: "rgb(var(--ink) / 0.75)" }
                }
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Report sections"
          className="flex items-center gap-1.5 p-1.5 rounded-2xl mb-5 glass overflow-x-auto"
        >
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className="tool-btn flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs md:text-sm font-display font-semibold min-h-[44px]"
                style={
                  active
                    ? {
                        background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
                        color: "#ffffff",
                        boxShadow: "0 6px 20px rgb(var(--accent-rgb) / 0.35)",
                      }
                    : {
                        background: "transparent",
                        color: "rgb(var(--ink) / 0.62)",
                      }
                }
              >
                <span aria-hidden className="text-sm">
                  {t.icon}
                </span>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ===================== OVERVIEW ===================== */}
        {tab === "overview" && (
          <div
            role="tabpanel"
            id="panel-overview"
            aria-labelledby="tab-overview"
            className="animate-fade-in-up"
          >
            {/* Score card */}
            <div className="grid lg:grid-cols-12 gap-4 mb-4">
              <div className="lg:col-span-8">
                <TenPointScale
                  score={SCORE}
                  raw={RAW_SCORE}
                  description="Your overall effectiveness at protecting value and the relationship while negotiating a contract renewal under price pressure."
                />
              </div>
              <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                {compare ? (
                <div className="rounded-2xl border border-ink/10 p-5" style={{ background: "var(--surface)" }}>
                  <p className="text-ink/70 text-[11px] font-bold tracking-widest uppercase mb-2">Peer Percentile</p>
                  <p className="font-display font-bold text-ink text-4xl tabular-nums">{REPORT_META.percentile}<span className="text-lg text-ink/70">th</span></p>
                  <p className="text-ink/75 text-xs mt-1">Among {PLAYERS_COMPLETED} players in this scenario</p>
                </div>
                ) : (
                <div className="rounded-2xl border border-ink/10 p-5" style={{ background: "var(--surface)" }}>
                  <p className="text-ink/70 text-[11px] font-bold tracking-widest uppercase mb-2">Next Band</p>
                  <p className="font-display font-bold text-ink text-4xl tabular-nums">{Math.max(0, bandFor(SCORE).max + 1 - SCORE)}<span className="text-lg text-ink/70"> pts</span></p>
                  <p className="text-ink/75 text-xs mt-1">To reach {KNOLSKAPE_BANDS[Math.min(4, KNOLSKAPE_BANDS.indexOf(bandFor(SCORE)) + 1)].label}</p>
                </div>
                )}
                <div className="rounded-2xl border border-ink/10 p-5" style={{ background: "var(--surface)" }}>
                  <p className="text-ink/70 text-[11px] font-bold tracking-widest uppercase mb-2">Strongest Skill</p>
                  <p className="font-display font-bold text-ink text-xl leading-tight">{[...SKILLS].sort((a, b) => b.score - a.score)[0].name}</p>
                  <p className="text-ink/75 text-xs mt-1">{[...SKILLS].sort((a, b) => b.score - a.score)[0].score}/10, your clearest advantage in this call</p>
                </div>
              </div>
            </div>

            {/* Rewards earned in this call */}
            <section className="rounded-2xl border p-5 mb-4 relative overflow-hidden" style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.35)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="font-display font-semibold text-ink text-sm">Rewards Earned</h2>
                <p className="text-ink/75 text-xs">XP and badges carry over to your profile and the season leaderboard.</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-3">
                  <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-1">XP Earned</p>
                  <p className="font-display font-bold text-4xl text-ink">
                    +<RollingNumber value={stats.endXp - stats.startXp} />
                  </p>
                  <p className="text-ink/75 text-xs mt-1">Total <RollingNumber value={stats.endXp} className="font-semibold text-ink" /> XP</p>
                </div>
                <div className="lg:col-span-2">
                  <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-1">Best Streak</p>
                  <p className="font-display font-bold text-4xl text-ink flex items-center gap-1.5">
                    <span className="text-brand"><FlameIcon size={26} /></span>{stats.bestStreak}
                  </p>
                  <p className="text-ink/75 text-xs mt-1">Strong replies in a row</p>
                </div>
                {compare && (
                  <div className="lg:col-span-2">
                    <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-1">Leaderboard</p>
                    <p className="font-display font-bold text-4xl text-ink">#{stats.endRank}</p>
                    <p className="text-ink/75 text-xs mt-1">
                      {stats.startRank > stats.endRank ? `Up ${stats.startRank - stats.endRank} from #${stats.startRank}` : `Held at #${stats.startRank}`}
                    </p>
                  </div>
                )}
                <div className={`col-span-2 ${compare ? "lg:col-span-5" : "lg:col-span-7"}`}>
                  <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-2">
                    Badges <span className="text-ink font-display">{stats.badges.length}/{BADGES.length}</span>
                  </p>
                  <ul className="flex flex-wrap gap-3">
                    {BADGES.map((b) => {
                      const got = stats.badges.includes(b.id)
                      return (
                        <li key={b.id} className="flex flex-col items-center w-16 text-center" title={b.desc}>
                          <span className={got ? "shine" : ""} style={{ clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }}>
                            <BadgeMedal mark={b.mark} earned={got} size={42} />
                          </span>
                          <span className={`mt-1 text-[11px] leading-tight ${got ? "text-ink font-semibold" : "text-ink/70"}`}>{b.name}</span>
                          <span className="sr-only">{got ? "Earned" : "Not earned"}: {b.desc}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </section>

            {/* Key metrics */}
            <section className="rounded-2xl border border-ink/10 p-5 mb-4" style={{ background: "var(--surface)" }}>
              <h2 className="font-display font-semibold text-ink text-sm mb-3">Conversation Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {KPIS.map((k) => (
                  <div key={k.label} className="rounded-xl p-3.5 border border-ink/10">
                    <p className="text-ink/75 text-[11px] font-medium mb-1.5">{k.label}</p>
                    <p className="font-display font-bold text-ink text-xl tabular-nums">{k.value}</p>
                    <p className="text-xs mt-1 flex items-center gap-1.5 text-ink/75">
                      <span aria-hidden className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: k.ok ? "#2f7a34" : "#e07b2e" }} />
                      <span className="sr-only">{k.ok ? "On target." : "Below target."}</span>
                      {k.target}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid lg:grid-cols-12 gap-4 mb-4">
            {/* Skill snapshot */}
            <section className="lg:col-span-7 rounded-2xl border border-ink/10 p-5 flex flex-col" style={{ background: "var(--surface)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                <h2 className="font-display font-semibold text-ink text-sm">Skill Snapshot</h2>
                <p className="text-ink/75 text-xs flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><span aria-hidden className="w-3 h-2 rounded-sm bg-ink/60" />Your score</span>
                  {compare && <span className="flex items-center gap-1.5"><span aria-hidden className="w-0.5 h-3 bg-ink" />Peer average</span>}
                </p>
              </div>
              <ul className="space-y-3.5">
                {SKILLS.map((k) => {
                  const b = bandFor(k.score)
                  return (
                    <li key={k.name} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-4">
                      <span className="text-ink text-sm font-medium truncate">
                        {k.name} <span className="text-ink/70 text-xs tabular-nums">({k.weight}%)</span>
                      </span>
                      <div className="relative h-2.5 rounded-full" style={{ background: "rgb(var(--ink) / 0.08)" }}>
                        <div className="h-full rounded-full" style={{ width: `${k.score * 10}%`, background: b.color }} />
                        {compare && <span aria-hidden className="absolute -top-1 -bottom-1 w-0.5 bg-ink" style={{ left: `${k.peer * 10}%` }} />}
                      </div>
                      <span className="text-ink text-sm font-display font-semibold tabular-nums w-24 text-right">
                        {k.score}/10 {compare && <span className="text-ink/70 text-xs font-normal">vs {k.peer.toFixed(1)}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {/* Skill profile: shape of the performance plus the headline spread */}
              <div className="mt-5 pt-5 border-t border-ink/10 flex-1 grid sm:grid-cols-[minmax(0,15rem)_1fr] gap-6 items-center">
                <SkillRadar compare={compare} />
                <dl className="grid grid-cols-2 gap-3">
                  {(() => {
                    const sorted = [...SKILLS].sort((a, b) => b.score - a.score)
                    const top = sorted[0]
                    const low = sorted[sorted.length - 1]
                    const above = SKILLS.filter((k) => k.score > k.peer).length
                    const atOrAbove = SKILLS.filter((k) => k.score >= 7).length
                    const cells = [
                      { k: "Highest", v: `${top.score}/10`, sub: top.name },
                      { k: "Lowest", v: `${low.score}/10`, sub: low.name },
                      { k: "Spread", v: `${top.score - low.score} pts`, sub: top.score - low.score <= 2 ? "Balanced profile" : "Uneven profile" },
                      compare
                        ? { k: "Above Peers", v: `${above} of ${SKILLS.length}`, sub: "Skills beating the cohort average" }
                        : { k: "Proficient+", v: `${atOrAbove} of ${SKILLS.length}`, sub: "Skills scoring 7 or higher" },
                    ]
                    return cells.map((c) => (
                      <div key={c.k} className="rounded-xl p-3 border border-ink/10" style={{ background: "var(--surface-2)" }}>
                        <dt className="text-ink/75 text-[11px] font-bold tracking-widest uppercase">{c.k}</dt>
                        <dd className="font-display font-bold text-ink text-xl tabular-nums mt-1">{c.v}</dd>
                        <dd className="text-ink/75 text-xs leading-snug truncate" title={c.sub}>{c.sub}</dd>
                      </div>
                    ))
                  })()}
                </dl>
              </div>
            </section>

            {/* Strengths / Development */}
            <div className="lg:col-span-5 grid md:grid-cols-2 lg:grid-cols-1 gap-4">
              {[
                { title: "Key Strengths", items: STRENGTHS, color: "#2f7a34" },
                { title: "Development Priorities", items: DEVELOPMENT, color: "#b5472f" },
              ].map((col) => (
                <section key={col.title} className="rounded-2xl border border-ink/10 p-5" style={{ background: "var(--surface)", borderTop: `3px solid ${col.color}` }}>
                  <h2 className="font-display font-semibold text-ink text-sm mb-4">{col.title}</h2>
                  <ol className="space-y-3">
                    {col.items.map((it, i) => (
                      <li key={it.title} className="flex gap-3">
                        <span className="font-display text-xs font-bold text-ink/70 tabular-nums mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        <div className="flex-1">
                          <p className="text-ink text-sm font-semibold flex items-baseline justify-between gap-3">
                            {it.title}
                            <span className="text-ink/70 text-xs font-normal tabular-nums">at {it.time}</span>
                          </p>
                          <p className="text-ink/80 text-sm leading-relaxed mt-0.5">{it.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>

            </div>

            {/* Summary + Recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-ok" aria-hidden>
                    ↗
                  </span>
                  <h2 className="font-display font-semibold text-ink text-sm">
                    Overall Feedback
                  </h2>
                </div>
                <div
                  className="rounded-xl p-4 text-ink/85 text-sm leading-relaxed flex-1 space-y-4"
                  style={{
                    background: "rgb(var(--ink) / 0.03)",
                    border: "1px solid rgb(var(--ink) / 0.06)",
                  }}
                >
                  <p>
                    You stayed professional under pressure and built a respectful rapport with Margaret, which kept the conversation constructive even after she raised the competitor quote. Your points were well structured and your communication was clear, so the negotiation never stalled.
                  </p>
                  <p>
                    The key opportunity is to move beyond <strong>defending your price to uncovering what is really driving the client</strong>. At times, you accepted Margaret's first position and responded to it directly without exploring her priorities, constraints, decision criteria, or what her CFO actually needs. This made parts of the conversation feel more like a price debate than a negotiation and limited the value you could trade.
                  </p>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-brand" aria-hidden>
                    ✦
                  </span>
                  <h2 className="font-display font-semibold text-ink text-sm">
                    Actionable Recommendations
                  </h2>
                </div>
                <div
                  className="rounded-xl p-4 text-ink/85 text-sm leading-relaxed flex-1"
                  style={{
                    background: "rgb(var(--ink) / 0.03)",
                    border: "1px solid rgb(var(--ink) / 0.06)",
                  }}
                >
                  <ul className="space-y-3 mb-4">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                      <span><strong>Probe beyond the first position:</strong> Follow up with questions such as <em>"What does that quote include?"</em>, <em>"What matters most to your CFO?"</em>, <em>"What would make staying easy to justify?"</em> and <em>"What happens if nothing changes?"</em></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                      <span><strong>Follow the evidence, not just your pitch:</strong> Let the client's response shape your next move rather than jumping to your prepared value points.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                      <span><strong>Trade, never give:</strong> Link any movement on price to something in return, such as term length, volume, or scope.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                      <span><strong>Use an evidence check:</strong> Before making a concession, ask yourself: <em>"Do I understand what the client really needs well enough to offer this?"</em> If not, probe further.</span>
                    </li>
                  </ul>
                  <p>
                    Your next development step is to strengthen <strong>active listening and evidence-based probing</strong>, so that every question brings you closer to what the client truly values and every concession earns something back.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== DETAILED ANALYSIS ===================== */}
        {tab === "skills" && (
          <div
            role="tabpanel"
            id="panel-skills"
            aria-labelledby="tab-skills"
            className="animate-fade-in-up"
          >
            <p className="text-ink/80 text-sm mb-5 leading-relaxed">
              Six skills, each scored on the Knolskape ten-point scale from behaviours observed in the call. Weights show each skill's contribution to your overall score. Select a skill to see sub-skill scores, evidence, and next steps.
            </p>
            <div className="space-y-3">
              {SKILLS.map((s, i) => {
                const c = scoreColor(s.score)
                const open = expanded === i
                const delta = s.score - s.peer
                return (
                  <div key={s.name} className="glass rounded-2xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink/[0.02] min-h-[44px]"
                      onClick={() => setExpanded(open ? null : i)}
                      aria-expanded={open}
                    >
                      <span className="font-display text-xs font-bold text-ink/70 tabular-nums w-6 flex-none">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-ink text-sm">
                          {s.name}
                          <span className="text-ink/70 text-xs font-normal ml-2">Weight {s.weight}%</span>
                        </p>
                        <p className="text-ink/75 text-xs mt-0.5 leading-relaxed line-clamp-1">{s.desc}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {compare && <span className="hidden md:block text-right">
                          <span className="block text-ink/70 text-[11px]">vs peers</span>
                          <span className="block text-ink text-xs font-semibold tabular-nums">
                            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                          </span>
                        </span>}
                        <SkillScore score={s.score} />
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s ease", color: "rgb(var(--ink) / 0.7)" }} aria-hidden>
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </button>

                    {open && (
                      <div className="px-5 pb-5 border-t border-ink/10 pt-4 space-y-4 animate-fade-in-up">
                        <div className="grid xl:grid-cols-2 gap-4">
                        <div className="space-y-4">
                        {/* Sub-skills */}
                        <div>
                          <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-3">Sub-skill Scores</p>
                          <div className="divide-y divide-ink/10 rounded-xl border border-ink/10">
                            {s.subskills.map((sub) => {
                              const sc = scoreColor(sub.score)
                              return (
                                <div key={sub.name} className="grid md:grid-cols-[12rem_1fr_3rem] gap-x-4 gap-y-1.5 items-center px-4 py-3">
                                  <span className="text-ink text-sm font-medium">{sub.name}</span>
                                  <div className="flex flex-col gap-1.5">
                                    <div className="h-1.5 rounded-full" style={{ background: "rgb(var(--ink) / 0.08)" }}>
                                      <div className="h-full rounded-full" style={{ width: `${sub.score * 10}%`, background: sc }} />
                                    </div>
                                    <span className="text-ink/75 text-xs leading-relaxed">{sub.note}</span>
                                  </div>
                                  <span className="text-ink text-sm font-semibold font-display tabular-nums md:text-right">{sub.score}/10</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        </div>
                        <div className="space-y-4">
                        {/* Behaviours */}
                        <div className="grid md:grid-cols-2 gap-3">
                          {[
                            { t: "Behaviours Observed", list: s.observed, mark: "+", col: "#2f7a34" },
                            { t: "Behaviours Missing", list: s.missed, mark: "–", col: "#b5472f" },
                          ].map((g) => (
                            <div key={g.t} className="rounded-xl p-4 border border-ink/10">
                              <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-2.5">{g.t}</p>
                              <ul className="space-y-2">
                                {g.list.map((x) => (
                                  <li key={x} className="flex gap-2.5 text-ink/85 text-sm leading-relaxed">
                                    <span aria-hidden className="font-bold flex-none w-3" style={{ color: g.col }}>{g.mark}</span>
                                    {x}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>

                        {/* Evidence */}
                        <div>
                          <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-2.5">Evidence from the Call</p>
                          <div className="space-y-2.5">
                            {s.evidence.map((e) => (
                              <figure key={e.time} className="rounded-xl p-4 border border-ink/10" style={{ borderLeft: `3px solid ${e.kind === "strength" ? "#2f7a34" : "#b5472f"}` }}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-ink/75 text-xs font-semibold tabular-nums">{e.time}</span>
                                  <span className="text-xs font-semibold text-ink">{e.kind === "strength" ? "Strength" : "Missed opportunity"}</span>
                                </div>
                                <blockquote className="text-ink text-sm italic leading-relaxed">"{e.quote}"</blockquote>
                                <figcaption className="text-ink/80 text-sm mt-1.5 leading-relaxed">{e.note}</figcaption>
                              </figure>
                            ))}
                          </div>
                        </div>

                        </div>
                        </div>
                        {/* Analysis */}
                        <div className="grid md:grid-cols-3 gap-3">
                          {[
                            { t: "Analysis", v: s.feedback },
                            { t: "Recommendation", v: s.recommendation },
                            { t: "Practice Drill", v: s.drill },
                          ].map((b) => (
                            <div key={b.t} className="rounded-xl p-4" style={{ background: "rgb(var(--ink) / 0.04)", border: "1px solid rgb(var(--ink) / 0.08)" }}>
                              <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-2">{b.t}</p>
                              <p className="text-ink/85 text-sm leading-relaxed">{b.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===================== COMMUNICATION ANALYSIS ===================== */}
        {tab === "comm" && (
          <div
            role="tabpanel"
            id="panel-comm"
            aria-labelledby="tab-comm"
            className="animate-fade-in-up grid lg:grid-cols-12 gap-4 items-start"
          >
            {/* CEFR overall */}
            <div className="glass rounded-2xl p-6 lg:col-span-7">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-brand" aria-hidden>
                  ◈
                </span>
                <h2 className="font-display font-semibold text-ink text-sm">
                  Language Proficiency · CEFR
                </h2>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div
                  className="flex flex-col items-center justify-center rounded-2xl px-8 py-5 flex-shrink-0"
                  style={{
                    background: `${cefrColor(CEFR.overall)}18`,
                    border: `1px solid ${cefrColor(CEFR.overall)}40`,
                  }}
                >
                  <span
                    className="font-display font-bold text-4xl"
                    style={{ color: cefrColor(CEFR.overall) }}
                  >
                    {CEFR.overall}
                  </span>
                  <span className="text-ink/70 text-xs font-medium mt-1">
                    {CEFR.band}
                  </span>
                </div>
                <p className="text-ink/70 text-sm leading-relaxed flex-1">
                  {CEFR.summary}
                </p>
              </div>

              {/* CEFR ladder */}
              <div
                className="mt-6"
                role="img"
                aria-label={`CEFR level achieved: ${CEFR.overall} (${CEFR.band})`}
              >
                <div className="flex gap-1.5">
                  {CEFR_LADDER.map((lvl) => {
                    const reached =
                      CEFR_LADDER.indexOf(lvl) <=
                      CEFR_LADDER.indexOf(CEFR.overall)
                    const isCurrent = lvl === CEFR.overall
                    return (
                      <div
                        key={lvl}
                        className="flex-1 flex flex-col items-center gap-1.5"
                      >
                        <div
                          className="w-full h-2 rounded-full"
                          style={{
                            background: reached
                              ? cefrColor(lvl)
                              : "rgb(var(--ink) / 0.08)",
                          }}
                        />
                        <span
                          className="text-[11px] font-display"
                          style={{
                            color: isCurrent
                              ? "rgb(var(--ink))"
                              : "rgb(var(--ink) / 0.55)",
                            fontWeight: isCurrent ? 700 : 500,
                          }}
                        >
                          {lvl}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* CEFR dimensions */}
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                {CEFR.dimensions.map((d) => (
                  <div
                    key={d.name}
                    className="rounded-xl p-3.5"
                    style={{
                      background: "rgb(var(--ink) / 0.03)",
                      border: "1px solid rgb(var(--ink) / 0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-ink/75 text-xs font-semibold font-display">
                        {d.name}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold font-display"
                        style={{
                          background: cefrColor(d.level),
                          color: readableOn(cefrColor(d.level)),
                        }}
                      >
                        {d.level}
                      </span>
                    </div>
                    <p className="text-ink/70 text-[11px] leading-relaxed">
                      {d.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
            {/* Sentiment + Clarity */}
            <div className="grid md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Sentiment */}
              <div className="glass rounded-2xl p-5">
                <h2 className="font-display font-semibold text-ink text-sm mb-4">
                  Sentiment
                </h2>
                <div
                  className="h-3 rounded-full overflow-hidden flex mb-4"
                  role="img"
                  aria-label={SENTIMENT.map((s) => `${s.label} ${s.pct}%`).join(
                    ", ",
                  )}
                >
                  {SENTIMENT.map((s) => (
                    <div
                      key={s.label}
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  {SENTIMENT.map((s) => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2 text-ink/70">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: s.color }}
                          aria-hidden
                        />
                        {s.label}
                      </span>
                      <span className="font-display font-semibold text-ink tabular-nums">
                        {s.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clarity */}
              <div className="glass rounded-2xl p-5 flex flex-col">
                <h2 className="font-display font-semibold text-ink text-sm mb-4">
                  Clarity
                </h2>
                <div className="flex items-center gap-4 mb-3">
                  <ScoreRing
                    score={Math.round(CLARITY.score)}
                    max={10}
                    size={72}
                    level="Clarity"
                  />
                  <div>
                    <p className="font-display font-bold text-ink text-2xl">
                      {CLARITY.score.toFixed(1)}
                      <span className="text-ink/70 text-base">/10</span>
                    </p>
                    <p className="text-ink/70 text-xs">Message clarity index</p>
                  </div>
                </div>
                <p className="text-ink/70 text-xs leading-relaxed">
                  {CLARITY.note}
                </p>
              </div>
            </div>

            {/* Tone */}
            <div className="glass rounded-2xl p-5">
              <h2 className="font-display font-semibold text-ink text-sm mb-4">
                Tone
              </h2>
              <div className="space-y-3">
                {TONE.map((t) => (
                  <div key={t.label} className="flex items-center gap-3">
                    <span className="text-ink/70 text-xs font-medium w-28 flex-shrink-0">
                      {t.label}
                    </span>
                    <div
                      className="flex-1 h-2 rounded-full"
                      style={{ background: "rgb(var(--ink) / 0.07)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${t.pct}%`,
                          background: "linear-gradient(90deg,var(--accent),var(--accent-2))",
                        }}
                      />
                    </div>
                    <span className="text-ink text-xs font-semibold font-display tabular-nums w-9 text-right">
                      {t.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* ===================== TRANSCRIPT ===================== */}
        {tab === "transcript" && (
          <div
            role="tabpanel"
            id="panel-transcript"
            aria-labelledby="tab-transcript"
            className="animate-fade-in-up grid lg:grid-cols-12 gap-4 items-start"
          >
            <aside className="lg:col-span-4 lg:order-2 lg:sticky lg:top-4 glass rounded-2xl p-5">
              <h2 className="font-display font-semibold text-ink text-sm mb-3">Key Moments</h2>
              <ol className="space-y-2.5">
                {reportLines.filter((l) => l.tag).map((l) => (
                  <li key={l.time} className="flex gap-3 text-sm">
                    <span className="text-ink/75 text-xs tabular-nums w-10 flex-none pt-0.5">{l.time}</span>
                    <span className="flex-1">
                      <span className="block text-xs font-semibold" style={{ color: l.tag === "strength" ? "var(--ok)" : "var(--danger)" }}>
                        {l.tag === "strength" ? "Strength" : "Missed opportunity"}
                      </span>
                      <span className="text-ink/85 leading-snug line-clamp-2">{l.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
            <div className="glass rounded-2xl p-6 lg:col-span-8 lg:order-1">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-ink text-xl">
                  Conversation Transcript
                </h2>
                <span
                  className="px-3 py-1 rounded-full text-ink/70 text-xs font-medium"
                  style={{ background: "rgb(var(--ink) / 0.05)" }}
                >
                  {(transcript.length > TRANSCRIPT.length ? transcript : FULL_TRANSCRIPT).length} turns · {DURATION}
                </span>
              </div>
              <div className="space-y-6">
                {(transcript.length > TRANSCRIPT.length ? transcript : FULL_TRANSCRIPT).map((t, i) => {
                  const you = t.speaker === "You"
                  return (
                    <div
                      key={i}
                      className={`flex flex-col gap-1.5 ${
                        you ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-ink/80 text-xs font-bold font-display">
                          {t.speaker}
                        </span>
                        <span className="text-ink/70 text-[11px] tabular-nums">
                          {t.time}
                        </span>
                        {t.tag && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{
                              background: t.tag === "strength" ? "#2f7a34" : "#b5472f",
                              color: "#ffffff",
                            }}
                          >
                            {t.tag === "strength" ? "Strength" : "Missed opportunity"}
                          </span>
                        )}
                      </div>
                      <div
                        className="max-w-[85%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed"
                        style={
                          you
                            ? {
                                background: "rgb(var(--accent-rgb) / 0.12)",
                                color: "rgb(var(--ink) / 0.9)",
                                border: "1px solid rgb(var(--accent-rgb) / 0.25)",
                              }
                            : {
                                background: "rgb(var(--ink) / 0.04)",
                                color: "rgb(var(--ink) / 0.75)",
                                border: "1px solid rgb(var(--ink) / 0.08)",
                              }
                        }
                      >
                        {t.text}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            onClick={download}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold text-sm text-white min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)]"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", boxShadow: "0 8px 30px rgb(var(--accent-rgb) / 0.3)" }}
          >
            Download Report
          </button>
          <button
            onClick={() => setEmailOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold text-sm text-ink border border-ink/20 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            Email Report
          </button>
        </div>
      </div>
      {party && <ConfettiBurst pieces={120} />}
      {emailOpen && <EmailDialog onClose={() => setEmailOpen(false)} onDownload={download} />}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>("landing")
  const [dark, setDark] = useState(true)
  const [transcript, setTranscript] = useState(TRANSCRIPT)
  const [stats, setStats] = useState<SessionStats>({ startXp: 560, endXp: 745, badges: ["icebreaker", "detective", "hot-streak"], bestStreak: 4, objectives: 2, startRank: 4, endRank: 3 })

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark)
  }, [dark])

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <div className="h-full" style={{ background: "transparent" }}>
        {page === "landing" && (
          <LandingPage onStart={() => setPage("session")} />
        )}
        {page === "session" && (
          <SessionPage
            onEnd={(msgs, st) => {
              setTranscript(msgs)
              // A call ended without new turns falls back to the sample session stats.
              if (st.endXp > st.startXp) setStats(st)
              setPage("summary")
            }}
          />
        )}
        {page === "summary" && (
          <SummaryPage
            transcript={transcript}
            stats={stats}
          />
        )}
      </div>
    </ThemeContext.Provider>
  )
}
