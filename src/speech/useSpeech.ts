import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createSpeechController, type SpeechController, type SpeechControllerOptions, type SpeechState } from './controller';
import type { SpeechProvider } from './types';

export type UseSpeechOptions = SpeechControllerOptions;

export type UseSpeech = SpeechState &
  Pick<SpeechController, 'start' | 'stop' | 'cancel' | 'setMode' | 'setTranscript' | 'accept' | 'clearError'>;

/**
 * Voice input for the live screens' input bar. State machine and rules live in
 * `createSpeechController`; this binds it to React.
 *
 * - Nothing touches the microphone until `consented` is true. Persisting consent is the caller's job.
 * - `onSpeechStart` fires when the participant starts talking, to interrupt the NPC.
 * - After stop the transcript is editable (`status === 'review'`, `setTranscript`, `accept`).
 * - The typed fallback is always the caller's to show; `error` says when to nudge towards it.
 */
export function useSpeech(provider: SpeechProvider, options: UseSpeechOptions): UseSpeech {
  const latest = useRef(options);
  latest.current = options;
  const controller = useMemo(
    () =>
      createSpeechController(provider, {
        ...latest.current,
        onSpeechStart: () => latest.current.onSpeechStart?.(),
        onSpeechEnd: () => latest.current.onSpeechEnd?.(),
        onTranscript: t => latest.current.onTranscript?.(t),
        onError: e => latest.current.onError?.(e)
      }),
    [provider]
  );
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => controller.setConsented(options.consented), [controller, options.consented]);
  useEffect(
    () => controller.setOptions({ review: options.review, openMicEndsTurn: options.openMicEndsTurn, levelHistory: options.levelHistory }),
    [controller, options.review, options.openMicEndsTurn, options.levelHistory]
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  return useMemo(
    () => ({
      ...state,
      start: controller.start,
      stop: controller.stop,
      cancel: controller.cancel,
      setMode: controller.setMode,
      setTranscript: controller.setTranscript,
      accept: controller.accept,
      clearError: controller.clearError
    }),
    [state, controller]
  );
}
