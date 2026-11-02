/** Lobby column for the gap week (Trust Challenge) and the final. Placeholder; the Trust Challenge feature fills it in. */
import { useGame } from "../store/game.ts";

export function GapWeekColumn() {
  const content = useGame((s) => s.content);
  return (
    <div className="matchday-col slim">
      <h2 className="md-title">
        <span className="display">Gap week</span>
      </h2>
      <div className="tile tile-not-loaded">
        <span className="tile-title">{content.schedule.gapWeek.title}</span>
        <span className="tile-status">Coming soon</span>
      </div>
      <div className="tile tile-not-loaded">
        <span className="tile-title">{content.schedule.final.title}</span>
        <span className="tile-status">After Matchday 3</span>
      </div>
    </div>
  );
}
