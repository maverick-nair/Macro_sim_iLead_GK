import type { LiveVariant } from '../../data/types';

/**
 * Scripted content for the live interaction shell, ported verbatim from
 * `project/ilLive.dc.html` (`scripts()` and the `briefs` / `titles` / `subs`
 * tables in `renderVals()`). A real conversation backend replaces `scriptsFor`.
 */
export interface NpcLine {
  /** Member id, or `'sponsor'` for Priya. */
  id: string;
  t: string;
}

export interface LiveScript {
  npc: NpcLine[];
  user: string[];
}

export function scriptsFor(variant: LiveVariant | undefined, who: string | undefined): LiveScript {
  if (variant === 'meeting')
    return {
      npc: [
        { id: 'green', t: 'Ashcroft is close, but procurement wants twelve percent off.' },
        { id: 'jack', t: "We shouldn't cut price. Let me call their CFO directly." },
        { id: 'ruth', t: 'Thanks. If we hold price, I can rework the proposal to show the payback period.' }
      ],
      user: ["Thanks, Green. Before we decide, I'd like to hear from everyone.", 'Ruth, you had your hand up. Go ahead.']
    };
  if (variant === 'sponsor')
    return {
      npc: [
        { id: 'sponsor', t: 'Thanks for joining. Walk me through where the pipeline stands.' },
        { id: 'sponsor', t: 'Demos look thin. What is your plan for the next two weeks?' },
        { id: 'sponsor', t: 'Good. I will back holding the price if Jack leads Ashcroft.' }
      ],
      user: [
        'We are behind pace, mostly at the demo stage. Ashcroft is our best chance this week.',
        'Green will coach Lowe on shorter demos, and I am moving Kent back onto the older accounts.'
      ]
    };
  if (who && who !== 'kent')
    return {
      npc: [
        { id: who, t: 'Hi. You wanted to talk?' },
        { id: who, t: 'Honestly, it has been a tough week. I could use some clarity on priorities.' },
        { id: who, t: 'Thanks. That really helps.' }
      ],
      user: ['Yes, I wanted to check in on how things are going for you.', "Let's agree your top two priorities for Friday, and I'll clear the rest."]
    };
  return {
    npc: [
      { id: 'kent', t: "Hi. Thanks for finally making time. I wasn't sure you got my message." },
      { id: 'kent', t: "Since the territory split, my best leads go to Beth. I've been doing this six years and nobody asked me." },
      { id: 'kent', t: 'Okay. That would actually help. I can bring Beth up to speed on the old accounts.' }
    ],
    user: [
      "I'm sorry I missed it yesterday. I want to hear what's on your mind, take your time.",
      "That's fair, and I should have asked. Let's look at lead routing together, and I'd value your help getting Beth up to speed."
    ]
  };
}

export interface Brief {
  goal: string;
  rows: Array<{ k: string; v: string }>;
  hint: string;
}

export const briefs: Record<LiveVariant, Brief> = {
  roleplay: {
    goal: 'Find out what is bothering Kent and rebuild his trust.',
    rows: [
      { k: 'What you know', v: 'Six years on the team. Lost his best leads in the territory split. You missed his chat request yesterday.' },
      { k: 'Current mood', v: 'Frustrated' },
      { k: 'Open promises', v: 'None yet' },
      { k: 'Your style for him', v: 'Directing. You set the task and check in closely.' }
    ],
    hint: 'Acknowledge the missed message first. People share more once they feel heard.'
  },
  meeting: {
    goal: 'Decide on the Ashcroft discount with the team, and hear the quieter voices.',
    rows: [
      { k: 'Agenda', v: '1. Ashcroft discount  2. Demo length  3. Friday review' },
      { k: 'Watch for', v: 'Ruth rarely speaks up in meetings.' },
      { k: 'Team mood', v: 'Mostly upbeat, two struggling' }
    ],
    hint: 'Invite people by name. A raised hand left waiting costs trust.'
  },
  sponsor: {
    goal: 'Give Priya an honest view of the pipeline and a plan she can back.',
    rows: [
      { k: 'She cares about', v: 'Demo conversion and the Ashcroft deal.' },
      { k: 'Confidence', v: 'Steady, 3 of 5' }
    ],
    hint: 'Lead with the number, then the plan. Priya values directness.'
  },
  email: {
    goal: 'Follow up with Kent in writing so the change sticks.',
    rows: [
      { k: 'Context', v: 'Your 1:1 went well. Kent agreed to help Beth.' },
      { k: 'Tone', v: 'Warm and specific. Name a time.' }
    ],
    hint: 'Put the agreement in writing, with a date.'
  }
};

export const subs: Record<LiveVariant, string> = {
  roleplay: 'Meet face to face · ½ day',
  meeting: 'Agenda: the Ashcroft discount · 1 day',
  sponsor: 'Q and A · about 6 minutes',
  email: 'No days used'
};

export const moodColors = ['oklch(0.78 0.13 25)', 'oklch(0.84 0.14 78)', '#00F2AD'];
export const moodWords = ['frustrated', 'guarded', 'more open'];

export const notePlaceholders = ['Where the pipeline stands', 'What is blocking demos', 'What you need from Priya'];

export const initialSubject = 'Lead routing, and thank you';
export const initialBody =
  "Hi Kent,\n\nThanks for being honest with me today. You're right that we changed the territory split without asking you, and I'm sorry.\n\nCan we sit down Thursday at 10 to look at routing together? I'd also like your help getting Beth up to speed on the older accounts.\n\n";
