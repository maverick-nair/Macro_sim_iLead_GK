import { type FormEvent, useState } from "react";
import { Crest } from "../components/Crest.tsx";
import type { Member } from "../engine/types.ts";
import { useGame } from "../store/game.ts";

function DemoSwitch() {
  const demo = useGame((s) => s.demo);
  const unlockOverride = useGame((s) => s.unlockOverride);
  const setUnlockOverride = useGame((s) => s.setUnlockOverride);
  if (!demo) return null;
  return (
    <label className="demo-switch">
      <input type="checkbox" checked={unlockOverride} onChange={(e) => setUnlockOverride(e.target.checked)} />
      <span>Unlock now (demo mode)</span>
    </label>
  );
}

/** Squad check-in, step 1: the squad code. */
export function CodeEntry() {
  const demo = useGame((s) => s.demo);
  const checkIn = useGame((s) => s.checkIn);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(checkIn(code));
  };
  return (
    <div className="checkin">
      <div className="checkin-hero">
        <p className="kicker">The Client Majlis</p>
        <h1 className="display huge">Season League</h1>
        <p className="lede">One squad, one tablet, nine rounds with Gulf Horizon Trading.</p>
      </div>
      <form className="code-card" onSubmit={submit}>
        <label htmlFor="code" className="display h3">
          Squad code
        </label>
        <input
          id="code"
          className="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="DEMO3"
          aria-describedby={error ? "code-error" : undefined}
        />
        {error && (
          <p id="code-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary big" disabled={code.trim().length < 3}>
          Enter the stadium
        </button>
        {demo && <p className="muted small">Demo squad code: DEMO3</p>}
      </form>
      <div className="checkin-foot">
        <DemoSwitch />
      </div>
    </div>
  );
}

/** Squad check-in, step 2: roster and roles, confirmed at every matchday. */
export function Roster({ matchday }: { matchday: number }) {
  const squad = useGame((s) => s.squad)!;
  const season = useGame((s) => s.season);
  const content = useGame((s) => s.content);
  const confirmRoster = useGame((s) => s.confirmRoster);
  const signOut = useGame((s) => s.signOut);
  const roles = content.squads.roles;
  const [members, setMembers] = useState<Member[]>(
    season?.roster.length ? season.roster : roles.slice(0, 4).map((role) => ({ name: "", role })),
  );

  const filled = members.filter((m) => m.name.trim());
  const valid =
    filled.length >= 4 && filled.length <= 5 && new Set(filled.map((m) => m.role)).size === filled.length;
  const update = (i: number, patch: Partial<Member>) =>
    setMembers(members.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const usedRoles = new Set(members.map((m) => m.role));

  return (
    <div className="checkin roster" style={{ ["--squad" as string]: `var(--squad-${squad.colour})` }}>
      <div className="roster-head">
        <Crest name={squad.name} colour={squad.colour} size={64} />
        <div>
          <p className="kicker">Matchday {matchday} check-in</p>
          <h1 className="display h1">Who is on the pitch for {squad.name}?</h1>
          <p className="muted">
            Four or five players, one role each. The captain armband rotates every round in this order.
          </p>
        </div>
      </div>
      <ol className="roster-list">
        {members.map((m, i) => (
          <li key={i} className="roster-row">
            <span className="roster-num display">{i + 1}</span>
            <input
              className="name-input"
              aria-label={`Player ${i + 1} name`}
              value={m.name}
              placeholder={i === 4 ? "Fifth player (optional)" : "Name"}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <div className="chips" role="radiogroup" aria-label={`Player ${i + 1} role`}>
              {roles.map((role) => (
                <button
                  type="button"
                  key={role}
                  role="radio"
                  aria-checked={m.role === role}
                  className="chip"
                  disabled={m.role !== role && usedRoles.has(role)}
                  onClick={() => update(i, { role })}
                >
                  {role}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="roster-actions">
        {members.length < 5 ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setMembers([...members, { name: "", role: roles.find((r) => !usedRoles.has(r)) ?? roles[4]! }])
            }
          >
            Add a fifth player
          </button>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setMembers(members.slice(0, 4))}>
            Play with four
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={signOut}>
          Not your squad
        </button>
        <DemoSwitch />
        <button
          type="button"
          className="btn-primary big"
          disabled={!valid}
          onClick={() => confirmRoster(filled, matchday)}
        >
          Confirm the squad
        </button>
      </div>
    </div>
  );
}
