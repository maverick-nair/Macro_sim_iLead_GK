import { type ReactNode, useEffect, useState } from "react";

/** One fixed landscape stage, scaled to fit the window and letterboxed. No page scroll. */
export function Stage({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / width, window.innerHeight / height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width, height]);
  return (
    <div className="letterbox">
      <div className="stage" style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
