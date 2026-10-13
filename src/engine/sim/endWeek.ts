/**
 * End week as a driver presses it (D231): the synthetic players, the scripted policies, the strategies and a
 * preview's Jump to. End week shows a decision still to come this week before the week ends; the driver then decides
 * it (`choose` gives an option key) or, as a player with nothing more to say about it, lets its default stand, and
 * presses End week again, until the week ends.
 */

/** What ending a week reads of the view. */
export interface EndWeekView {
  phase: 'style' | 'board' | 'periodEnd' | 'ended';
  endingWeek?: boolean;
  openChoices?: Array<{ id: string; eventKey: string; holdsWeekEnd?: boolean }>;
}
/** The intents ending a week sends. */
export type EndWeekIntent = { type: 'endPeriod' } | { type: 'decide'; choiceId: string; option: string } | { type: 'keepDefault'; choiceId: string };

export interface EndWeekDriver<V extends EndWeekView> {
  view(): V | Promise<V>;
  dispatch(intent: EndWeekIntent): Promise<unknown>;
}

/**
 * Presses End week until the week has ended. `choose` is asked about each decision that holds the week end: an
 * option key decides it; null lets its default stand (recorded as the player's own, `kept`). Returns the view after.
 */
export async function endWeek<V extends EndWeekView>(d: EndWeekDriver<V>, choose: (choice: { id: string; eventKey: string }, view: V) => string | null | Promise<string | null> = () => null): Promise<V> {
  await d.dispatch({ type: 'endPeriod' });
  let v = await d.view();
  for (let guard = 0; guard < 50 && v.phase === 'board' && v.endingWeek; guard++) {
    for (const c of (v.openChoices ?? []).filter(x => x.holdsWeekEnd)) {
      const option = await choose(c, v);
      await d.dispatch(option ? { type: 'decide', choiceId: c.id, option } : { type: 'keepDefault', choiceId: c.id });
    }
    await d.dispatch({ type: 'endPeriod' });
    v = await d.view();
  }
  return v;
}
