/** Voice input for live interactions. See docs/SPEECH.md. */
export type { PermissionResult, PermissionState, SpeechError, SpeechErrorCode, SpeechEventName, SpeechEvents, SpeechMode, SpeechProvider, SpeechSession, StartOptions } from './types';
export { MediaRecorderSpeechProvider, PREFERRED_MIME_TYPES, mediaError, type MediaDeps, type MediaRecorderProviderOptions } from './mediaRecorder';
export { MockSpeechProvider, syntheticLevel, type MockSpeechOptions, type MockUtterance } from './mock';
export {
  createHttpTranscriptionClient,
  createMockTranscriptionClient,
  type HttpTranscriptionOptions,
  type MockTranscriptionClient,
  type MockTranscriptionOptions,
  type TranscriptionCallbacks,
  type TranscriptionClient,
  type TranscriptionOpenOptions,
  type TranscriptionStream
} from './transcription';
export { createVad, levelFromRms, VAD_DEFAULTS, type Vad, type VadEvent, type VadOptions } from './vad';
export { createSpeechController, type SpeechController, type SpeechControllerOptions, type SpeechState, type SpeechStatus, type StartResult } from './controller';
export { useSpeech, type UseSpeech, type UseSpeechOptions } from './useSpeech';
export { classifyQuestion, questionCounts, talkListenRatio, type QuestionCounts, type QuestionKind, type TalkListen, type Turn } from './analytics';
export { createSpeech } from './default';
