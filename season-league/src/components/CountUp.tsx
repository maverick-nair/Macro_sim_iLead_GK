import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useGame } from "../store/game.ts";

/** Count-up number for full time reveals. Jumps straight to the value under reduced motion. */
export function CountUp({
  value,
  decimals = 0,
  duration = 1.2,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const prefersReduced = useReducedMotion();
  const reduced = useGame((s) => s.reducedMotion) || prefersReduced;
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, { duration, ease: "easeOut", onUpdate: setShown });
    return () => controls.stop();
  }, [value, reduced, duration]);
  return <>{shown.toFixed(decimals)}</>;
}
