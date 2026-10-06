import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { micHintFor, micStatusFor } from './LiveInputBar';
import { initialsOf, shortNameOf } from './types';

describe('reply bar state line', () => {
  const base = { mic: 'idle' as const, mode: 'voice' as const, conversation: 'yourTurn' as const };
  it('follows the design order: mic first, then the conversation, then the input preference', () => {
    expect(micStatusFor({ ...base, mic: 'denied', conversation: 'npcSpeaking' })).toBe('denied');
    expect(micStatusFor({ ...base, mic: 'listening', conversation: 'npcSpeaking' })).toBe('listening');
    expect(micStatusFor({ ...base, mic: 'review' })).toBe('review');
    expect(micStatusFor({ ...base, mic: 'review', partial: true })).toBe('partial');
    expect(micStatusFor({ ...base, conversation: 'npcSpeaking' })).toBe('speaking');
    expect(micStatusFor({ ...base, conversation: 'npcThinking' })).toBe('thinking');
    expect(micStatusFor({ ...base, conversation: 'closed' })).toBe('done');
    expect(micStatusFor(base)).toBe('readyPtt');
    expect(micStatusFor({ ...base, voiceInput: 'open' })).toBe('readyOpen');
    expect(micStatusFor({ ...base, mode: 'text' })).toBe('readyText');
  });
  it('hints push to talk by default, text when typing or blocked', () => {
    expect(micHintFor(base)).toBe('ptt');
    expect(micHintFor({ ...base, voiceInput: 'open' })).toBe('open');
    expect(micHintFor({ ...base, mode: 'text' })).toBe('text');
    expect(micHintFor({ ...base, mic: 'denied' })).toBe('denied');
  });
});

describe('live shell copy', () => {
  const { t } = createI18n();
  it('titles and subtitles every format', () => {
    expect(t('liveshell.title', { format: 'roleplay', name: 'Kent Goldberg' })).toBe('1:1 with Kent Goldberg');
    expect(t('liveshell.title', { format: 'meeting', name: '' })).toBe('Team meeting');
    expect(t('liveshell.subtitle', { format: 'sponsor', cost: '', topic: '', minutes: 6 })).toBe('Q and A · about 6 minutes');
    expect(t('liveshell.subtitle', { format: 'email', cost: 'No days', topic: '', minutes: 0 })).toBe('No days used');
  });
  it('words the brief style row and lists who is reacting', () => {
    expect(t('liveshell.brief.styleValue', { name: 'Directing', short: 'You set the task and check in closely.' })).toBe('Directing. You set the task and check in closely.');
    expect(t('liveshell.brief.styleNone')).toBe('Not set yet');
    expect(t('liveshell.reacting.lead', { count: 3, rest: 'Kent, Beth', last: 'Jack' })).toBe('Kent, Beth and Jack are taking in what you said.');
    expect(t('liveshell.reacting.lead', { count: 1, rest: '', last: 'Kent' })).toBe('Kent is taking in what you said.');
  });
});

describe('names', () => {
  it('shortens and abbreviates', () => {
    expect(shortNameOf({ name: 'Kent Goldberg' })).toBe('Kent');
    expect(shortNameOf({ name: 'Kent Goldberg', shortName: 'KG' })).toBe('KG');
    expect(initialsOf('Priya Nair')).toBe('PN');
    expect(initialsOf('  Mary Ann de Silva ')).toBe('MA');
  });
});
