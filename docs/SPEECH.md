# Speech input and streamed AI text

Two infrastructure modules for the live interaction screens. Neither renders UI; the screens use the hooks.

- `src/speech/`: voice input. A `SpeechProvider` interface, the real `MediaRecorderSpeechProvider`, a `MockSpeechProvider`, server transcription clients, the `useSpeech` hook and descriptive analytics.
- `src/ai/`: streamed AI text. `readSse`, `mockStream` and the `useAiStream` hook.

Sources: Participant Interface Spec ("Live interaction screens", "Voice controls"), Simulation Design ("Interaction formats and input options"), and the brief's architecture rules.

## Rules this code enforces

| Rule | Where |
|---|---|
| Score the words, not the voice. Only transcripts leave the speech layer as content. | Providers emit text and a loudness level only. The transcription endpoint contract forbids scoring anything but the transcript. |
| No facial or voice emotion inference. | Nothing computes pitch, pace, tone or emotion. The level is loudness for the waveform; the VAD uses loudness only. |
| Consent before any audio capture. | `useSpeech` / `createSpeechController` refuse `start()` until `consented` is true and never call the provider before. Withdrawing consent cancels capture at once. Storing consent is the caller's job. |
| Transcript editable before sending. | After stop the state is `review`; `setTranscript` edits, `accept` sends. `review: false` is available for formats that send turns directly (the spec requires review for email, chat and plan). |
| Typed fallback always available. | Every failure sets `error` (with `recoverable`) and keeps what was heard in `review`, so the screen can show the fallback banner and keep the conversation intact. |
| MediaRecorder behind a SpeechProvider. | Screens depend on `SpeechProvider` only. |
| AI streaming is cancellable and labelled. | `useAiStream().cancel()`, `label: 'aiGenerated'` on every state. |
| Copy rules on AI text. | `useAiStream` passes the accumulated text through `sanitizeCopy`. |

## SpeechProvider

```ts
interface SpeechProvider {
  readonly permission: 'unknown' | 'granted' | 'denied' | 'unsupported';
  requestPermission(): Promise<{ state; error? }>;
  start({ mode: 'pushToTalk' | 'openMic', signal? }): SpeechSession;
}
interface SpeechSession {
  on(type, listener): () => void;   // level, partial, final, speechStart, speechEnd, error, end
  stop(): Promise<string>;          // push to talk release; resolves with the full transcript
  cancel(): void;
}
```

Events (never emitted synchronously from `start`, so listeners attached right after the call see everything):

| Event | Payload | Use |
|---|---|---|
| `level` | 0..1, about 20 Hz | Waveform only. Not stored, not an analytic. |
| `partial` | interim text of the current segment | Live transcript. Replaces the previous partial. |
| `final` | a committed segment | Appended to the transcript; the partial resets. |
| `speechStart` / `speechEnd` | `{ at }` | Open mic turn detection; `speechStart` interrupts the NPC. In push to talk they fire on press and release. |
| `error` | `{ code: 'denied' \| 'noDevice' \| 'network' \| 'unsupported' \| 'aborted', recoverable }` | Fallback banner. Followed by `end`. |
| `end` | `{ transcript, cancelled }` | Always the last event. |

### MediaRecorderSpeechProvider

`new MediaRecorderSpeechProvider({ transcription, vad?, chunkMs?, levelIntervalMs?, mimeTypes?, language?, clock?, deps? })`

- `getUserMedia` with echo cancellation, noise suppression and auto gain (echo cancellation keeps the NPC's voice from triggering an interrupt).
- `MediaRecorder` with the first supported of `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/webm`, `audio/mp4`; if none is supported the browser picks. One chunk every `chunkMs` (250ms) goes to the `TranscriptionClient`.
- An `AudioContext` `AnalyserNode` sampled every `levelIntervalMs` (50ms). RMS is mapped to a decibel scale (−60 dBFS is 0, 0 dBFS is 1).
- Open mic: an energy VAD (`createVad`) with hysteresis. Defaults: start at level 0.45, end below 0.35, 150ms to confirm speech, 800ms hang time. All configurable through `vad`.
- It never transcribes locally.
- Error mapping: `NotAllowedError` and `SecurityError` are `denied` (not recoverable). `NotFoundError`, `NotReadableError` and an unplugged track are `noDevice` (recoverable). A missing API is `unsupported`. A transcription failure is `network`. An aborted signal is `aborted`.
- `checkPermission()` reads the Permissions API without prompting, where the browser supports the `microphone` name.
- `deps` injects `mediaDevices`, `permissions`, `MediaRecorder` and `AudioContext`, which is how the unit tests run in node.

### Transcription endpoint contract

`createHttpTranscriptionClient(baseUrl, { fetch?, headers? })` uses chunked POSTs. A single streaming request body (`fetch` with `duplex: 'half'`) is Chromium only and needs HTTP/2, so it is not used.

| Request | Body | Response |
|---|---|---|
| `POST {base}/transcriptions` | JSON `{ mimeType, mode, language? }` | `201 { id }` |
| `POST {base}/transcriptions/{id}/chunks?seq={n}` | raw audio bytes, `Content-Type` is the mimeType | `200 { results }` |
| `POST {base}/transcriptions/{id}/end` | none | `200 { results }` with every remaining final |
| `DELETE {base}/transcriptions/{id}` | none | `204`. Cancel: discard audio and text. |

- `results` is `Array<{ kind: 'partial' | 'final', text }>` in order. A partial replaces the previous partial; a final commits a segment.
- `seq` starts at 0 and has no gaps. Chunk 0 carries the container header, so the server appends by `seq`. A repeated `seq` must be ignored, so retries are safe.
- The client sends requests one at a time in order. Any failed request or malformed response becomes one `network` error (recoverable), and the session ends.
- The server must not keep audio after transcription, must score only the transcript, and must not run emotion inference.

`createMockTranscriptionClient(script, { wordsPerChunk?, failAfterChunks? })` reveals the script word by word as chunks arrive and commits the rest on `finish()`. Its `received` counters (streams, chunks, bytes, mime types) are for assertions.

### MockSpeechProvider

`new MockSpeechProvider({ script, clock?, permission?, grants?, fail?, onEarlyStop?, hangMs?, levelIntervalMs? })`

- No microphone. Each `start()` plays the next scripted utterance (`{ text, delayMs?, wordsPerMinute? }` or a string): one `partial` per word, a `final` at each sentence end, synthetic levels (loud while speaking, near zero otherwise), and in open mic `speechStart` and `speechEnd` after `hangMs` of silence.
- Push to talk: `speechStart` on press. On release, `onEarlyStop: 'all'` (default) commits the whole utterance for friendly demos; `'heard'` commits only the words spoken so far.
- Simulates denied (`grants: 'denied'` or `permission: 'denied'`), unsupported, and mid turn failures (`fail: { code, recoverable, afterMs }`).
- With `createManualClock()` from `src/lib/clock.ts` every event lands at a fixed time, so tests, Storybook and the mock engine are deterministic. `clock.advance(ms)` moves time.

## useSpeech

```ts
const s = useSpeech(provider, { consented, mode?, review?, openMicEndsTurn?, onSpeechStart?, onSpeechEnd?, onTranscript?, onError? });
s.status   // 'idle' | 'requesting' | 'listening' | 'finishing' | 'review' | 'denied' | 'unsupported'
s.level, s.levels, s.partial, s.transcript, s.edited, s.speaking, s.error, s.mode
s.start()  // 'started' | 'consentRequired' | 'busy' | 'denied' | 'unsupported' | 'error'
s.stop(); s.cancel(); s.setMode(m); s.setTranscript(t); s.accept(); s.clearError();
```

- `idle -> requesting -> listening -> finishing -> review -> idle`. `requesting` is the permission prompt; `finishing` is the wait for the last final after release. With nothing heard, stop returns to `idle`.
- Open mic ends the turn on `speechEnd` unless `openMicEndsTurn: false`.
- `setMode` applies at once when idle or in review; while listening it applies to the next turn.
- The logic lives in `createSpeechController` (no React), which the unit tests drive directly.

## Descriptive analytics (coaching data, never scores)

- `talkListenRatio(turns)`: participant talk vs everyone else, by duration when every turn has one, otherwise by word count. Returns `{ talk, listen, talkShare, ratio, basis }`.
- `questionCounts(text)`: open questions (what, how, why, who, where, when, which, tell me, describe, "could you walk me through") vs closed ones (is, do, can, did, would, or a statement ending in "?"). Questions that lost their "?" in transcription count when the lead is clear ("do you have a minute"); statements such as "What I mean is" do not.

Limits: English heuristics only; they miscount some phrasings. These numbers may be shown as coaching data. They must never feed a skill rating, an outcome or the engine's judgement, and must never be presented as a grade. They use transcripts and timing only.

## AI text streaming (`src/ai/`)

- `readSse(response, signal?, { onMalformed? })`: an async generator of `StreamChunk` (the Zod schema in `src/engine/contract.ts`). Handles split network chunks (including split UTF 8 characters and CRLF), multi line `data:`, comments and other fields. Malformed events are skipped and reported. It ends after `done` or `error`; a body that ends without either yields `{ type: 'error', retryable: true }`; HTTP failures become an error chunk (retryable on 408, 429 and 5xx). Aborting the signal cancels the body and ends quietly.
- `mockStream(text, { signal?, tokensPerSecond?, clock?, turnId?, failAfterTokens? })`: word tokens at a steady rate, then `done`. Abortable and deterministic on a manual clock.
- `useAiStream()`: `{ text, streaming, done, turnId, error, cancelled, shown, label, start, cancel, reset }`. `start(source)` takes an `AsyncIterable<StreamChunk>` or `signal => AsyncIterable` (preferred, so cancel stops the source). `text` is `sanitizeCopy` of the accumulated tokens. `cancel()` returns `{ text, rawLength, turnId }`: what was on screen and how many raw characters had arrived, so the engine can truncate an interrupted NPC turn. `label` is always `'aiGenerated'`. The logic is `createAiStreamStore`.

## Tests

- Unit (Vitest, node): `src/speech/*.test.ts`, `src/ai/*.test.ts`, `src/lib/clock.ts` via those. Browser APIs are faked.
- E2E smoke: `tests/e2e/speech.spec.ts` runs the real provider in Chromium with `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream` on a test only page (`tests/e2e/fixtures/speech.html`, served by the Vite dev server, not part of the build). It checks permission, levels from the AnalyserNode, webm chunks from MediaRecorder and the transcript from the mock transcription client.
