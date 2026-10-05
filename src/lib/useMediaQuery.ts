import { useEffect, useState } from 'react';

/** Below 1280 wide the team board needs the Actions panel's room (D58): the panel can fold to a rail. */
export const NARROW_BOARD = '(max-width: 1279px)';

/** True while the media query matches. False where there is no `matchMedia` (tests in node). */
export function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(() => !!globalThis.matchMedia?.(query).matches);
  useEffect(() => {
    if (!globalThis.matchMedia) return;
    const mq = matchMedia(query);
    const change = () => setOn(mq.matches);
    change();
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, [query]);
  return on;
}
