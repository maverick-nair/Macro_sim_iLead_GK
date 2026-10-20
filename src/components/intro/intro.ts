import type { EngineView } from '../../engine/contract';

/**
 * The pre-game flow's content (D219), read from the engine view only: the sponsor's message (captions and
 * chapters), the product portfolio and the objectives. Pure, so it is unit tested; the screens word the rest
 * from the catalog with the storyline's numbers.
 *
 * The storyline's look and world (brand, logo, product portfolio, intro screen titles) arrive in the view's
 * `storyline` once the storyline contract carries them (D181 to D185, workstream 1). Until then they are read
 * as optional fields and each part of the flow that needs them is left out, never filled with sample data.
 */

/** A named feature of a model (D221): a tab with its panel, and a numbered spot on the photo. */
export interface IntroFeature {
  title: string;
  text: string;
  /** Where its spot sits on the photo, percent from the inline start and the top; null places it evenly. */
  spot: { x: number; y: number } | null;
}

export interface IntroProduct {
  name: string;
  /** The model's short code: the storyline's, else the last word of its name ("Levo H4" is H4). */
  code: string;
  /** Its kind ("Commercial"), when the storyline names one. */
  kind: string | null;
  /** Its tagline, else its one line. */
  line: string | null;
  /** Who it is for, when the storyline says. */
  audience: string | null;
  /**
   * Up to four features; the tabs and the photo's numbered spots show the same ones. The storyline's named
   * features, else its first four specs (each its own title and text, as before D221).
   */
  features: IntroFeature[];
  /** The specs for the strip under it: all of them with named features, else those after the first four. */
  specs: string[];
  /** A typical deal, in the storyline's money. */
  dealValue: number | null;
  image: string | null;
  /** The photo's description for screen readers, when the storyline has one. */
  imageAlt: string | null;
}

/** The look the storyline contract adds to `view.storyline` (D181 to D185), each part optional here. */
interface StorylineLook {
  logo?: { image: string | null; text: string | null } | null;
  products?: Array<{
    name: string; line: string | null; specs: string[]; image: string | null;
    code?: string | null; kind?: string | null; tagline?: string | null; audience?: string | null; dealValue?: number | null; imageAlt?: string | null;
    features?: Array<{ title: string; text: string; spot: { x: number; y: number } | null }>;
  }>;
  screens?: Array<{ key: string; title: string; body: string[] }>;
}
const lookOf = (view: Pick<EngineView, 'storyline'>): StorylineLook => view.storyline as EngineView['storyline'] & StorylineLook;

/** The products of the storyline's portfolio, or none: the flow then goes from the message to the objectives. */
export function introProducts(view: Pick<EngineView, 'storyline'>): IntroProduct[] {
  return (lookOf(view).products ?? []).map(p => {
    const words = p.name.trim().split(/\s+/);
    const named = (p.features ?? []).slice(0, 4);
    return {
      name: p.name, code: p.code ?? words[words.length - 1] ?? p.name, kind: p.kind ?? null, line: p.tagline ?? p.line, audience: p.audience ?? null,
      features: named.length ? named : p.specs.slice(0, 4).map(x => ({ title: x, text: x, spot: null })),
      specs: named.length ? p.specs : p.specs.slice(4),
      dealValue: p.dealValue ?? null, image: p.image, imageAlt: p.imageAlt ?? null
    };
  });
}

/** The company logo from the storyline, when it has one. */
export function introLogo(view: Pick<EngineView, 'storyline'>): { image: string | null; text: string | null } | null {
  return lookOf(view).logo ?? null;
}

/** An authored intro screen's first paragraph by its key, when the storyline has one. */
export function introScreen(view: Pick<EngineView, 'storyline'>, key: string): string | null {
  return lookOf(view).screens?.find(s => s.key === key)?.body[0] ?? null;
}

export interface MessageChapter { key: 'challenge' | 'expect' | 'goal'; summary: string; start: number }
export interface IntroMessage {
  /** One caption per line, in order. */
  captions: string[];
  /** Three chapters, each starting at a caption. */
  chapters: MessageChapter[];
  video: { src: string; poster: string | null; track: string | null } | null;
}

/**
 * The sponsor's video message: the storyline's video and its transcript when it has one (three chapters over
 * the transcript, as evenly as it divides), else the welcome letter read as the message (the welcome, what the
 * team does, the targets). `letter` is the storyline's authored letter or the one worded from its facts.
 */
export function introMessage(view: Pick<EngineView, 'storyline'>, letter: { welcome: string[]; product: string[]; targets: string[] }): IntroMessage {
  const v = view.storyline.video;
  const transcript = v?.transcript.filter(Boolean) ?? [];
  let captions: string[];
  let starts: number[];
  if (transcript.length) {
    captions = transcript;
    const n = captions.length;
    starts = [0, Math.min(n - 1, Math.round(n / 3)), Math.min(n - 1, Math.round((2 * n) / 3))];
  } else {
    captions = [...letter.welcome, ...letter.product, ...letter.targets];
    starts = [0, letter.welcome.length, letter.welcome.length + letter.product.length];
  }
  const keys = ['challenge', 'expect', 'goal'] as const;
  return {
    captions,
    chapters: keys.map((key, i) => ({ key, start: starts[i], summary: captions[starts[i]] ?? '' })),
    video: v?.src ? { src: v.src, poster: v.poster ?? null, track: v.captions ?? null } : null
  };
}

/** The chapter a caption belongs to. */
export const chapterAt = (chapters: MessageChapter[], caption: number) => chapters.reduce((at, c, i) => (caption >= c.start ? i : at), 0);
