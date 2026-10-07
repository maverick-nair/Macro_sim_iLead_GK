import type { QuestionId } from '../api/author';
import { MediaRecorderSpeechProvider } from '../speech/mediaRecorder';
import { MockSpeechProvider } from '../speech/mock';
import { createHttpTranscriptionClient } from '../speech/transcription';
import type { SpeechProvider } from '../speech/types';

/**
 * Voice answers in the co-creator chat (D106). The client adapter is the participant app's: the browser's
 * MediaRecorder captures the author's voice and streams chunks to the speech server's transcription
 * endpoints, where `createTranscriber` from `ai/` turns them into text (docs/SPEECH.md, docs/AI.md 7).
 * Only text comes back and no audio is kept. With no speech server (`VITE_GENIE_SPEECH_URL`, else
 * `VITE_ILEAD_SPEECH_URL`), an offline mock "says" a plausible answer to the question asked, so the
 * flow can be tried and tested anywhere.
 */

/** What the offline mock says for each question: a stand in for the author's own words. */
export const MOCK_ANSWERS: Record<QuestionId, string> = {
  role_level: 'First time sales managers, about two years into the role.',
  industry: 'Commercial elevators. B2B, long sales cycles.',
  challenge: 'Deals stall at negotiation and new reps burn out in the first quarter.',
  client: 'Ascent Lifts',
  team_size: 'Ten. Eight account managers, a pre sales engineer and a sales coordinator who keeps the pipeline clean.',
  process: 'Leads, Qualify, Proposal, Negotiation, Close',
  duration: 'Standard, about an hour.',
  language: 'English, India.',
  framework: 'No, we do not have our own framework. They mostly lead the way they were led.',
  tone: 'Professional, with real pressure in it.'
};

export function speechUrl(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_GENIE_SPEECH_URL || env.VITE_ILEAD_SPEECH_URL || undefined;
}

/** The microphone and the server's transcriber when configured; otherwise the offline mock. */
export function createAuthorSpeech(question: QuestionId | null, url = speechUrl()): SpeechProvider {
  if (url) return new MediaRecorderSpeechProvider({ transcription: createHttpTranscriptionClient(url) });
  return new MockSpeechProvider({ script: { text: MOCK_ANSWERS[question ?? 'role_level'], wordsPerMinute: 190, delayMs: 200 }, onEarlyStop: 'all' });
}
