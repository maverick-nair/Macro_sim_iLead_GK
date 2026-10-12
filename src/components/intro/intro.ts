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

export interface IntroProduct {
  name: string;
  /** The model's short code, the last word of its name ("Levo H4" is H4). */
  code: string;
  line: string | null;
  /** Up to four points about the model; the feature tabs and the image's numbered spots show the same ones. */
  points: string[];
  /** The rest of its specs, for the strip under it. */
  specs: string[];
  image: string | null;
}

/** The look the storyline contract adds to `view.storyline` (D181 to D185), each part optional here. */
interface StorylineLook {
  logo?: { image: string | null; text: string | null } | null;
  products?: Array<{ name: string; line: string | null; specs: string[]; image: string | null }>;
  screens?: Array<{ key: string; title: string; body: string[] }>;
}
const lookOf = (view: Pick<EngineView, 'storyline'>): StorylineLook => view.storyline as EngineView['storyline'] & StorylineLook;

/** The products of the storyline's portfolio, or none: the flow then goes from the message to the objectives. */
export function introProducts(view: Pick<EngineView, 'storyline'>): IntroProduct[] {
  return (lookOf(view).products ?? []).map(p => {
    const words = p.name.trim().split(/\s+/);
    return { name: p.name, code: words[words.length - 1] ?? p.name, line: p.line, points: p.specs.slice(0, 4), specs: p.specs.slice(4), image: p.image };
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
