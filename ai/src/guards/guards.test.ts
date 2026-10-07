import { describe, expect, it } from 'vitest';
import { checkReply, overlap, ReplyFilter, splitSignals } from './npc';
import { findVerbatim, verifyQuotes } from './quotes';

const SAID = 'Thanks for making time, Kent.  How are you finding the role so far?\nI hear you. It’s been a rough month.';

describe('verbatim quotes', () => {
  it('accepts exact quotes and returns the exact slice of what was said', () => {
    expect(findVerbatim(SAID, 'How are you finding the role so far?')).toBe('How are you finding the role so far?');
    expect(findVerbatim(SAID, '"I hear you."')).toBe('I hear you.');
  });

  it('forgives whitespace, line breaks, curly quotes and a trailing full stop, nothing else', () => {
    expect(findVerbatim(SAID, 'Kent. How are you')).toBe('Kent.  How are you');
    expect(findVerbatim(SAID, 'so far? I hear you')).toBe('so far?\nI hear you');
    expect(findVerbatim(SAID, "It's been a rough month")).toBe('It’s been a rough month');
    expect(findVerbatim(SAID, 'I hear you')).toBe('I hear you');
  });

  it('rejects paraphrase, changed case, ellipsis, other words and tiny fragments', () => {
    expect(findVerbatim(SAID, 'How are you finding your role so far?')).toBeNull();
    expect(findVerbatim(SAID, 'how are you finding the role so far?')).toBeNull();
    expect(findVerbatim(SAID, 'Thanks for making time ... rough month')).toBeNull();
    expect(findVerbatim(SAID, 'You are doing great')).toBeNull();
    expect(findVerbatim(SAID, 'I')).toBeNull();
  });

  it('keeps the verified quotes once each and lists the dropped ones', () => {
    expect(verifyQuotes(SAID, ['I hear you.', 'I hear you', 'Made up words'])).toEqual({ kept: ['I hear you.', 'I hear you'], dropped: ['Made up words'] });
  });
});

const KENT = { hiddenConcern: 'He expected a lot more from this job, and feels it is not what he was promised.', concernLine: 'Honestly? This job is not what I was promised. I expected a lot more when I joined.', shareBlocked: false };

describe('NPC reply checks', () => {
  it('flags out of role, scoring talk and leaks of hidden state', () => {
    expect(checkReply('As an AI, I cannot share that.', KENT)).toEqual(['outOfRole']);
    expect(checkReply('Let us step out of this role play.', KENT)).toEqual(['outOfRole']);
    expect(checkReply('My trust level is pretty low right now.', KENT)).toEqual(['scoring']);
    expect(checkReply('The rubric says you should ask questions.', KENT)).toEqual(['scoring']);
    expect(checkReply('He expected a lot more from this job and feels it is not what he was promised.', KENT)).toEqual(['leak']);
    expect(checkReply('This job is not what I was promised. I expected a lot more when I joined.', { ...KENT, shareBlocked: true })).toEqual(['leak']);
  });

  it('lets ordinary work talk through, including the concern in his own words when trust allows', () => {
    expect(checkReply('We scored a big win with Hanson last week, honestly.', KENT)).toEqual([]);
    expect(checkReply('This job is not what I was promised. I expected a lot more when I joined.', KENT)).toEqual([]);
    expect(checkReply('Sorry, I am not sure that is why we are meeting.', KENT)).toEqual([]);
  });

  it('measures overlap on content words', () => {
    expect(overlap('the job is not what I was promised', KENT.hiddenConcern)).toBeGreaterThan(0.3);
    expect(overlap('nice weather today', KENT.hiddenConcern)).toBe(0);
  });

  it('reads the signal tag and never shows it', () => {
    expect(splitSignals('Fine. [[signals reveal=yes end=no]]')).toEqual({ text: 'Fine.', signals: { reveal: true, end: false }, tagged: true });
    expect(splitSignals('Fine.')).toEqual({ text: 'Fine.', signals: { reveal: false, end: false }, tagged: false });
  });
});

describe('the reply filter', () => {
  const feed = (f: ReplyFilter, chunks: string[]) => chunks.flatMap(c => f.push(c));

  it('releases whole sentences, sanitized, and holds the signal tag even when it is split across chunks', () => {
    const f = new ReplyFilter(KENT, 'sentence');
    const shown = feed(f, ['Hi. It has been a long', ' week—honestly. [', '[sig', 'nals reveal=no end=yes]]']);
    const fin = f.finish();
    expect([...shown, ...fin.out].join('')).toBe('Hi. It has been a long week, honestly.');
    expect(fin.signals).toEqual({ reveal: false, end: true });
    expect(f.text).toBe('Hi. It has been a long week, honestly.');
  });

  it('stops at the first sentence that breaks a guardrail and shows nothing after it', () => {
    const f = new ReplyFilter(KENT, 'sentence');
    const shown = feed(f, ['Sure, happy to talk. ', 'As an AI model I have rules. ', 'Anyway, the pipeline is slow.']);
    f.finish();
    expect(shown).toEqual(['Sure, happy to talk.']);
    expect(f.blocked).toBe(true);
    expect(f.guards).toEqual(['outOfRole']);
  });

  it('in none mode releases text as it comes and still checks the whole reply at the end', () => {
    const f = new ReplyFilter(KENT, 'none');
    const shown = feed(f, ['Sure', ', happy to talk.', ' [[signals reveal=no end=no]]']);
    expect(shown.join('')).toBe('Sure, happy to talk.');
    expect(f.finish().signals.end).toBe(false);
    const g = new ReplyFilter(KENT, 'none');
    feed(g, ['I am just a char', 'acter in a simulation.']);
    g.finish();
    expect(g.guards).toContain('outOfRole');
  });
});
