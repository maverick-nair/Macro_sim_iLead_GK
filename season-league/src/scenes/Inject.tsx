import { motion } from "framer-motion";
import { useGame } from "../store/game.ts";

/** Locked in, then the breaking card that brings the client on air. Both move on by themselves. */
export function Inject() {
  const round = useGame((s) => s.currentRound())!;
  const live = useGame((s) => s.season!.live!);
  const content = useGame((s) => s.content);
  const dispatch = useGame((s) => s.dispatch);
  const character = content.characters[round.character];

  if (live.phase === "LOCKED_IN")
    return (
      <div className="locked-in">
        <motion.h1
          className="display huge"
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {live.autoSubmitted ? "Time. The board is locked" : "Play locked"}
        </motion.h1>
        <p className="lede">
          {live.plan.decision ? `Play ${live.plan.decision} is on the board.` : "No play was called."}
        </p>
      </div>
    );

  return (
    <div className="inject">
      <div className="breaking-tag">Breaking</div>
      <motion.h1 className="display huge" initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
        {round.inject.headline}
      </motion.h1>
      <p className="lede">{round.inject.text}</p>
      {character && (
        <p className="muted">
          {character.name}, {character.role}
          {character.location ? `, ${character.location}` : ""}
        </p>
      )}
      <button
        type="button"
        className="btn-primary huge-btn"
        autoFocus
        onClick={() => dispatch({ type: "TAKE_CALL", now: Date.now() })}
      >
        Take the call
      </button>
    </div>
  );
}
