import ThemeToggle from "../components/ThemeToggle";
import BoxField from "../components/BoxField";
import SectionLabel from "../components/SectionLabel";
import RollingNumber from "../components/RollingNumber";
import BadgeMedal from "../components/BadgeMedal";
import {
  ASSESSED_SKILLS,
  LANDING_OBJECTIVES,
  PLAYERS_COMPLETED,
  PORTRAIT_SRC,
  SCENE_SRC,
} from "../data/scenario";
import { BADGES } from "../data/badges";

export default function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative isolate min-h-full overflow-auto" style={{ background: "transparent" }}>
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
          <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <span className="text-white text-sm font-bold font-display leading-none">AI</span>
          </div>
          <span className="text-ink font-display font-semibold text-base tracking-tight">RolePlay</span>
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

      {/* Hero: text 70% / portrait 30% */}
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
              Step in as the account executive on a seven-figure renewal. A tough procurement lead, a cheaper
              rival quote, and a Friday deadline. Fifteen adaptive minutes that score how you hold value under
              pressure.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onStart}
                className="group inline-flex items-center gap-3 px-8 py-4 font-display font-semibold text-white text-sm tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
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
            <div
              className="mt-10 grid grid-cols-2 sm:grid-cols-4 border border-ink/15 max-w-2xl"
              style={{ background: "var(--surface)" }}
            >
              {[
                {
                  k: "Level",
                  v: "Competent",
                  sub: (
                    <span className="block mt-2 h-1 w-full" style={{ background: "rgb(var(--ink) / 0.12)" }}>
                      <span className="block h-full" style={{ width: "30%", background: "var(--brand)" }} />
                    </span>
                  ),
                },
                {
                  k: "Season XP",
                  v: <RollingNumber value={560} />,
                  sub: <span className="text-ink/75 text-xs">140 XP to Proficient</span>,
                },
                {
                  k: "Badges",
                  v: (
                    <span>
                      0<span className="text-ink/70 text-sm">/{BADGES.length}</span>
                    </span>
                  ),
                  sub: <span className="text-ink/75 text-xs">Unlock them in play</span>,
                },
                {
                  k: "Season Rank",
                  v: "#4",
                  sub: <span className="text-ink/75 text-xs">of {PLAYERS_COMPLETED} players</span>,
                },
              ].map((c, i) => (
                <div
                  key={c.k}
                  className={`p-4 ${i ? "border-l border-ink/10" : ""} ${i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${i === 3 ? "max-sm:border-t" : ""}`}
                >
                  <p className="text-ink/75 text-[10px] font-display uppercase tracking-widest mb-1">{c.k}</p>
                  <p className="font-display font-bold text-ink text-lg">{c.v}</p>
                  {c.sub}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 max-w-2xl">
              <span className="text-ink/75 text-xs font-display uppercase tracking-widest mr-1">
                Badges up for grabs
              </span>
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
                <p className="font-display font-semibold text-ink text-sm">Margaret Hale</p>
                <p className="text-ink/80 text-xs mt-0.5">VP Procurement, Northwind Freight · Your client</p>
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
            <p className="font-display text-xs font-semibold tracking-[0.2em] text-brand mb-2">THE SCENE</p>
            <p className="text-ink text-sm leading-relaxed">
              Northwind's glass-walled boardroom, three days before the contract expires. Margaret has done
              her homework, brought a rival quote, and made it clear she is willing to walk. Her team relies
              on your platform every day, but her CFO only sees the invoice. What you uncover in the next few
              minutes decides whether this becomes a price war or a partnership.
            </p>
          </div>
        </div>
      </section>

      {/* Briefing: concise, text-forward */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pb-16 animate-fade-in-up">
        <div
          className="grid md:grid-cols-3 border border-ink/10 mb-6"
          style={{ background: "rgb(var(--ink) / 0.08)", gap: 1 }}
        >
          <section className="p-7" style={{ background: "var(--surface)" }}>
            <SectionLabel index="01">Your Role</SectionLabel>
            <p className="text-ink/80 text-sm leading-relaxed">
              You are a senior account executive at Cloudline and have owned the Northwind account since it
              was signed. The contract is worth $1.2M a year and your quarter depends on it. You know the
              platform has cut their late deliveries, but you also know your price is the highest in the
              market.
            </p>
          </section>
          <section className="p-7" style={{ background: "var(--surface)" }}>
            <SectionLabel index="02">Your Goal</SectionLabel>
            <p className="text-ink/80 text-sm leading-relaxed">
              Renew the contract on terms that protect your margin and the relationship. Find out what is
              really driving Margaret's position, trade value rather than hand out discounts, and leave with
              an agreed next step that both of you can take back to your leadership.
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
              <span className="h-px flex-none w-6" style={{ background: "rgba(244,63,94,0.4)" }} />
              <h2 className="font-display font-semibold text-danger text-base tracking-tight">
                The Challenge
              </h2>
            </div>
            <p className="text-ink/85 text-sm leading-relaxed">
              Margaret lays down a competitor quote 22% below yours and a Friday deadline. Hold your ground
              without losing her, and turn an ultimatum into a real negotiation.
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
                    <span
                      aria-hidden
                      className="h-px w-8 bg-ink/15 group-hover:bg-[var(--brand)] transition-colors"
                    />
                  </span>
                  <span>
                    <span className="block font-display font-semibold text-ink text-sm mb-1">{sk.name}</span>
                    <span className="block text-ink/75 text-xs leading-relaxed">{sk.desc}</span>
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
              How each quest is judged stays hidden until you complete it. Play it the way you would a real
              call.
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
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
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
  );
}
