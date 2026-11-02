import { useState } from "react";
import { CountUp } from "../components/CountUp.tsx";
import { MomentResults } from "../components/MomentResults.tsx";
import { TranscriptReviewButton } from "../components/TranscriptReview.tsx";
import { mmss } from "../components/ScoreBug.tsx";
import { decisionDisplay, leadershipScore } from "../engine/consequences.ts";
import { useGame } from "../store/game.ts";

/** Full time: scoreboard, key moment, coach's notes, the client's verdict, form update, Challenge a score. */
export function FullTime() {
  const round = useGame((s) => s.currentRound())!;
  const season = useGame((s) => s.season)!;
  const content = useGame((s) => s.content);
  const now = useGame((s) => s.now);
  const busy = useGame((s) => s.challengeBusy);
  const challenge = useGame((s) => s.challenge);
  const dispatch = useGame((s) => s.dispatch);
  const [picking, setPicking] = useState(false);
  const rec = season.records[String(round.round)];
  if (!rec) return null;

  const opt = round.options.find((o) => o.id === rec.decision);
  const character = content.characters[round.character]!;
  const leadAfter = leadershipScore(season.pointsEarned, season.pointsAvailable, content.consequence);
  const prevAvail =
    season.pointsAvailable -
    content.consequence.pointsPerRound.plan -
    content.consequence.pointsPerRound.decision;
  const leadBefore = leadershipScore(
    season.pointsEarned - rec.decisionPoints - rec.planScore,
    prevAvail,
    content.consequence,
  );
  const left = Math.max(
    0,
    content.schedule.timers.fullTimeSeconds - Math.floor((now - season.live!.phaseStartedAt) / 1000),
  );
  const keyMoment = !opt
    ? "Time ran out before a play was called. No decision points this round."
    : rec.rubric?.zeroedBy === "control-bypass"
      ? `${opt.keyMoment ?? opt.text} The plan releases a payment without the registered authorizers, so it scores zero.`
      : (opt.keyMoment ?? opt.text);
  const m0 = rec.metricsBefore;
  const m1 = rec.metricsAfter;
  const delta = (a: number, b: number, unit = "") => {
    const d = Math.round((b - a) * 10) / 10;
    return d === 0 ? "no change" : `${d > 0 ? "up" : "down"} ${Math.abs(d)}${unit}`;
  };

  return (
    <div className="fulltime">
      <div className="ft-head">
        <p className="kicker">Full time, Round {round.round}</p>
        <h1 className="display h1">{round.title}</h1>
      </div>

      <section className="scoreboard" aria-label="Scoreboard">
        <div className="score-tile">
          <span className="fact-label">Decision</span>
          <span className="score-big display">
            {decisionDisplay(rec.decisionPoints, content.consequence)}
          </span>
          <span className="muted small">{opt ? `Play ${opt.id}: ${opt.label}` : "No play called"}</span>
        </div>
        <div className="score-tile">
          <span className="fact-label">Plan quality</span>
          <span className="score-big display">
            <CountUp value={rec.planScore} />
            <span className="score-of">/20</span>
          </span>
          <span className="muted small">
            {rec.rubric?.zeroedBy ? "Zeroed by the rules" : (rec.rubric?.scorer ?? "")}
          </span>
        </div>
        <div className="score-tile">
          <span className="fact-label">Trust Meter</span>
          <span className="score-big display">
            <CountUp value={rec.trust?.average ?? 0} decimals={1} />
            <span className="score-of">/10</span>
          </span>
          <span className="muted small">{rec.trust?.scorer}</span>
        </div>
      </section>

      <MomentResults record={rec} />

      <section className="key-moment" aria-label="Key moment">
        <span className="fact-label">Key moment</span>
        <p className="display h3">{keyMoment}</p>
      </section>

      <section className="form-update" aria-label="Form update">
        <h2 className="display h4">Form update</h2>
        <p>
          Leadership <strong>{leadAfter}</strong>{" "}
          <span className="muted">({delta(leadBefore, leadAfter)})</span>
        </p>
        <p>
          Implementation survey <strong>{m1.implementationSurvey.toFixed(1)}</strong>{" "}
          <span className="muted">({delta(m0.implementationSurvey, m1.implementationSurvey)})</span>
        </p>
        <p>
          Six-month survey <strong>{m1.sixMonthSurvey.toFixed(1)}</strong>{" "}
          <span className="muted">({delta(m0.sixMonthSurvey, m1.sixMonthSurvey)})</span>
        </p>
        <p>
          Revenue <strong>{Math.round(m1.revenuePct)}%</strong>{" "}
          <span className="muted">({delta(m0.revenuePct, m1.revenuePct, " points")})</span>
        </p>
      </section>

      <section className="coach" aria-label="Coach's notes">
        <h2 className="display h4">Coach's notes</h2>
        <ul>
          {rec.rubric?.lines.map((l) => (
            <li key={l.id}>
              <span className="note-score display">{l.score}</span>
              <span>
                <strong>{content.rubric.lines.find((x) => x.id === l.id)?.label}</strong> {l.reason}
              </span>
            </li>
          ))}
        </ul>
        {rec.rubric?.tryThis && (
          <p className="try-this">
            <strong>Try this:</strong> {rec.rubric.tryThis}
          </p>
        )}
      </section>

      <section className="verdict" aria-label="The client's verdict">
        <span className="fact-label">{character.name}'s verdict</span>
        <blockquote className="display h3">{rec.trust?.verdict}</blockquote>
        <ul className="behaviors">
          {rec.trust?.behaviors.map((b) => (
            <li key={b.id}>
              <span>{content.trustMeter.behaviors.find((x) => x.id === b.id)?.label ?? b.id}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${b.score * 10}%` }} />
              </span>
              <span className="display">{b.score}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="ft-actions">
        <TranscriptReviewButton record={rec} />
        {rec.challenge ? (
          <p className="challenge-result">
            Challenge settled: {rec.challenge.target === "plan" ? "plan quality" : "Trust Meter"}{" "}
            {rec.challenge.before} to {rec.challenge.after}. Final.
          </p>
        ) : picking ? (
          <div className="challenge-pick" role="group" aria-label="Challenge which score">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => void challenge("plan")}
            >
              Plan quality
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => void challenge("trust")}
            >
              Trust Meter
            </button>
            <span className="muted small">
              {busy ? "A fresh scoring pass is running" : "One challenge per round. The fresh pass is final."}
            </span>
          </div>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>
            Challenge a score
          </button>
        )}
        <button
          type="button"
          className="btn-primary big"
          onClick={() => dispatch({ type: "TO_LEAGUE", now: Date.now() })}
        >
          To the league table
        </button>
        <span className="muted small">Moves on in {mmss(left)}</span>
      </div>
    </div>
  );
}
