import { useCallback, useState } from 'react';

/** A patch or an updater, like the argument of a class component's `setState`. Returning null skips the update. */
export type StatePatch<S> = Partial<S> | ((prev: S) => Partial<S> | null);

/**
 * Class component style state: one object, shallow merged updates, updater
 * functions that may return null. Lets the design's `this.setState(...)` calls
 * port one to one.
 */
export function useMergeState<S extends object>(init: () => S): [S, (patch: StatePatch<S>) => void] {
  const [state, setRaw] = useState<S>(init);
  const setState = useCallback((patch: StatePatch<S>) => {
    setRaw(prev => {
      const p = typeof patch === 'function' ? patch(prev) : patch;
      return p ? { ...prev, ...p } : prev;
    });
  }, []);
  return [state, setState];
}
