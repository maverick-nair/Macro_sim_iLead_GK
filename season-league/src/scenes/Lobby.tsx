import { useEffect, useState } from "react";
import { mmss } from "../components/ScoreBug.tsx";
import { captainFor, fixtureStatus, matchdayUnlocked, nextPlayableRound } from "../engine/season.ts";
import { decisionDisplay } from "../engine/consequences.ts";
import { useGame, useLeadership } from "../store/game.ts";

const STATUS_LABEL: Record<string, string> = {
  played: "Played",
  live: "Live",
  next: "Next",
  upcoming: "Upcoming",
  locked: "Locked",
  "not-loaded": "Content not loaded",
};

/** Matchday lobby: fixtures, next fixture hero, form guide, squad, Kick off. */
export function Lobby() {
  const content = useGame((s) => s.content);
  const season = useGame((s) => s.season)!;
  const kickOff = useGame((s) => s.kickOff);
  const ctx = useGame((s) => s.fixtureContext)();
  const now = useGame((s) => s.now);
  const leadership = useLeadership();
  const next = nextPlayableRound(content, season, ctx);
  const [arrivedAt] = useState(now);
  const autoIn = Math.max(
    0,
    content.schedule.timers.autoKickOffSeconds - Math.floor((now - arrivedAt) / 1000),
  );

  // Self-running: the round kicks off on its own if nobody presses the button.
  useEffect(() => {
    if (next && autoIn === 0) kickOff();
  }, [next, autoIn, kickOff]);

  const m = season.metrics;
  const start = content.consequence.start;
  const character = next ? content.characters[next.character] : undefined;
  const captain = next ? captainFor(season.roster, next.round) : null;
  const firstLocked = content.schedule.matchdays.find((md) => !matchdayUnlocked(md.matchday, ctx));
  const allPlayed = content.rounds.rounds.every((r) => !r.loaded || season.records[String(r.round)]);

  return (
    <div className="lobby">
      <section className="fixtures" aria-label="Fixtures">
        {content.schedule.matchdays.map((md) => (
          <div key={md.matchday} className="matchday-col">
            <h2 className="md-title">
              <span className="display">Matchday {md.matchday}</span>{" "}
              <span className="muted">{md.title}</span>
            </h2>
            <div className="md-tiles">
              {content.rounds.rounds
                .filter((r) => r.matchday === md.matchday)
                .map((r) => {
                  const st = fixtureStatus(r, content, season, ctx);
                  const rec = season.records[String(r.round)];
                  return (
                    <div key={r.round} className={`tile tile-${st}`}>
                      <span className="tile-round display">R{r.round}</span>
                      <span className="tile-title">{r.title}</span>
                      <span className="tile-status">
                        {rec
                          ? `${decisionDisplay(rec.decisionPoints, content.consequence)}, plan ${rec.planScore}`
                          : STATUS_LABEL[st]}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        <div className="matchday-col slim">
          <h2 className="md-title">
            <span className="display">Gap week</span>
          </h2>
          <div className="tile tile-not-loaded">
            <span className="tile-title">{content.schedule.gapWeek.title}</span>
            <span className="tile-status">Content not loaded</span>
          </div>
          <div className="tile tile-not-loaded">
            <span className="tile-title">{content.schedule.final.title}</span>
            <span className="tile-status">Content not loaded</span>
          </div>
        </div>
      </section>

      <section className="hero" aria-label="Next fixture">
        {next ? (
          <>
            <p className="kicker">Next fixture</p>
            <h1 className="display h1">
              Round {next.round}: {next.title}
            </h1>
            <div className="hero-facts">
              <div>
                <span className="fact-label">Plan clock</span>
                <span className="fact-value display">{next.planMinutes} min</span>
              </div>
              <div>
                <span className="fact-label">On the line</span>
                <span className="fact-value">
                  {character ? `${character.name}, ${character.role}` : next.character}
                </span>
              </div>
              <div>
                <span className="fact-label">Leads</span>
                <span className="fact-value">{next.leads.join(", ")}</span>
              </div>
            </div>
            <div className="hero-cta">
              <button type="button" className="btn-primary huge-btn" onClick={kickOff}>
                Kick off
              </button>
              <span className="muted" aria-live="polite">
                Kicks off on its own in {mmss(autoIn)}
              </span>
            </div>
          </>
        ) : allPlayed ? (
          <>
            <p className="kicker">Season paused</p>
            <h1 className="display h1">Every loaded round is played</h1>
            <p className="muted">The next rounds start when their content is loaded from workbook v1.1.</p>
          </>
        ) : (
          <>
            <p className="kicker">Waiting for kick off</p>
            <h1 className="display h1">Matchday {firstLocked?.matchday ?? 1} has not opened yet</h1>
            <p className="muted">
              It opens on its own at{" "}
              {firstLocked
                ? new Date(firstLocked.unlockAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Riyadh",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "the scheduled time"}{" "}
              (KSA time).
            </p>
          </>
        )}
      </section>

      <section className="form-guide" aria-label="Form guide">
        <h2 className="display h3">Form guide</h2>
        <FormStat label="Leadership" value={`${leadership}`} sub="out of 100" />
        <FormStat
          label="Implementation survey"
          value={m.implementationSurvey.toFixed(1)}
          sub={`started at ${start.implementationSurvey.toFixed(1)}`}
        />
        <FormStat
          label="Six-month survey"
          value={m.sixMonthSurvey.toFixed(1)}
          sub={`started at ${start.sixMonthSurvey.toFixed(1)}`}
        />
        <FormStat
          label="Revenue"
          value={`${Math.round(m.revenuePct)}%`}
          sub={`of ${content.consequence.revenueCommitment.currency} ${content.consequence.revenueCommitment.amountMillions.toFixed(2)}m${season.flags.revenueDisputed ? ", disputed" : ""}`}
        />
      </section>

      <section className="squad-panel" aria-label="Squad">
        <h2 className="display h3">Squad</h2>
        <ul>
          {season.roster.map((p) => (
            <li key={p.name} className="squad-member">
              {captain?.name === p.name && (
                <span className="armband-c" aria-label="Captain">
                  C
                </span>
              )}
              <span className="member-name">{p.name}</span>
              <span className="muted">{p.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FormStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="form-stat">
      <span className="fact-label">{label}</span>
      <span className="form-value display">{value}</span>
      <span className="muted small">{sub}</span>
    </div>
  );
}
