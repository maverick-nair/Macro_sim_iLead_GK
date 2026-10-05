import { MediaRecorderSpeechProvider } from './mediaRecorder';
import { MockSpeechProvider } from './mock';
import { createHttpTranscriptionClient } from './transcription';
import type { SpeechProvider } from './types';

/**
 * What the mock voice "says" per format when no transcription server is configured. Stand in
 * participant speech for demos, not interface copy: it goes to the engine like typed words.
 */
const MOCK_LINES: Record<string, string> = {
  sponsor: 'We are behind on conversions, and I own that. The plan is to coach the bottleneck this week. I need support on lead quality.',
  meeting: 'Today we have three things. First the pipeline, then the new CRM. What do you all think?',
  interview: 'Tell me about a time you turned around a difficult client. What happened next?',
  reflection: 'Asking first changed how people answered me. With my real team I will check in before I decide.',
  default: 'Thanks for making time. How are things going for you this week? Let us agree one next step by Friday.'
};

/**
 * Real capture with server transcription when `VITE_ILEAD_SPEECH_URL` is set; otherwise the scripted
 * mock voice. `mockScript` replaces what the mock says (the onboarding mic test says its test phrase).
 */
export function createSpeech(format: string, options: { mockScript?: string } = {}): SpeechProvider {
  const url = import.meta.env.VITE_ILEAD_SPEECH_URL as string | undefined;
  if (url) return new MediaRecorderSpeechProvider({ transcription: createHttpTranscriptionClient(url) });
  return new MockSpeechProvider({ script: options.mockScript ?? MOCK_LINES[format] ?? MOCK_LINES.default });
}
