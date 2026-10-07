import { useEffect, useId, useState } from 'react';
import { NAMES } from '../logic/aggregate';
import { BAND_NAME } from '../logic/explain';
import type { CalibrationResults, PersonaKey, Playthrough } from '../logic/schema';
import { BUTTON, CARD, INPUT, Mark, money, pct } from './parts';

type Conversation = Playthrough['conversations'][number];

/**
 * One synthetic playthrough (CalibrateRun.dc.html): week by week, then each conversation with the
 * evaluator's rating and why. "Compare with the Expert run" opens the Expert's playthrough on the same seed,
 * at the same week and person.
 */
export function PlaythroughView({ results, load, persona, index, onPick, onBack }: {
  results: CalibrationResults;
  load(persona: PersonaKey, index: number): Promise<Playthrough>;
  persona: PersonaKey;
  index: number;
  onPick(persona: PersonaKey, index: number): void;
  onBack(): void;
}) {
  const [loaded, setLoaded] = useState<{ key: string; p: Playthrough | null; error: string | null } | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const ids = useId();
  const stats = results.personas.find(x => x.persona === persona);
  const runs = stats?.runs ?? 0;
  const focusKey = `${persona}:${index}`;
  const [focus, setFocus] = useState<{ key: string; period: number; names: string[] } | null>(null);

  useEffect(() => {
    let live = true;
    const key = `${persona}:${index}`;
    load(persona, index).then(x => { if (live) setLoaded({ key, p: x, error: null }); }, () => { if (live) setLoaded({ key, p: null, error: 'This playthrough could not be loaded.' }); });
    return () => { live = false; };
  }, [load, persona, index]);
  const p = loaded?.key === focusKey ? loaded.p : null;
  const error = loaded?.key === focusKey ? loaded.error : null;

  const pickFocus = (pt: Playthrough) => {
    if (focus?.key !== focusKey) return pt.conversations.find(c => c.format !== 'email') ?? pt.conversations[0] ?? null;
    return pt.conversations.find(c => c.period === focus.period && c.names.join() === focus.names.join())
      ?? pt.conversations.find(c => c.period === focus.period) ?? pt.conversations[0] ?? null;
  };
  const current: Conversation | null = p ? p.conversations.find(c => c.id === chosen) ?? pickFocus(p) : null;
  const surfaced = (id: string | undefined) => (id ? results.concernsByPerson.expert?.[id] ?? 0 : 0);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Player" className="inline-flex flex-wrap gap-1 rounded-12 bg-track p-1">
          {results.personas.filter(x => x.runs > 0).map(x => (
            <button key={x.persona} type="button" aria-pressed={x.persona === persona} onClick={() => { setChosen(null); onPick(x.persona, Math.min(index, x.runs - 1)); }}
              className={`min-h-9 cursor-pointer rounded-8 border-0 px-3 text-13 font-600 ${x.persona === persona ? 'bg-surface-solid text-fg-primary shadow-sm' : 'bg-transparent text-fg-secondary'} focus-visible:outline-2 focus-visible:outline-accent-secondary`}>
              {NAMES[x.persona]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-13" htmlFor={`${ids}-run`}>Run
          <select id={`${ids}-run`} className={`${INPUT} h-9`} value={index} onChange={e => { setChosen(null); onPick(persona, Number(e.target.value)); }}>
            {Array.from({ length: runs }, (_, i) => <option key={i} value={i}>{i + 1} of {runs}</option>)}
          </select>
        </label>
        {p && <span className="text-13 text-fg-secondary">Leadership Score {Math.round(p.score)} · {p.tier} · {pct(p.share)} of target · styles fit {Math.round(p.adaptability)}%</span>}
        <span className="flex-1" />
        <button type="button" className={BUTTON.secondary} onClick={onBack}>Back to results</button>
      </div>
      {error && <p role="alert" className="m-0 text-14">{error}</p>}
      {!p && !error && <p role="status" className="m-0 text-14 text-fg-secondary">Loading the playthrough</p>}
      {p && (
        <div className="grid min-w-0 grid-cols-2 gap-3 tablet:grid-cols-1">
          <section aria-labelledby={`${ids}-weeks`} className={CARD}>
            <h3 id={`${ids}-weeks`} className="m-0 text-15 font-700">Week by week</h3>
            <table className="w-full border-collapse text-13">
              <caption className="sr-only">Styles set, actions, events and revenue each week</caption>
              <thead>
                <tr className="text-left text-11 font-800 tracking-wide text-fg-secondary uppercase">
                  <th scope="col" className="w-16 py-1 pr-2 font-800">Week</th>
                  <th scope="col" className="w-20 py-1 pr-2 font-800">Styles fit</th>
                  <th scope="col" className="py-1 pr-2 font-800">Actions and events</th>
                  <th scope="col" className="w-20 py-1 font-800">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {p.weeks.map(w => (
                  <tr key={w.period} className="border-t border-solid border-line-default align-top">
                    <th scope="row" className="py-2 pr-2 text-left font-700">Week {w.period}</th>
                    <td className="py-2 pr-2 tabular-nums">{w.styleFit ? `${w.styleFit.correct} of ${w.styleFit.total}` : 'None'}</td>
                    <td className="py-2 pr-2">
                      {w.actions.length ? w.actions.join(' · ') : 'No actions'}
                      {w.events.map((e, i) => <span key={i} className="block text-12 text-fg-secondary">{e.title}: {e.expected ? (e.handled ? 'answered' : 'not answered') : 'no answer needed'}</span>)}
                    </td>
                    <td className="py-2 tabular-nums">{money(w.revenue, results.money)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section aria-labelledby={`${ids}-talk`} className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`${ids}-talk`} className="m-0 text-15 font-700">{current ? `${current.title}, week ${current.period}` : 'Conversations'}</h3>
              {current?.band && <Mark tone={current.band === 'strong' ? 'good' : current.band === 'adequate' ? 'muted' : current.band === 'weak' ? 'look' : 'bad'}>Scored {BAND_NAME[current.band]}</Mark>}
            </div>
            {p.conversations.length ? (
              <label className="flex flex-col gap-1 text-13 font-600" htmlFor={`${ids}-pick`}>Conversation
                <select id={`${ids}-pick`} className={`${INPUT} h-9 font-400`} value={current?.id ?? ''} onChange={e => setChosen(e.target.value)}>
                  {p.conversations.map(c => <option key={c.id} value={c.id}>Week {c.period}: {c.title}{c.band ? `, ${BAND_NAME[c.band]}` : ''}</option>)}
                </select>
              </label>
            ) : <p className="m-0 text-14">This player had no conversations.</p>}
            {current && (
              <>
                <ol aria-label="Transcript" className="m-0 flex list-none flex-col gap-2 p-0 text-14 leading-normal">
                  {current.turns.map((t, i) => (
                    <li key={i} className={`max-w-[85%] rounded-12 px-3 py-2 ${t.by === 'player' ? 'self-end bg-accent-soft' : 'self-start bg-track'}`}>
                      <b>{t.by === 'player' ? 'Synthetic player' : t.name}:</b> {t.text}
                    </li>
                  ))}
                </ol>
                <p className="m-0 rounded-12 border border-solid border-line-default bg-surface-raised px-3 py-2 text-13 leading-normal">
                  {current.why}
                  {persona !== 'expert' && current.memberIds.length === 1 && surfaced(current.memberIds[0]) > 0 && (
                    <> Expert players surfaced {current.names[0].split(' ')[0]}'s concern in {surfaced(current.memberIds[0])} of {results.personas.find(x => x.persona === 'expert')?.runs ?? 0} runs.</>
                  )}
                </p>
                {persona !== 'expert' && results.personas.some(x => x.persona === 'expert' && x.runs > index) && (
                  <div>
                    <button type="button" className={BUTTON.secondary} onClick={() => { setChosen(null); setFocus({ key: `expert:${index}`, period: current.period, names: current.names }); onPick('expert', index); }}>Compare with the Expert run</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
