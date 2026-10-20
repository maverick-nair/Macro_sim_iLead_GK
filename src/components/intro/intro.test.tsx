import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EngineView } from '../../engine/contract';
import { I18nProvider } from '../../i18n';
import { captionAt, captionStart, chapterAt, introLogo, introMessage, introProducts, introScreen } from './intro';
import { Products } from './Products';

const LETTER = { welcome: ['Welcome.', 'The team is new.'], product: ['Five stages.'], targets: ['Reach the target.', 'Keep them healthy.'] };
const view = (storyline: Record<string, unknown>) => ({ storyline: { name: 'S', organisation: null, locale: 'en', video: null, ...storyline } }) as unknown as Pick<EngineView, 'storyline'>;
const PRODUCTS = [
  { name: 'Levo B10', line: 'Commercial', specs: ['Quiet ride', 'Small footprint', 'Who buys it', 'Winning the deal', '450 kg', '0.6 m/s'], image: '/p/b10.png' },
  { name: 'Levo H4', line: null, specs: ['Homes'], image: null }
];

describe('the pre-game flow (D219)', () => {
  it('reads the letter as the message when the storyline has no video: chapters at the welcome, the team and the targets', () => {
    const m = introMessage(view({}), LETTER);
    expect(m.video).toBeNull();
    expect(m.captions).toEqual(['Welcome.', 'The team is new.', 'Five stages.', 'Reach the target.', 'Keep them healthy.']);
    expect(m.chapters.map(c => [c.key, c.start, c.summary])).toEqual([['challenge', 0, 'Welcome.'], ['expect', 2, 'Five stages.'], ['goal', 3, 'Reach the target.']]);
    expect([0, 1, 2, 3, 4].map(i => chapterAt(m.chapters, i))).toEqual([0, 0, 1, 2, 2]);
  });

  it('plays the storyline\'s video with its transcript as the captions, in three chapters', () => {
    const m = introMessage(view({ video: { src: '/v.webm', captions: '/v.vtt', transcript: ['A', 'B', 'C', 'D', 'E', 'F'] } }), LETTER);
    expect(m.video).toEqual({ src: '/v.webm', poster: null, track: '/v.vtt' });
    expect(m.chapters.map(c => c.start)).toEqual([0, 2, 4]);
  });

  it('times the captions by the captions file when it has a cue per line, else shares the length evenly (D237)', () => {
    const starts = [0, 5, 13, 21];
    expect([0, 4.9, 5, 12, 13, 20.9, 21, 60].map(at => captionAt(at, 4, 75, starts))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    // A file whose cues do not match the lines one to one falls back to even shares.
    expect([0, 18.7, 18.75, 74].map(at => captionAt(at, 4, 75, [0, 9]))).toEqual([0, 0, 1, 3]);
    expect([0, 10, 74].map(at => captionAt(at, 4, 75, null))).toEqual([0, 0, 3]);
    expect(captionAt(5, 0, 75, null)).toBe(0);
    expect([0, 2, 3].map(i => captionStart(i, 4, 75, starts))).toEqual([0, 13, 21]);
    expect(captionStart(2, 4, 75, null)).toBe(37.5);
  });

  it('takes the portfolio, logo and screens from the storyline contract when it has them, and none otherwise', () => {
    expect(introProducts(view({}))).toEqual([]);
    expect(introLogo(view({}))).toBeNull();
    expect(introScreen(view({}), 'landing')).toBeNull();
    const v = view({ products: PRODUCTS, logo: { image: null, text: 'I8' }, screens: [{ key: 'landing', title: 'T', body: ['About the run.'] }] });
    expect(introProducts(v)[0]).toEqual({
      name: 'Levo B10', code: 'B10', kind: null, line: 'Commercial', audience: null,
      features: ['Quiet ride', 'Small footprint', 'Who buys it', 'Winning the deal'].map(x => ({ title: x, text: x, spot: null })),
      specs: ['450 kg', '0.6 m/s'], dealValue: null, image: '/p/b10.png', imageAlt: null
    });
    expect(introLogo(v)).toEqual({ image: null, text: 'I8' });
    expect(introScreen(v, 'landing')).toBe('About the run.');
  });

  it('shows a model with its points as a tab list and the same points as numbered spots, and the explored count', () => {
    const html = renderToStaticMarkup(<I18nProvider><Products products={introProducts(view({ products: PRODUCTS }))} organisation="Innov8" onNext={() => undefined} /></I18nProvider>);
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html).toContain('aria-selected="true"');
    expect(html).toMatch(/role="tabpanel"[\s\S]*?>Quiet ride</);
    expect(html.match(/aria-label="Point \d: /g)).toHaveLength(4);
    expect(html).toContain('aria-label="Explored 1 of 2 models"');
    expect(html).toContain('Next: Levo H4');
    expect(html).toContain('450 kg');
    expect(html).toContain('alt="Levo B10"');
  });

  it('shows the storyline\'s named features where it places them, its kind, tagline, audience and typical deal (D221)', () => {
    const named = [{
      ...PRODUCTS[0], code: 'X10', kind: 'Commercial', tagline: 'Built to move.', audience: 'Mid-rise offices.', dealValue: 30000, imageAlt: 'A steel lift car',
      features: [{ title: 'Built modular', text: 'Installs in nine days.', spot: { x: 40, y: 50 } }, { title: 'Made to last', text: 'A 25 year warranty.', spot: null }]
    }];
    const [p] = introProducts(view({ products: named }));
    expect(p).toMatchObject({ code: 'X10', kind: 'Commercial', line: 'Built to move.', specs: PRODUCTS[0].specs, dealValue: 30000 });
    const html = renderToStaticMarkup(<I18nProvider><Products products={[p]} organisation={null} onNext={() => undefined} /></I18nProvider>);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toMatch(/role="tabpanel"[\s\S]*?>Installs in nine days\.</);
    expect(html).toContain('aria-label="Point 1: Built modular"');
    expect(html).toContain('inset-inline-start:40%;inset-block-start:50%');
    expect(html).toContain('Commercial / 01');
    expect(html).toContain('Built to move.');
    expect(html).toContain('Mid-rise offices.');
    expect(html).toContain('Typical deal');
    expect(html).toContain('alt="A steel lift car"');
  });
});
