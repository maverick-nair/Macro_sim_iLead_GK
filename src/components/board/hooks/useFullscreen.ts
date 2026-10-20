import { useEffect, useState } from 'react';
import type { I18n } from '../../../i18n';

/** The window's fullscreen state, whether the browser allows it, and the menu's toggle. */
export function useFullscreen({ say, t }: { say: (msg: string) => void; t: I18n['t'] }) {
  const [fullscreen, setFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const toggle = () => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => say(t('board.fullscreen.failed'))); };
  return { fullscreen, canFullscreen, toggle };
}
