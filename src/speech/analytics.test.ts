import { describe, expect, it } from 'vitest';
import { classifyQuestion, questionCounts, talkListenRatio } from './analytics';

describe('talkListenRatio (coaching data)', () => {
  it('uses durations when every turn has one', () => {
    const r = talkListenRatio([
      { speaker: 'participant', durationMs: 30_000 },
      { speaker: 'kent', durationMs: 10_000 },
      { speaker: 'participant', durationMs: 10_000 },
      { speaker: 'kent', durationMs: 10_000 }
    ]);
    expect(r).toEqual({ talk: 40_000, listen: 20_000, talkShare: 40_000 / 60_000, ratio: 2, basis: 'time' });
  });

  it('falls back to word counts', () => {
    const r = talkListenRatio([
      { speaker: 'participant', text: 'How are you doing' },
      { speaker: 'kent', text: 'Fine thanks', durationMs: 900 }
    ]);
    expect(r).toMatchObject({ talk: 4, listen: 2, ratio: 2, basis: 'words' });
  });

  it('handles empty and one sided conversations', () => {
    expect(talkListenRatio([])).toMatchObject({ talkShare: 0, ratio: null });
    expect(talkListenRatio([{ speaker: 'participant', durationMs: 5 }])).toMatchObject({ talkShare: 1, ratio: null });
  });
});

describe('questionCounts (coaching data)', () => {
  it.each([
    ['What is getting in your way?', 'open'],
    ['How do you feel about the new role?', 'open'],
    ['So, why did the deal slip?', 'open'],
    ['Tell me about the client meeting.', 'open'],
    ['Could you walk me through your plan?', 'open'],
    ['Can you tell me what happened?', 'open'],
    ['Did you call the client?', 'closed'],
    ['Are you okay with that?', 'closed'],
    ["Isn't that the plan?", 'closed'],
    ['Can you send it by Friday?', 'closed'],
    ['You finished it?', 'closed'],
    ['I think we are on track.', null],
    ['What I mean is we need focus.', null],
    ['When I joined, I was lost too.', null],
    ['when is the review', 'open'],
    ['do you have a minute', 'closed']
  ] as const)('%s -> %s', (s, kind) => expect(classifyQuestion(s)).toBe(kind));

  it('counts questions in a transcript, including ones that lost their "?"', () => {
    const text =
      'Thanks for making time. What is on your mind this week? Did you get the leads I sent. ' +
      'Tell me how the demo went. What I mean is we need focus. Do you need anything from me. ' +
      'When I joined I was lost too. ok so how can I help';
    const r = questionCounts(text);
    expect(r.questions.map(q => [q.text, q.kind])).toEqual([
      ['What is on your mind this week?', 'open'],
      ['Did you get the leads I sent.', 'closed'],
      ['Tell me how the demo went.', 'open'],
      ['Do you need anything from me.', 'closed'],
      ['ok so how can I help', 'open']
    ]);
    expect(r).toMatchObject({ open: 3, closed: 2, total: 5 });
  });
});
