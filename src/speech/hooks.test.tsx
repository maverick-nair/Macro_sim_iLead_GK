import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useAiStream } from '../ai/useAiStream';
import { MockSpeechProvider } from './mock';
import { useSpeech } from './useSpeech';

/**
 * The hooks are thin bindings over createSpeechController and createAiStreamStore, which carry the
 * behavior tests. This checks the wiring renders in node with the expected initial state.
 */
describe('hooks', () => {
  it('useSpeech exposes the controller state and actions', () => {
    const provider = new MockSpeechProvider({ script: 'hello' });
    function Probe() {
      const s = useSpeech(provider, { consented: false, mode: 'openMic' });
      return <i>{[s.status, s.mode, String(s.consented), typeof s.start, typeof s.setTranscript, typeof s.accept].join('|')}</i>;
    }
    expect(renderToString(<Probe />)).toBe('<i>idle|openMic|false|function|function|function</i>');
  });

  it('useAiStream starts idle and labelled', () => {
    function Probe() {
      const s = useAiStream();
      return <i>{[s.label, String(s.streaming), JSON.stringify(s.text), typeof s.cancel].join('|')}</i>;
    }
    expect(renderToString(<Probe />)).toBe('<i>aiGenerated|false|&quot;&quot;|function</i>');
  });
});
