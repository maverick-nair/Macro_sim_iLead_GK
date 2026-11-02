import type { OptionId } from "../../shared/content-schema.ts";
import { useGame } from "../store/game.ts";

const MAX_ACTIONS = 5;

/** Game plan board: four headings, action rows with owner and due date, the client message, three plays. */
export function GamePlan() {
  const round = useGame((s) => s.currentRound())!;
  const live = useGame((s) => s.season!.live!);
  const roster = useGame((s) => s.season!.roster);
  const updatePlan = useGame((s) => s.updatePlan);
  const dispatch = useGame((s) => s.dispatch);
  const plan = live.plan;
  const owners = Array.from(new Set(roster.map((m) => m.role)));

  const setHeading = (i: number, text: string) =>
    updatePlan({ ...plan, headings: plan.headings.map((h, j) => (j === i ? text : h)) });
  const setAction = (i: number, patch: Partial<(typeof plan.actions)[number]>) =>
    updatePlan({ ...plan, actions: plan.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const addAction = () =>
    updatePlan({
      ...plan,
      actions: [...plan.actions, { action: "", owner: owners[0] ?? "", due: round.dueOptions[0] ?? "" }],
    });
  const removeAction = (i: number) =>
    updatePlan({ ...plan, actions: plan.actions.filter((_, j) => j !== i) });
  const choose = (id: OptionId) => updatePlan({ ...plan, decision: id });

  return (
    <div className="gameplan">
      <section className="board" aria-label="Plan board">
        <div className="headings">
          {round.planHeadings.map((h, i) => (
            <label key={h} className="heading-box">
              <span className="heading-label">{h}</span>
              <textarea
                value={plan.headings[i] ?? ""}
                onChange={(e) => setHeading(i, e.target.value)}
                rows={3}
              />
            </label>
          ))}
        </div>
        <div className="actions">
          <div className="actions-head">
            <h2 className="display h4">Actions the client will hold you to</h2>
            <button
              type="button"
              className="btn-ghost small"
              onClick={addAction}
              disabled={plan.actions.length >= MAX_ACTIONS}
            >
              Add an action
            </button>
          </div>
          <ul className="action-rows">
            {plan.actions.length === 0 && (
              <li className="muted small empty-row">
                No actions yet. Every action needs an owner and a date.
              </li>
            )}
            {plan.actions.map((a, i) => (
              <li key={i} className="action-row">
                <input
                  aria-label={`Action ${i + 1}`}
                  value={a.action}
                  placeholder="What will happen"
                  onChange={(e) => setAction(i, { action: e.target.value })}
                />
                <div
                  className="chips tight owner-chips"
                  role="radiogroup"
                  aria-label={`Action ${i + 1} owner`}
                >
                  {owners.map((o) => (
                    <button
                      type="button"
                      key={o}
                      role="radio"
                      aria-checked={a.owner === o}
                      className="chip small"
                      onClick={() => setAction(i, { owner: o })}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                <div className="chips tight due-chips" role="radiogroup" aria-label={`Action ${i + 1} due`}>
                  {round.dueOptions.map((d) => (
                    <button
                      type="button"
                      key={d}
                      role="radio"
                      aria-checked={a.due === d}
                      className="chip small"
                      onClick={() => setAction(i, { due: d })}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove action ${i + 1}`}
                  onClick={() => removeAction(i)}
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        </div>
        <label className="client-message">
          <span className="heading-label">Message to the client</span>
          <textarea
            value={plan.clientMessage}
            onChange={(e) => updatePlan({ ...plan, clientMessage: e.target.value })}
            rows={2}
          />
        </label>
      </section>

      <section className="plays" aria-label="Call the play">
        <h2 className="display h3">Call the play</h2>
        <div className="play-cards" role="radiogroup" aria-label="Plays">
          {round.options.map((o) => (
            <button
              type="button"
              key={o.id}
              role="radio"
              aria-checked={plan.decision === o.id}
              className={`play-card${plan.decision === o.id ? " chosen" : ""}`}
              onClick={() => choose(o.id)}
            >
              <span className="play-id display">{o.id}</span>
              <span className="play-label">{o.label}</span>
              <span className="play-text">{o.text}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary big lock"
          disabled={!plan.decision}
          onClick={() => dispatch({ type: "LOCK_PLAY", now: Date.now() })}
        >
          Lock the play
        </button>
        <p className="muted small">
          {plan.decision
            ? "Points stay hidden until full time."
            : "No play is picked for you. Time out locks whatever is on the board."}
        </p>
      </section>
    </div>
  );
}
