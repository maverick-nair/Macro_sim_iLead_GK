import { evidenceFor, ticketsInRound } from "../engine/consequences.ts";
import { InputCards } from "../components/InputCards.tsx";
import { useGame } from "../store/game.ts";

/** Scouting report: the round's evidence with the big numbers pulled out. The plan clock is running. */
export function Briefing() {
  const round = useGame((s) => s.currentRound())!;
  const season = useGame((s) => s.season)!;
  const dispatch = useGame((s) => s.dispatch);
  const evidence = evidenceFor(round, season);
  const tickets = ticketsInRound(season, round.round);
  return (
    <div className="briefing">
      <div className="brief-head">
        <p className="kicker">Scouting report, Round {round.round}</p>
        <h1 className="display h1">{round.title}</h1>
        <p className="scenario">{round.scenario}</p>
      </div>
      <div className="evidence-grid">
        {evidence.map((e, i) => (
          <article key={e.id} className="evidence-card" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="ev-kind">{e.title}</span>
            {e.highlight && (
              <p className="ev-big display">
                {e.highlight}
                {e.highlightLabel && <span className="ev-big-label">{e.highlightLabel}</span>}
              </p>
            )}
            <p className="ev-text">{e.text}</p>
          </article>
        ))}
      </div>
      {tickets.length > 0 && (
        <p className="ticket-strip">Open tickets: {tickets.map((t) => `${t.id} (${t.status})`).join(", ")}</p>
      )}
      <div className="brief-foot">
        <p className="prompt-line">
          <span className="fact-label">The question</span>
          <span className="display h3">{round.prompt}</span>
        </p>
        <button
          type="button"
          className="btn-primary big"
          onClick={() => dispatch({ type: "OPEN_PLAN", now: Date.now() })}
        >
          Open the plan board
        </button>
      </div>
      <InputCards cards={round.inputCards} showAt="briefing" />
    </div>
  );
}
