import { useGame } from "../store/game.ts";

/** Scorers at work. No points show until full time. */
export function Scoring() {
  const status = useGame((s) => s.scoringStatus);
  return (
    <div className="scoring">
      <div className="whistle-ring" aria-hidden="true" />
      <h1 className="display h1">Full time is coming</h1>
      <p className="lede" aria-live="polite">
        {status ?? "The scorers are reviewing the plan and the call"}
      </p>
    </div>
  );
}
