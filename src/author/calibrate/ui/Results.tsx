import { checkSummary, NAMES } from '../logic/aggregate';
import type { CalibrationResults, Check } from '../logic/schema';
import { BUTTON, CARD, Mark, PERSONA_COLOR, pct, StatusIcon } from './parts';

/** Results, one row per level (Calibrate.dc.html): the score range and average, tier, revenue and skills rated. */
export function ResultsTable({ results, onWatch, canWatch }: { results: CalibrationResults; onWatch(): void; canWatch: boolean }) {
  const runs = results.personas.reduce((n, p) => n + p.runs, 0);
  const ordered = results.checks.find(c => c.key === 'ordered');
  const max = results.scoreMax || 1;
  const share = (n: number) => Math.max(0, Math.min(100, (n / max) * 100));
  const at = (n: number) => `${share(n)}%`;
  return (
    <section aria-labelledby="cal-results" className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="cal-results" className="m-0 text-15 font-700">Results, {runs} {runs === 1 ? 'playthrough' : 'playthroughs'}</h3>
        {ordered && <Mark tone={ordered.status === 'pass' ? 'good' : 'bad'}>{ordered.status === 'pass' ? 'Scores rise with proficiency' : 'Scores do not rise with proficiency'}</Mark>}
      </div>
      <table className="w-full border-collapse text-13">
        <caption className="sr-only">Leadership Score, tier, revenue and skills rated for each level, target tier {results.targetTier.name}</caption>
        <thead>
          <tr className="text-left text-11 font-800 tracking-wide text-fg-secondary uppercase">
            <th scope="col" className="w-28 py-1 pr-2 font-800">Player</th>
            <th scope="col" className="py-1 pr-2 font-800">Leadership Score, range and average</th>
            <th scope="col" className="w-28 py-1 pr-2 font-800">Average</th>
            <th scope="col" className="w-24 py-1 pr-2 font-800">Revenue</th>
            <th scope="col" className="w-28 py-1 font-800">Skills rated</th>
          </tr>
        </thead>
        <tbody>
          {results.personas.map(p => (
            <tr key={p.persona} className="border-t border-solid border-line-default">
              <th scope="row" className="py-2 pr-2 text-left font-700">{NAMES[p.persona]}</th>
              <td className="py-2 pr-2">
                <div aria-hidden="true" className="relative h-4.5 rounded-pill bg-track">
                  <span className="absolute top-1 h-2.5 rounded-pill opacity-40" style={{ left: at(p.score.min), width: `${share(p.score.max) - share(p.score.min)}%`, minWidth: 4, background: PERSONA_COLOR[p.persona] }} />
                  <span className="absolute top-0 h-4.5 w-1 rounded-2" style={{ left: at(p.score.mean), transform: 'translateX(-50%)', background: PERSONA_COLOR[p.persona] }} />
                  <span className="absolute top-0 h-4.5 w-px bg-line-strong" style={{ left: at(results.targetTier.min) }} />
                </div>
                <span className="sr-only">From {Math.round(p.score.min)} to {Math.round(p.score.max)}</span>
              </td>
              <td className="py-2 pr-2 tabular-nums"><b>{Math.round(p.score.mean)}</b> · {p.tier.name}</td>
              <td className="py-2 pr-2 tabular-nums">{pct(p.share.mean)} target</td>
              <td className="py-2">{p.level.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 text-12 text-fg-secondary">The thin line marks where {results.targetTier.name} starts ({results.targetTier.min} points).</p>
      <div>
        <button type="button" className={BUTTON.secondary} onClick={onWatch} disabled={!canWatch}>Watch a playthrough</button>
        {!canWatch && <span className="ml-3 text-12 text-fg-secondary">Run the test again to watch playthroughs.</span>}
      </div>
    </section>
  );
}

/** The checks (Calibrate.dc.html), each with what to change when it needs a look. */
export function ChecksList({ results, onAsk }: { results: CalibrationResults; onAsk?(check: Check): void }) {
  return (
    <section aria-labelledby="cal-checks" className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="cal-checks" className="m-0 text-15 font-700">Checks</h3>
        <span className="text-12 text-fg-secondary">{checkSummary(results.checks)}</span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {results.checks.map(c => (
          <li key={c.key} className="flex flex-col gap-1 border-b border-solid border-line-default py-2 last:border-b-0">
            <div className="flex items-start gap-2.5 text-14">
              <StatusIcon status={c.status} />
              <span className="flex-1 pt-0.5">{c.title}</span>
              {onAsk && c.status !== 'pass' && <button type="button" className={BUTTON.small} onClick={() => onAsk(c)} aria-label={`Ask Kora about: ${c.title}`}>Ask Kora</button>}
            </div>
            {(c.detail || c.fix) && (
              <details className="ml-8.5 text-13 text-fg-secondary">
                <summary className="cursor-pointer text-13 font-600 text-fg-primary">{c.status === 'pass' ? 'Details' : 'What to change'}</summary>
                {c.detail && <p className="mt-1 mb-0">{c.detail}</p>}
                {c.fix && <p className="mt-1 mb-0">{c.fix}</p>}
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
