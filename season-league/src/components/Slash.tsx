import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Skewed slash transition between scenes. */
export function SlashScene({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.div
      key={id}
      className="scene"
      initial={{ clipPath: "polygon(110% 0, 130% 0, 120% 100%, 100% 100%)" }}
      animate={{ clipPath: "polygon(-30% 0, 130% 0, 120% 100%, -20% 100%)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
