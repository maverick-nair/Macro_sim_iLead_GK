import { motion } from "framer-motion";
import { useEffect } from "react";
import { useGame } from "../store/game.ts";

/** Breaking news when a past choice lands. Clears itself after a few seconds. */
export function BreakingOverlay() {
  const breaking = useGame((s) => s.breaking);
  const dismiss = useGame((s) => s.dismissBreaking);
  useEffect(() => {
    if (!breaking) return;
    const t = setTimeout(dismiss, 9000);
    return () => clearTimeout(t);
  }, [breaking, dismiss]);
  if (!breaking) return null;
  return (
    <motion.div
      className="breaking-overlay"
      role="alertdialog"
      aria-labelledby="breaking-h"
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="breaking-tag">Breaking news</div>
      <h2 id="breaking-h" className="display">
        {breaking.headline}
      </h2>
      <p>{breaking.text}</p>
      <p className="muted">From your Round {breaking.fromRound} decision.</p>
      <button type="button" className="btn-primary" onClick={dismiss} autoFocus>
        Back to the match
      </button>
    </motion.div>
  );
}
