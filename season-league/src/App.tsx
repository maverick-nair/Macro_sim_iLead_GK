import { AnimatePresence, MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { BreakingOverlay } from "./components/Breaking.tsx";
import { ScoreBug } from "./components/ScoreBug.tsx";
import { SlashScene } from "./components/Slash.tsx";
import { Stage } from "./components/Stage.tsx";
import { kudosDue } from "./engine/kudos.ts";
import { finalOpen, needsCheckin, nextPlayableRound } from "./engine/season.ts";
import { Briefing } from "./scenes/Briefing.tsx";
import { Countdown } from "./scenes/Countdown.tsx";
import { Final } from "./scenes/Final.tsx";
import { Kudos } from "./scenes/Kudos.tsx";
import { Moment } from "./scenes/Moment.tsx";
import { Moved } from "./scenes/Moved.tsx";
import { TrustChallenge } from "./scenes/TrustChallenge.tsx";
import { CodeEntry, Roster } from "./scenes/CheckIn.tsx";
import { FullTime } from "./scenes/FullTime.tsx";
import { GamePlan } from "./scenes/GamePlan.tsx";
import { Inject } from "./scenes/Inject.tsx";
import { LeagueTable } from "./scenes/LeagueTable.tsx";
import { Lobby } from "./scenes/Lobby.tsx";
import { OnAir } from "./scenes/OnAir.tsx";
import { Scoring } from "./scenes/Scoring.tsx";
import { useGame } from "./store/game.ts";

function useScene(): { id: string; node: JSX.Element; bug: boolean } {
  const squad = useGame((s) => s.squad);
  const season = useGame((s) => s.season);
  const content = useGame((s) => s.content);
  const ctx = useGame((s) => s.fixtureContext)();
  const movedAway = useGame((s) => s.movedAway);
  const finalUnlockAt = useGame((s) => s.finalUnlockAt);
  if (!squad || !season) return { id: "code", node: <CodeEntry />, bug: false };
  if (movedAway) return { id: "moved", node: <Moved />, bug: false };
  const live = season.live;
  if (live) {
    switch (live.phase) {
      case "COUNTDOWN":
        return { id: "countdown", node: <Countdown />, bug: true };
      case "MOMENT":
        return { id: `moment-${live.moment?.momentId ?? "x"}`, node: <Moment />, bug: true };
      case "BRIEFING":
        return { id: "briefing", node: <Briefing />, bug: true };
      case "PLANNING":
        return { id: "plan", node: <GamePlan />, bug: true };
      case "LOCKED_IN":
      case "INJECT":
        return { id: live.phase, node: <Inject />, bug: true };
      case "ON_AIR":
        return { id: "onair", node: <OnAir />, bug: true };
      case "SCORING":
        return { id: "scoring", node: <Scoring />, bug: true };
      case "FULL_TIME":
        return { id: "fulltime", node: <FullTime />, bug: true };
      case "LEAGUE":
        return { id: "league", node: <LeagueTable />, bug: true };
      default:
        break;
    }
  }
  if (season.trustChallenge.activeSitting)
    return { id: `tc-${season.trustChallenge.activeSitting}`, node: <TrustChallenge />, bug: true };
  const kudosMatchday = kudosDue(content, season);
  if (kudosMatchday !== null) return { id: `kudos-${kudosMatchday}`, node: <Kudos />, bug: true };
  if (!season.finalSeen && finalOpen(content, season, ctx, finalUnlockAt))
    return { id: "final", node: <Final />, bug: false };
  const next = nextPlayableRound(content, season, ctx);
  const matchday = next?.matchday ?? 1;
  if (needsCheckin(season, matchday))
    return { id: `roster-${matchday}`, node: <Roster matchday={matchday} />, bug: false };
  return { id: "lobby", node: <Lobby />, bug: true };
}

export function Game() {
  const init = useGame((s) => s.init);
  const tick = useGame((s) => s.tick);
  const reducedMotion = useGame((s) => s.reducedMotion);
  useEffect(() => {
    void init();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [init, tick]);
  const scene = useScene();
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <Stage width={1194} height={834}>
        <div className={`game${reducedMotion ? " reduce-motion" : ""}`}>
          {scene.bug && <ScoreBug />}
          <main className="scene-wrap">
            <AnimatePresence mode="wait">
              <SlashScene id={scene.id} key={scene.id}>
                {scene.node}
              </SlashScene>
            </AnimatePresence>
          </main>
          <BreakingOverlay />
        </div>
      </Stage>
    </MotionConfig>
  );
}
