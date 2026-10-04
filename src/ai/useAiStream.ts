import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createAiStreamStore, type AiStreamState, type AiStreamStore } from './store';

export type UseAiStream = AiStreamState & Pick<AiStreamStore, 'start' | 'cancel' | 'reset'>;

/**
 * One streamed AI reply (NPC turn, coaching hint). `text` is already sanitized for the copy rules;
 * `label` is always 'aiGenerated' so the UI shows the AI label. `cancel()` aborts the stream and
 * returns what was shown, for the engine to truncate an interrupted NPC turn. Unmounting cancels.
 */
export function useAiStream(): UseAiStream {
  const [store] = useState(createAiStreamStore);
  useEffect(() => () => void store.cancel(), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return useMemo(() => ({ ...state, start: store.start, cancel: store.cancel, reset: store.reset }), [state, store]);
}
