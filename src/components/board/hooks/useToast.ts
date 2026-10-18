import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_MS = 3400;

/** The board's toast: one line at a time, gone after a moment. `say` keeps its identity, so handlers can depend on it. */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, say };
}
