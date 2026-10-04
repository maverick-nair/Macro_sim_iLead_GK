import { useEffect, useState } from "react";
import type { Page, SessionStats } from "./types";
import { ThemeContext } from "./lib/theme";
import LandingPage from "./pages/LandingPage";
import SessionPage from "./pages/SessionPage";
import SummaryPage from "./pages/SummaryPage";
import { TRANSCRIPT } from "./data/transcript";

export default function App() {
  const [page, setPage] = useState<Page>("landing");
  const [dark, setDark] = useState(true);
  const [transcript, setTranscript] = useState(TRANSCRIPT);
  const [stats, setStats] = useState<SessionStats>({
    startXp: 560,
    endXp: 745,
    badges: ["icebreaker", "detective", "hot-streak"],
    bestStreak: 4,
    objectives: 2,
    startRank: 4,
    endRank: 3,
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <div className="h-full" style={{ background: "transparent" }}>
        {page === "landing" && <LandingPage onStart={() => setPage("session")} />}
        {page === "session" && (
          <SessionPage
            onEnd={(msgs, st) => {
              setTranscript(msgs);
              // A call ended without new turns falls back to the sample session stats.
              if (st.endXp > st.startXp) setStats(st);
              setPage("summary");
            }}
          />
        )}
        {page === "summary" && <SummaryPage transcript={transcript} stats={stats} />}
      </div>
    </ThemeContext.Provider>
  );
}
