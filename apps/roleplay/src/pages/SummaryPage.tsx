import { useEffect, useState } from "react";
import type { ReportTab, SessionStats } from "../types";
import ThemeToggle from "../components/ThemeToggle";
import TenPointScale from "../components/TenPointScale";
import ScoreRing from "../components/ScoreRing";
import RollingNumber from "../components/RollingNumber";
import ConfettiBurst from "../components/ConfettiBurst";
import FlameIcon from "../components/FlameIcon";
import BadgeMedal from "../components/BadgeMedal";
import EmailDialog from "../components/EmailDialog";
import SkillScore from "../components/SkillScore";
import SkillRadar from "../components/SkillRadar";
import { bandFor, scoreColor, cefrColor } from "../lib/score";
import { readableOn } from "../lib/color";
import buildReportPdf from "../lib/buildReportPdf";
import { KNOLSKAPE_BANDS } from "../data/bands";
import { SCORE, DURATION, SCENARIO_TITLE, PEER_THRESHOLD, PLAYERS_COMPLETED } from "../data/scenario";
import { SKILLS, RAW_SCORE } from "../data/skills";
import { REPORT_META, KPIS, STRENGTHS, DEVELOPMENT, PDF_NAME } from "../data/report";
import { CEFR, SENTIMENT, TONE, CLARITY } from "../data/communication";
import { TRANSCRIPT, FULL_TRANSCRIPT } from "../data/transcript";
import { BADGES } from "../data/badges";

export default function SummaryPage({
  transcript,
  stats,
}: {
  transcript: typeof TRANSCRIPT;
  stats: SessionStats;
}) {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [expanded, setExpanded] = useState<number | null>(0);
  const peersReady = PLAYERS_COMPLETED > PEER_THRESHOLD;
  const [compare, setCompare] = useState(peersReady);
  const [emailOpen, setEmailOpen] = useState(false);
  const [party, setParty] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setParty(false), 3000);
    return () => window.clearTimeout(t);
  }, []);
  const reportLines = transcript.length > TRANSCRIPT.length ? transcript : FULL_TRANSCRIPT;
  const download = () => void buildReportPdf(reportLines).then((d) => d.save(PDF_NAME));
  const TABS: { id: ReportTab; label: string; icon: string }[] = [
    { id: "overview", label: "Performance Overview", icon: "◎" },
    { id: "skills", label: "Detailed Analysis", icon: "▤" },
    { id: "comm", label: "Communication", icon: "◈" },
    { id: "transcript", label: "Transcript", icon: "≡" },
  ];

  const CEFR_LADDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

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
            <span className="text-white text-xs font-bold font-display">AI</span>
          </div>
          <span className="text-ink/70 font-display font-medium text-sm">AI RolePlay</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={download}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ink/85 text-xs font-semibold hover:text-ink border border-ink/15 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M7 2v7M4 6.5 7 9.5l3-3M2.5 12h9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </button>
          <button
            onClick={() => setEmailOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ink/85 text-xs font-semibold hover:text-ink border border-ink/15 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="1.5" y="3" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="m2 3.8 5 3.7 5-3.7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
            <p className="text-ink/70 text-xs uppercase tracking-widest font-medium mb-1">Roleplay Report</p>
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
                title={
                  o.v && !peersReady
                    ? `Unlocks once more than ${PEER_THRESHOLD} people have played (${PLAYERS_COMPLETED} so far)`
                    : undefined
                }
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
            const active = tab === t.id;
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
            );
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
                  <div
                    className="rounded-2xl border border-ink/10 p-5"
                    style={{ background: "var(--surface)" }}
                  >
                    <p className="text-ink/70 text-[11px] font-bold tracking-widest uppercase mb-2">
                      Peer Percentile
                    </p>
                    <p className="font-display font-bold text-ink text-4xl tabular-nums">
                      {REPORT_META.percentile}
                      <span className="text-lg text-ink/70">th</span>
                    </p>
                    <p className="text-ink/75 text-xs mt-1">
                      Among {PLAYERS_COMPLETED} players in this scenario
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border border-ink/10 p-5"
                    style={{ background: "var(--surface)" }}
                  >
                    <p className="text-ink/70 text-[11px] font-bold tracking-widest uppercase mb-2">
                      Next Band
                    </p>
                    <p className="font-display font-bold text-ink text-4xl tabular-nums">
                      {Math.max(0, bandFor(SCORE).max + 1 - SCORE)}
                      <span className="text-lg text-ink/70"> pts</span>
                    </p>
                    <p className="text-ink/75 text-xs mt-1">
                      To reach{" "}
                      {KNOLSKAPE_BANDS[Math.min(4, KNOLSKAPE_BANDS.indexOf(bandFor(SCORE)) + 1)].label}
                    </p>
                  </div>
                )}
                <div
                  className="rounded-2xl border border-ink/10 p-5"
                  style={{ background: "var(--surface)" }}
                >
                  <p className="text-ink/70 text-[11px] font-bold tracking-widest uppercase mb-2">
                    Strongest Skill
                  </p>
                  <p className="font-display font-bold text-ink text-xl leading-tight">
                    {[...SKILLS].sort((a, b) => b.score - a.score)[0].name}
                  </p>
                  <p className="text-ink/75 text-xs mt-1">
                    {[...SKILLS].sort((a, b) => b.score - a.score)[0].score}/10, your clearest advantage in
                    this call
                  </p>
                </div>
              </div>
            </div>

            {/* Rewards earned in this call */}
            <section
              className="rounded-2xl border p-5 mb-4 relative overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.35)" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="font-display font-semibold text-ink text-sm">Rewards Earned</h2>
                <p className="text-ink/75 text-xs">
                  XP and badges carry over to your profile and the season leaderboard.
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-3">
                  <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-1">
                    XP Earned
                  </p>
                  <p className="font-display font-bold text-4xl text-ink">
                    +<RollingNumber value={stats.endXp - stats.startXp} />
                  </p>
                  <p className="text-ink/75 text-xs mt-1">
                    Total <RollingNumber value={stats.endXp} className="font-semibold text-ink" /> XP
                  </p>
                </div>
                <div className="lg:col-span-2">
                  <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-1">
                    Best Streak
                  </p>
                  <p className="font-display font-bold text-4xl text-ink flex items-center gap-1.5">
                    <span className="text-brand">
                      <FlameIcon size={26} />
                    </span>
                    {stats.bestStreak}
                  </p>
                  <p className="text-ink/75 text-xs mt-1">Strong replies in a row</p>
                </div>
                {compare && (
                  <div className="lg:col-span-2">
                    <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-1">
                      Leaderboard
                    </p>
                    <p className="font-display font-bold text-4xl text-ink">#{stats.endRank}</p>
                    <p className="text-ink/75 text-xs mt-1">
                      {stats.startRank > stats.endRank
                        ? `Up ${stats.startRank - stats.endRank} from #${stats.startRank}`
                        : `Held at #${stats.startRank}`}
                    </p>
                  </div>
                )}
                <div className={`col-span-2 ${compare ? "lg:col-span-5" : "lg:col-span-7"}`}>
                  <p className="text-ink/75 text-[11px] font-bold tracking-widest uppercase mb-2">
                    Badges{" "}
                    <span className="text-ink font-display">
                      {stats.badges.length}/{BADGES.length}
                    </span>
                  </p>
                  <ul className="flex flex-wrap gap-3">
                    {BADGES.map((b) => {
                      const got = stats.badges.includes(b.id);
                      return (
                        <li key={b.id} className="flex flex-col items-center w-16 text-center" title={b.desc}>
                          <span
                            className={got ? "shine" : ""}
                            style={{ clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }}
                          >
                            <BadgeMedal mark={b.mark} earned={got} size={42} />
                          </span>
                          <span
                            className={`mt-1 text-[11px] leading-tight ${got ? "text-ink font-semibold" : "text-ink/70"}`}
                          >
                            {b.name}
                          </span>
                          <span className="sr-only">
                            {got ? "Earned" : "Not earned"}: {b.desc}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </section>

            {/* Key metrics */}
            <section
              className="rounded-2xl border border-ink/10 p-5 mb-4"
              style={{ background: "var(--surface)" }}
            >
              <h2 className="font-display font-semibold text-ink text-sm mb-3">Conversation Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {KPIS.map((k) => (
                  <div key={k.label} className="rounded-xl p-3.5 border border-ink/10">
                    <p className="text-ink/75 text-[11px] font-medium mb-1.5">{k.label}</p>
                    <p className="font-display font-bold text-ink text-xl tabular-nums">{k.value}</p>
                    <p className="text-xs mt-1 flex items-center gap-1.5 text-ink/75">
                      <span
                        aria-hidden
                        className="w-1.5 h-1.5 rounded-full flex-none"
                        style={{ background: k.ok ? "#2f7a34" : "#e07b2e" }}
                      />
                      <span className="sr-only">{k.ok ? "On target." : "Below target."}</span>
                      {k.target}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid lg:grid-cols-12 gap-4 mb-4">
              {/* Skill snapshot */}
              <section
                className="lg:col-span-7 rounded-2xl border border-ink/10 p-5 flex flex-col"
                style={{ background: "var(--surface)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                  <h2 className="font-display font-semibold text-ink text-sm">Skill Snapshot</h2>
                  <p className="text-ink/75 text-xs flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="w-3 h-2 rounded-sm bg-ink/60" />
                      Your score
                    </span>
                    {compare && (
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="w-0.5 h-3 bg-ink" />
                        Peer average
                      </span>
                    )}
                  </p>
                </div>
                <ul className="space-y-3.5">
                  {SKILLS.map((k) => {
                    const b = bandFor(k.score);
                    return (
                      <li
                        key={k.name}
                        className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-4"
                      >
                        <span className="text-ink text-sm font-medium truncate">
                          {k.name} <span className="text-ink/70 text-xs tabular-nums">({k.weight}%)</span>
                        </span>
                        <div
                          className="relative h-2.5 rounded-full"
                          style={{ background: "rgb(var(--ink) / 0.08)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${k.score * 10}%`, background: b.color }}
                          />
                          {compare && (
                            <span
                              aria-hidden
                              className="absolute -top-1 -bottom-1 w-0.5 bg-ink"
                              style={{ left: `${k.peer * 10}%` }}
                            />
                          )}
                        </div>
                        <span className="text-ink text-sm font-display font-semibold tabular-nums w-24 text-right">
                          {k.score}/10{" "}
                          {compare && (
                            <span className="text-ink/70 text-xs font-normal">vs {k.peer.toFixed(1)}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* Skill profile: shape of the performance plus the headline spread */}
                <div className="mt-5 pt-5 border-t border-ink/10 flex-1 grid sm:grid-cols-[minmax(0,15rem)_1fr] gap-6 items-center">
                  <SkillRadar compare={compare} />
                  <dl className="grid grid-cols-2 gap-3">
                    {(() => {
                      const sorted = [...SKILLS].sort((a, b) => b.score - a.score);
                      const top = sorted[0];
                      const low = sorted[sorted.length - 1];
                      const above = SKILLS.filter((k) => k.score > k.peer).length;
                      const atOrAbove = SKILLS.filter((k) => k.score >= 7).length;
                      const cells = [
                        { k: "Highest", v: `${top.score}/10`, sub: top.name },
                        { k: "Lowest", v: `${low.score}/10`, sub: low.name },
                        {
                          k: "Spread",
                          v: `${top.score - low.score} pts`,
                          sub: top.score - low.score <= 2 ? "Balanced profile" : "Uneven profile",
                        },
                        compare
                          ? {
                              k: "Above Peers",
                              v: `${above} of ${SKILLS.length}`,
                              sub: "Skills beating the cohort average",
                            }
                          : {
                              k: "Proficient+",
                              v: `${atOrAbove} of ${SKILLS.length}`,
                              sub: "Skills scoring 7 or higher",
                            },
                      ];
                      return cells.map((c) => (
                        <div
                          key={c.k}
                          className="rounded-xl p-3 border border-ink/10"
                          style={{ background: "var(--surface-2)" }}
                        >
                          <dt className="text-ink/75 text-[11px] font-bold tracking-widest uppercase">
                            {c.k}
                          </dt>
                          <dd className="font-display font-bold text-ink text-xl tabular-nums mt-1">{c.v}</dd>
                          <dd className="text-ink/75 text-xs leading-snug truncate" title={c.sub}>
                            {c.sub}
                          </dd>
                        </div>
                      ));
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
                  <section
                    key={col.title}
                    className="rounded-2xl border border-ink/10 p-5"
                    style={{ background: "var(--surface)", borderTop: `3px solid ${col.color}` }}
                  >
                    <h2 className="font-display font-semibold text-ink text-sm mb-4">{col.title}</h2>
                    <ol className="space-y-3">
                      {col.items.map((it, i) => (
                        <li key={it.title} className="flex gap-3">
                          <span className="font-display text-xs font-bold text-ink/70 tabular-nums mt-0.5">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="flex-1">
                            <p className="text-ink text-sm font-semibold flex items-baseline justify-between gap-3">
                              {it.title}
                              <span className="text-ink/70 text-xs font-normal tabular-nums">
                                at {it.time}
                              </span>
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
                  <h2 className="font-display font-semibold text-ink text-sm">Overall Feedback</h2>
                </div>
                <div
                  className="rounded-xl p-4 text-ink/85 text-sm leading-relaxed flex-1 space-y-4"
                  style={{
                    background: "rgb(var(--ink) / 0.03)",
                    border: "1px solid rgb(var(--ink) / 0.06)",
                  }}
                >
                  <p>
                    You stayed professional under pressure and built a respectful rapport with Margaret, which
                    kept the conversation constructive even after she raised the competitor quote. Your points
                    were well structured and your communication was clear, so the negotiation never stalled.
                  </p>
                  <p>
                    The key opportunity is to move beyond{" "}
                    <strong>defending your price to uncovering what is really driving the client</strong>. At
                    times, you accepted Margaret's first position and responded to it directly without
                    exploring her priorities, constraints, decision criteria, or what her CFO actually needs.
                    This made parts of the conversation feel more like a price debate than a negotiation and
                    limited the value you could trade.
                  </p>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-brand" aria-hidden>
                    ✦
                  </span>
                  <h2 className="font-display font-semibold text-ink text-sm">Actionable Recommendations</h2>
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
                      <span>
                        <strong>Probe beyond the first position:</strong> Follow up with questions such as{" "}
                        <em>"What does that quote include?"</em>, <em>"What matters most to your CFO?"</em>,{" "}
                        <em>"What would make staying easy to justify?"</em> and{" "}
                        <em>"What happens if nothing changes?"</em>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                      <span>
                        <strong>Follow the evidence, not just your pitch:</strong> Let the client's response
                        shape your next move rather than jumping to your prepared value points.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                      <span>
                        <strong>Trade, never give:</strong> Link any movement on price to something in return,
                        such as term length, volume, or scope.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                      <span>
                        <strong>Use an evidence check:</strong> Before making a concession, ask yourself:{" "}
                        <em>"Do I understand what the client really needs well enough to offer this?"</em> If
                        not, probe further.
                      </span>
                    </li>
                  </ul>
                  <p>
                    Your next development step is to strengthen{" "}
                    <strong>active listening and evidence-based probing</strong>, so that every question
                    brings you closer to what the client truly values and every concession earns something
                    back.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== DETAILED ANALYSIS ===================== */}
        {tab === "skills" && (
          <div role="tabpanel" id="panel-skills" aria-labelledby="tab-skills" className="animate-fade-in-up">
            <p className="text-ink/80 text-sm mb-5 leading-relaxed">
              Six skills, each scored on the Knolskape ten-point scale from behaviours observed in the call.
              Weights show each skill's contribution to your overall score. Select a skill to see sub-skill
              scores, evidence, and next steps.
            </p>
            <div className="space-y-3">
              {SKILLS.map((s, i) => {
                const open = expanded === i;
                const delta = s.score - s.peer;
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
                        {compare && (
                          <span className="hidden md:block text-right">
                            <span className="block text-ink/70 text-[11px]">vs peers</span>
                            <span className="block text-ink text-xs font-semibold tabular-nums">
                              {delta >= 0 ? "+" : ""}
                              {delta.toFixed(1)}
                            </span>
                          </span>
                        )}
                        <SkillScore score={s.score} />
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{
                            transform: open ? "rotate(180deg)" : "rotate(0)",
                            transition: "transform 0.25s ease",
                            color: "rgb(var(--ink) / 0.7)",
                          }}
                          aria-hidden
                        >
                          <path
                            d="M4 6l4 4 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </button>

                    {open && (
                      <div className="px-5 pb-5 border-t border-ink/10 pt-4 space-y-4 animate-fade-in-up">
                        <div className="grid xl:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            {/* Sub-skills */}
                            <div>
                              <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-3">
                                Sub-skill Scores
                              </p>
                              <div className="divide-y divide-ink/10 rounded-xl border border-ink/10">
                                {s.subskills.map((sub) => {
                                  const sc = scoreColor(sub.score);
                                  return (
                                    <div
                                      key={sub.name}
                                      className="grid md:grid-cols-[12rem_1fr_3rem] gap-x-4 gap-y-1.5 items-center px-4 py-3"
                                    >
                                      <span className="text-ink text-sm font-medium">{sub.name}</span>
                                      <div className="flex flex-col gap-1.5">
                                        <div
                                          className="h-1.5 rounded-full"
                                          style={{ background: "rgb(var(--ink) / 0.08)" }}
                                        >
                                          <div
                                            className="h-full rounded-full"
                                            style={{ width: `${sub.score * 10}%`, background: sc }}
                                          />
                                        </div>
                                        <span className="text-ink/75 text-xs leading-relaxed">
                                          {sub.note}
                                        </span>
                                      </div>
                                      <span className="text-ink text-sm font-semibold font-display tabular-nums md:text-right">
                                        {sub.score}/10
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            {/* Behaviours */}
                            <div className="grid md:grid-cols-2 gap-3">
                              {[
                                { t: "Behaviours Observed", list: s.observed, mark: "+", col: "#2f7a34" },
                                { t: "Behaviours Missing", list: s.missed, mark: "−", col: "#b5472f" },
                              ].map((g) => (
                                <div key={g.t} className="rounded-xl p-4 border border-ink/10">
                                  <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-2.5">
                                    {g.t}
                                  </p>
                                  <ul className="space-y-2">
                                    {g.list.map((x) => (
                                      <li
                                        key={x}
                                        className="flex gap-2.5 text-ink/85 text-sm leading-relaxed"
                                      >
                                        <span
                                          aria-hidden
                                          className="font-bold flex-none w-3"
                                          style={{ color: g.col }}
                                        >
                                          {g.mark}
                                        </span>
                                        {x}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>

                            {/* Evidence */}
                            <div>
                              <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-2.5">
                                Evidence from the Call
                              </p>
                              <div className="space-y-2.5">
                                {s.evidence.map((e) => (
                                  <figure
                                    key={e.time}
                                    className="rounded-xl p-4 border border-ink/10"
                                    style={{
                                      borderLeft: `3px solid ${e.kind === "strength" ? "#2f7a34" : "#b5472f"}`,
                                    }}
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-ink/75 text-xs font-semibold tabular-nums">
                                        {e.time}
                                      </span>
                                      <span className="text-xs font-semibold text-ink">
                                        {e.kind === "strength" ? "Strength" : "Missed opportunity"}
                                      </span>
                                    </div>
                                    <blockquote className="text-ink text-sm italic leading-relaxed">
                                      "{e.quote}"
                                    </blockquote>
                                    <figcaption className="text-ink/80 text-sm mt-1.5 leading-relaxed">
                                      {e.note}
                                    </figcaption>
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
                            <div
                              key={b.t}
                              className="rounded-xl p-4"
                              style={{
                                background: "rgb(var(--ink) / 0.04)",
                                border: "1px solid rgb(var(--ink) / 0.08)",
                              }}
                            >
                              <p className="text-ink/75 text-[11px] font-semibold uppercase tracking-wider mb-2">
                                {b.t}
                              </p>
                              <p className="text-ink/85 text-sm leading-relaxed">{b.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
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
                <h2 className="font-display font-semibold text-ink text-sm">Language Proficiency · CEFR</h2>
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
                  <span className="text-ink/70 text-xs font-medium mt-1">{CEFR.band}</span>
                </div>
                <p className="text-ink/70 text-sm leading-relaxed flex-1">{CEFR.summary}</p>
              </div>

              {/* CEFR ladder */}
              <div
                className="mt-6"
                role="img"
                aria-label={`CEFR level achieved: ${CEFR.overall} (${CEFR.band})`}
              >
                <div className="flex gap-1.5">
                  {CEFR_LADDER.map((lvl) => {
                    const reached = CEFR_LADDER.indexOf(lvl) <= CEFR_LADDER.indexOf(CEFR.overall);
                    const isCurrent = lvl === CEFR.overall;
                    return (
                      <div key={lvl} className="flex-1 flex flex-col items-center gap-1.5">
                        <div
                          className="w-full h-2 rounded-full"
                          style={{
                            background: reached ? cefrColor(lvl) : "rgb(var(--ink) / 0.08)",
                          }}
                        />
                        <span
                          className="text-[11px] font-display"
                          style={{
                            color: isCurrent ? "rgb(var(--ink))" : "rgb(var(--ink) / 0.55)",
                            fontWeight: isCurrent ? 700 : 500,
                          }}
                        >
                          {lvl}
                        </span>
                      </div>
                    );
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
                      <span className="text-ink/75 text-xs font-semibold font-display">{d.name}</span>
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
                    <p className="text-ink/70 text-[11px] leading-relaxed">{d.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              {/* Sentiment + Clarity */}
              <div className="grid md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Sentiment */}
                <div className="glass rounded-2xl p-5">
                  <h2 className="font-display font-semibold text-ink text-sm mb-4">Sentiment</h2>
                  <div
                    className="h-3 rounded-full overflow-hidden flex mb-4"
                    role="img"
                    aria-label={SENTIMENT.map((s) => `${s.label} ${s.pct}%`).join(", ")}
                  >
                    {SENTIMENT.map((s) => (
                      <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
                    ))}
                  </div>
                  <div className="space-y-2">
                    {SENTIMENT.map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-ink/70">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: s.color }}
                            aria-hidden
                          />
                          {s.label}
                        </span>
                        <span className="font-display font-semibold text-ink tabular-nums">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clarity */}
                <div className="glass rounded-2xl p-5 flex flex-col">
                  <h2 className="font-display font-semibold text-ink text-sm mb-4">Clarity</h2>
                  <div className="flex items-center gap-4 mb-3">
                    <ScoreRing score={Math.round(CLARITY.score)} max={10} size={72} level="Clarity" />
                    <div>
                      <p className="font-display font-bold text-ink text-2xl">
                        {CLARITY.score.toFixed(1)}
                        <span className="text-ink/70 text-base">/10</span>
                      </p>
                      <p className="text-ink/70 text-xs">Message clarity index</p>
                    </div>
                  </div>
                  <p className="text-ink/70 text-xs leading-relaxed">{CLARITY.note}</p>
                </div>
              </div>

              {/* Tone */}
              <div className="glass rounded-2xl p-5">
                <h2 className="font-display font-semibold text-ink text-sm mb-4">Tone</h2>
                <div className="space-y-3">
                  {TONE.map((t) => (
                    <div key={t.label} className="flex items-center gap-3">
                      <span className="text-ink/70 text-xs font-medium w-28 flex-shrink-0">{t.label}</span>
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
                {reportLines
                  .filter((l) => l.tag)
                  .map((l) => (
                    <li key={l.time} className="flex gap-3 text-sm">
                      <span className="text-ink/75 text-xs tabular-nums w-10 flex-none pt-0.5">{l.time}</span>
                      <span className="flex-1">
                        <span
                          className="block text-xs font-semibold"
                          style={{ color: l.tag === "strength" ? "var(--ok)" : "var(--danger)" }}
                        >
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
                <h2 className="font-display font-semibold text-ink text-xl">Conversation Transcript</h2>
                <span
                  className="px-3 py-1 rounded-full text-ink/70 text-xs font-medium"
                  style={{ background: "rgb(var(--ink) / 0.05)" }}
                >
                  {(transcript.length > TRANSCRIPT.length ? transcript : FULL_TRANSCRIPT).length} turns ·{" "}
                  {DURATION}
                </span>
              </div>
              <div className="space-y-6">
                {(transcript.length > TRANSCRIPT.length ? transcript : FULL_TRANSCRIPT).map((t, i) => {
                  const you = t.speaker === "You";
                  return (
                    <div key={i} className={`flex flex-col gap-1.5 ${you ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-ink/80 text-xs font-bold font-display">{t.speaker}</span>
                        <span className="text-ink/70 text-[11px] tabular-nums">{t.time}</span>
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
                  );
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
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
              boxShadow: "0 8px 30px rgb(var(--accent-rgb) / 0.3)",
            }}
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
  );
}
