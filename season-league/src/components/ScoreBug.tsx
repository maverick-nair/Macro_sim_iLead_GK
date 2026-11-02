import { captainFor, nextPlayableRound } from "../engine/season.ts";
import { useClock, useGame } from "../store/game.ts";
import { Crest } from "./Crest.tsx";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export const mmss = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

/** The score bug: squad crest and colour, matchday, round, clock, league position, captain armband. */
export function ScoreBug({ round }: { round?: number }) {
  const squad = useGame((s) => s.squad);
  const season = useGame((s) => s.season);
  const content = useGame((s) => s.content);
  const aiMode = useGame((s) => s.aiMode);
  const muted = useGame((s) => s.muted);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const setMuted = useGame((s) => s.setMuted);
  const setReducedMotion = useGame((s) => s.setReducedMotion);
  const voice = useGame((s) => s.voice);
  const setVoice = useGame((s) => s.setVoice);
  const standings = useGame((s) => s.standings)();
  const clock = useClock();
  const ctx = useGame((s) => s.fixtureContext)();
  if (!squad || !season) return null;

  const live = season.live;
  const upcoming = live ? null : nextPlayableRound(content, season, ctx);
  const r = round ?? live?.round;
  const roundInfo = r ? content.rounds.rounds[r - 1] : upcoming;
  const captain = captainFor(season.roster, r ?? upcoming?.round ?? 1);
  const anyPlayed = standings.some((x) => x.pending.length < x.categories.length);
  const pos = anyPlayed ? standings.find((x) => x.squadId === squad.id)?.rank : undefined;
  const urgent = clock !== null && clock <= 60;
  const clockText =
    clock !== null
      ? mmss(clock)
      : live && (live.phase === "FULL_TIME" || live.phase === "LEAGUE")
        ? "Full time"
        : live?.phase === "INJECT" || live?.phase === "LOCKED_IN"
          ? "Locked"
          : live?.phase === "SCORING"
            ? "Scoring"
            : upcoming
              ? mmss(upcoming.planMinutes * 60)
              : "Paused";

  return (
    <header className="scorebug" style={{ ["--squad" as string]: `var(--squad-${squad.colour})` }}>
      <div className="bug-squad">
        <Crest name={squad.name} colour={squad.colour} size={34} />
        <span className="bug-name">{squad.name}</span>
      </div>
      <div className="bug-cell">
        <span className="bug-label">Matchday</span>
        <span className="bug-value">{roundInfo?.matchday ?? 1}</span>
      </div>
      <div className="bug-cell">
        <span className="bug-label">Round</span>
        <span className="bug-value">{r ?? upcoming?.round ?? "None"}</span>
      </div>
      <div
        className={`bug-clock${urgent ? " urgent" : ""}${/^\d/.test(clockText) ? "" : " word"}`}
        role="timer"
        aria-live="off"
        aria-label={clock !== null ? `Clock ${mmss(clock)} left` : `Clock stopped: ${clockText}`}
      >
        {clockText}
      </div>
      <div className="bug-cell">
        <span className="bug-label">League</span>
        <span className="bug-value">{pos ? ordinal(pos) : "Level"}</span>
      </div>
      {captain && (
        <div className="armband" title="Captain this round">
          <span className="armband-c" aria-hidden="true">
            C
          </span>
          <span>
            <span className="sr-only">Captain: </span>
            {captain.name}
          </span>
        </div>
      )}
      {aiMode === "mock" && <span className="badge-demo">Demo AI</span>}
      <div className="bug-toggles">
        <button type="button" className="toggle" aria-pressed={!muted} onClick={() => setMuted(!muted)}>
          {muted ? "Sound off" : "Sound on"}
        </button>
        <button type="button" className="toggle" aria-pressed={voice} onClick={() => setVoice(!voice)}>
          {voice ? "Voice on" : "Voice off"}
        </button>
        <button
          type="button"
          className="toggle"
          aria-pressed={reducedMotion}
          onClick={() => setReducedMotion(!reducedMotion)}
        >
          {reducedMotion ? "Motion off" : "Motion on"}
        </button>
      </div>
    </header>
  );
}
