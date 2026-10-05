import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n';
import { CohortPanel } from './CohortPanel';
import type { CohortRow } from './cohort';

const row = (rank: number, name: string | null, you = false): CohortRow => ({ rank, name, you, score: 900 - rank * 20, tier: 'Gold' });
const html = (outside: CohortRow | null, top = [row(1, 'Aisha Rahman'), row(2, 'Ben Okafor', false), row(3, 'Chen Wei')]) =>
  renderToStaticMarkup(<I18nProvider><CohortPanel scope="cohort" size={3} top={top} outside={outside} you={{ rank: outside?.rank ?? 2, total: 15 }} /></I18nProvider>);

describe('the cohort panel', () => {
  it('is a real table with column and row headers', () => {
    const m = html(null);
    expect(m.match(/<th scope="col"/g)).toHaveLength(4);
    expect(m.match(/<th scope="row"/g)).toHaveLength(3);
    expect(m).toContain('<caption class="sr-only">Your cohort by Leadership Score, top 3. Your row is marked You.</caption>');
    expect(m).toMatch(/<h2 id="[^"]+"[^>]*>Your cohort<\/h2>/);
    expect(m).toContain('Rank 2 of 15');
  });

  it('marks this participant’s row in text, not only colour', () => {
    const m = html(null, [row(1, 'Aisha Rahman'), row(2, 'Priya Sharma', true), row(3, 'Chen Wei')]);
    expect(m.match(/aria-current="true"/g)).toHaveLength(1);
    expect(m).toMatch(/Priya Sharma<\/span><span[^>]*>You<\/span>/);
  });

  it('adds this participant’s own row after the top when outside it', () => {
    const m = html(row(14, null, true));
    expect(m.match(/<tbody/g)).toHaveLength(2);
    expect(m).toContain('Rank 14 of 15');
    expect(m).toContain('top 3, then your own place.');
    expect(m).toMatch(/<tbody[^>]*>(?:(?!<\/tbody>).)*>14<(?:(?!<\/tbody>).)*>You</);
  });
});
