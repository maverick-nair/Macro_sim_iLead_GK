import { MediaRecorderSpeechProvider } from '../../../src/speech/mediaRecorder';
import { createMockTranscriptionClient } from '../../../src/speech/transcription';
import type { SpeechSession } from '../../../src/speech/types';

/**
 * Drives the real MediaRecorderSpeechProvider against Chromium's fake microphone, with the mock
 * transcription client standing in for the server. Results land on window.__speech for the spec.
 */
const transcription = createMockTranscriptionClient(['Hello team.', 'What is blocking you this week?'], { wordsPerChunk: 1 });
const provider = new MediaRecorderSpeechProvider({ transcription, chunkMs: 200 });
const result = {
  permission: provider.permission as string,
  levels: [] as number[],
  partials: [] as string[],
  finals: [] as string[],
  errors: [] as unknown[],
  speechStarts: 0,
  transcript: null as string | null,
  received: transcription.received
};
(window as unknown as { __speech: typeof result }).__speech = result;
const status = document.getElementById('status')!;
let session: SpeechSession | null = null;

document.getElementById('start')!.addEventListener('click', async () => {
  const p = await provider.requestPermission();
  result.permission = p.state;
  if (p.error) result.errors.push(p.error);
  session = provider.start({ mode: 'pushToTalk' });
  session.on('level', l => result.levels.push(l));
  session.on('partial', t => result.partials.push(t));
  session.on('final', t => result.finals.push(t));
  session.on('speechStart', () => result.speechStarts++);
  session.on('error', e => result.errors.push(e));
  status.textContent = 'listening';
});

document.getElementById('stop')!.addEventListener('click', async () => {
  result.transcript = (await session?.stop()) ?? null;
  status.textContent = 'done';
});
