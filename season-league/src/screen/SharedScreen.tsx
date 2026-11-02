import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchResults } from "../ai/client.ts";
import { computeLeague, type SquadResults } from "../engine/league.ts";
import { LeagueRows } from "../scenes/LeagueTable.tsx";
import { useGame } from "../store/game.ts";

type Feed = {
  breaking?: { headline: string; text: string } | null;
  trust?: { squad: string; round: number; average: number; verdict: string } | null;
};
const VIEWS = ["table", "trust", "breaking", "next"] as const;

/** The shared room screen: a broadcast that cycles on its own. No controls. */
export function SharedScreen() {
  const content = useGame((s) => s.content);
  const [results, setResults] = useState<Record<string, SquadResults>>({});
  const [feed, setFeed] = useState<Feed>({});
  const [view, setView] = useState(0);
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await fetchResults();
      if (!data) return;
      setResults(data.results as Record<string, SquadResults>);
      setFeed(data.feed as Feed);
    };
    void load();
    const poll = setInterval(load, 3000);
    const cycle = setInterval(() => setView((v) => (v + 1) % VIEWS.length), 12000);
    return () => {
      clearInterval(poll);
      clearInterval(cycle);
    };
  }, []);

  const played = new Set(Object.values(results).flatMap((r) => Object.keys(r.rounds ?? {})));
  const rows = content.squads.squads.map((s): SquadResults => {
    if (s.bot) {
      const fixed = content.squads.botResults[s.id] ?? {};
      return {
        squadId: s.id,
        name: s.name,
        colour: s.colour,
        demo: true,
        rounds: Object.fromEntries(Object.entries(fixed).filter(([k]) => played.has(k))),
      };
    }
    return results[s.id] ?? { squadId: s.id, name: s.name, colour: s.colour, rounds: {} };
  });
  const standings = computeLeague(content.league, rows, order.length ? order : undefined);
  const key = standings.map((s) => s.squadId).join();
  useEffect(() => {
    const t = setTimeout(() => setOrder(key.split(",")), 8000);
    return () => clearTimeout(t);
  }, [key]);

  const nextRound = content.rounds.rounds.find((r) => r.loaded && !played.has(String(r.round)));
  const emails = content.rounds.rounds.flatMap((r) =>
    r.loaded ? r.evidence.filter((e) => e.kind === "email") : [],
  );
  const ticker = emails.length ? emails.map((e) => `${e.title}: ${e.text}`) : ["Season League is live"];
  let v = VIEWS[view]!;
  if (v === "breaking" && !feed.breaking) v = "table";
  if (v === "trust" && !feed.trust) v = "next";

  return (
    <div className="screen">
      <header className="screen-head">
        <span className="display">The Client Majlis</span>
        <span className="screen-live">
          <span className="dot" aria-hidden="true" /> Season League live
        </span>
      </header>
      <main className="screen-main">
        <AnimatePresence mode="wait">
          <motion.section
            key={v}
            className="screen-view"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
          >
            {v === "table" && (
              <>
                <h1 className="display screen-title">League table</h1>
                <LeagueRows standings={standings} large />
              </>
            )}
            {v === "trust" && feed.trust && (
              <div className="screen-card">
                <p className="kicker">
                  Latest Trust Meter, {feed.trust.squad}, Round {feed.trust.round}
                </p>
                <p className="screen-big display">{feed.trust.average.toFixed(1)}</p>
                <blockquote className="display screen-quote">{feed.trust.verdict}</blockquote>
              </div>
            )}
            {v === "breaking" && feed.breaking && (
              <div className="screen-card breaking-card">
                <div className="breaking-tag">Breaking news</div>
                <h1 className="display screen-title">{feed.breaking.headline}</h1>
                <p className="screen-quote">{feed.breaking.text}</p>
              </div>
            )}
            {v === "next" && (
              <div className="screen-card">
                <p className="kicker">Up next</p>
                <h1 className="display screen-title">
                  {nextRound
                    ? `Round ${nextRound.round}: ${nextRound.title}`
                    : "Waiting for the next content load"}
                </h1>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
      <footer className="ticker" aria-label="Client emails">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
