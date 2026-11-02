import { motion } from "framer-motion";
import { Crest } from "../components/Crest.tsx";
import type { Standing } from "../engine/league.ts";
import { useGame } from "../store/game.ts";

export function LeagueRows({
  standings,
  highlight,
  large = false,
}: {
  standings: Standing[];
  highlight?: string;
  large?: boolean;
}) {
  const max = Math.max(1, ...standings.map((s) => s.points));
  return (
    <ol className={`league-rows${large ? " large" : ""}`}>
      {standings.map((s) => (
        <motion.li
          layout
          key={s.squadId}
          className={`league-row${s.squadId === highlight ? " mine" : ""}`}
          style={{ ["--squad" as string]: `var(--squad-${s.colour})` }}
        >
          <span className="lr-rank display">{s.rank}</span>
          <span className={`lr-move ${s.movement > 0 ? "up" : s.movement < 0 ? "down" : ""}`}>
            {s.movement > 0 ? `up ${s.movement}` : s.movement < 0 ? `down ${-s.movement}` : "same"}
          </span>
          <Crest name={s.name} colour={s.colour} size={large ? 44 : 30} />
          <span className="lr-name">
            {s.name}
            {s.demo && <span className="demo-tag">Demo squad</span>}
          </span>
          <span className="lr-bar" aria-hidden="true">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${(s.points / max) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </span>
          <span className="lr-points display">{s.points.toFixed(1)}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/** League table after every round: points, colour bars, rank movement, pending categories marked. */
export function LeagueTable() {
  const standings = useGame((s) => s.standings)();
  const content = useGame((s) => s.content);
  const squad = useGame((s) => s.squad);
  const dispatch = useGame((s) => s.dispatch);
  const pending = standings[0]?.pending ?? [];
  return (
    <div className="league">
      <div className="league-head">
        <p className="kicker">League table</p>
        <h1 className="display h1">Where the season stands</h1>
      </div>
      <LeagueRows standings={standings} highlight={squad?.id} />
      <div className="league-foot">
        <p className="pending">
          <span className="fact-label">Still to play for</span>{" "}
          {content.league.categories
            .filter((c) => pending.includes(c.id))
            .map((c) => `${c.label} (${c.weight})`)
            .join(", ") || "Nothing. Every category is in."}
        </p>
        <p className="muted small">Ties go to the Trust Meter.</p>
        <button
          type="button"
          className="btn-primary big"
          onClick={() => dispatch({ type: "TO_LEAGUE", now: Date.now() })}
        >
          Back to the lobby
        </button>
      </div>
    </div>
  );
}
