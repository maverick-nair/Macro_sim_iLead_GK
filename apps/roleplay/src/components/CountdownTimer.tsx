import { useEffect, useState } from "react";

// Owns its own interval so the per-second tick re-renders only these two lines,
// not the entire session view (video, panels, leaderboard, transcript).
export default function CountdownTimer({ initial }: { initial: number }) {
  const [t, setT] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const mins = String(Math.floor(t / 60)).padStart(2, "0");
  const secs = String(t % 60).padStart(2, "0");
  return (
    <div className="hidden sm:flex flex-col items-center pr-2 mr-1 border-r border-ink/10">
      <span className="text-ink/70 text-[10px] font-medium tracking-widest uppercase font-display">
        Remaining
      </span>
      <span className="font-display font-bold text-ink text-base tracking-wide tabular-nums">
        {mins}:{secs}
      </span>
    </div>
  );
}
