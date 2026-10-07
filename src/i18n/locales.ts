import { addLocale, appLocale, isPseudo, mirrorRegistered, PSEUDO, registerMessages } from './core';

/**
 * Catalogs that load on demand (D83). The first load carries the English interface copy only: another
 * language's catalog loads before the first render when the launch asks for it (`?locale=es`), and the
 * engine's copy (`engine.json`, the words for the codes the engine sends) loads beside the first view,
 * since nothing can be worded before a payload arrives.
 */
type Catalog = { default: Record<string, string> };
const UI: Record<string, () => Promise<Catalog>> = {
  es: () => import('./messages/es')
};
const ENGINE: Record<string, () => Promise<Catalog>> = {
  en: () => import('./messages/en/engine.json'),
  es: () => import('./messages/es/engine.json')
};

/** Languages with a catalog of their own, besides English. */
export const LANGUAGES = ['en', ...Object.keys(UI)];

const lang = (tag: string) => tag.split('-')[0];

/** Loads the launch locale's interface catalog (or builds a pseudo locale). English needs nothing. */
export async function loadLocale(tag = appLocale()): Promise<void> {
  if (isPseudo(tag)) {
    const { pseudoCatalog } = await import('./pseudo');
    const { en } = await import('./messages/en');
    addLocale(tag, pseudoCatalog(en, tag), { dir: PSEUDO[tag].dir, format: 'en' });
    // Screens that register their copy later (and the engine's copy) are pseudo too.
    mirrorRegistered(tag, m => pseudoCatalog(m, tag));
    return;
  }
  const load = UI[lang(tag)];
  if (load) addLocale(lang(tag), (await load()).default);
}

let engine: Promise<void> | null = null;
let engineFor = '';
/** Loads the engine's copy for the launch locale (English is always loaded: any missing key falls back to it). */
export function loadEngineCopy(tag = appLocale()): Promise<void> {
  if (engine && engineFor === tag) return engine;
  engineFor = tag;
  engine = (async () => {
    const en = (await ENGINE.en()).default;
    // A pseudo locale derives its engine copy from this (`mirrorRegistered`).
    registerMessages(en);
    if (!isPseudo(tag) && ENGINE[lang(tag)] && lang(tag) !== 'en') {
      registerMessages((await ENGINE[lang(tag)]()).default, lang(tag));
    }
  })().catch(e => { engine = null; throw e; });
  return engine;
}
