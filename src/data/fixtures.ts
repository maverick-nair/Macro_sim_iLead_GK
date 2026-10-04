import type { MetricKey } from './types';

/**
 * Design fixture copy for the `/screens` and `/states` galleries (D34): the storyline specific text the
 * prototype shows on onboarding and on the resume recap. The playable app takes these from the
 * engine and the storyline instead. Ported verbatim from `project/ilOnboarding.dc.html` and iLeadApp.
 */
export const ONBOARDING_FIXTURE = {
  organisation: 'Northwind Software',
  /** Who sees the report, as the consent step words it. */
  reportOrganisation: 'Northwind',
  languages: [
    { id: 'en', name: 'English', note: 'Voice and captions' },
    { id: 'es', name: 'Español', note: 'Voz y subtítulos' },
    { id: 'id', name: 'Bahasa Indonesia', note: 'Suara dan teks' }
  ],
  letter: {
    welcome: [
      'Welcome to Northwind. I am glad you are here.',
      'You are taking over a team of ten across our sales funnel, from first call to signed deal. Some are thriving, some are new, and one or two are struggling.',
      'I care about two things: the number, and whether the team is stronger when you leave than when you arrived.'
    ],
    product: [
      'Northwind sells workflow software to mid size companies. A typical deal is about $8,000 and takes four to six weeks to close.',
      'Deals move through five stages: lead generation, qualification, solution demo, proposal and closing.'
    ],
    targets: [
      'Reach $240,000 in revenue over eight weeks.',
      'Keep Team Morale and Trust healthy. A burned out team will not hold the number next quarter.',
      'You have five days of your own time each week. Spend them well.'
    ]
  },
  /** The design marks where the sponsor's avatar video goes; the gallery keeps the annotation. */
  video: { caption: 'Welcome to Northwind. I am glad you are here.', label: 'Sponsor avatar video from GenieKreator config' },
  sampleName: 'Kent',
  periods: { unit: 'week', count: 8 },
  capacity: 5,
  /** Profiles read in frame o6. */
  read: ['kent', 'beth', 'green'],
  open: 'kent'
} as const;

/** The resume recap in frame x3: the last three outcomes and who is waiting. */
export const RESUME_FIXTURE: { recent: Array<{ img: string; title: string; metric: MetricKey; delta: number }>; waiting: string[] } = {
  recent: [
    { img: '/assets/npc/beth.png', title: '1:1 with Beth went well', metric: 'morale', delta: 6 },
    { img: '/assets/npc/lowe.png', title: 'Feedback to Lowe felt public', metric: 'trust', delta: -3 },
    { img: '/assets/npc/green.png', title: 'Ashcroft moved to proposal', metric: 'result', delta: 4 }
  ],
  waiting: ['Kent', 'Priya']
};

/**
 * The week end in frames w1 to w5 (port of `project/ilWeekEnd.dc.html`): week 2 of 8, the design's
 * sample report, the Listener badge, three rewards and two news bulletins. The funnel comes from the
 * scenario's stages. The playable app takes all of this from the engine's period summary instead.
 */
export const WEEKEND_FIXTURE = {
  period: 2,
  periods: 8,
  headline: 'Kent is back in the game.',
  line: 'You made time for the people who needed it. Revenue is still behind pace, so next week is about demos.',
  stars: 2,
  /** Funnel bars run against this length, as in the design (42 of 45 fills most of the track). */
  funnelScale: 45,
  bottleneck: 'close',
  kpis: [
    { metric: 'skill', start: 56, end: 57 },
    { metric: 'morale', start: 54, end: 58 },
    { metric: 'result', start: 58, end: 60 },
    { metric: 'trust', start: 53, end: 57 }
  ] as Array<{ metric: MetricKey; start: number; end: number }>,
  starRows: [
    { kind: 'people', earned: true, detail: 'Lifted team morale by 4 points' },
    { kind: 'leadership', earned: true, detail: 'Matched your style to 7 of 10 people' },
    { kind: 'business', earned: false, detail: 'Hit week 2 revenue pace. You were $18,800 short.' }
  ] as Array<{ kind: 'people' | 'leadership' | 'business'; earned: boolean; detail: string }>,
  streak: { count: 3, unit: 'day', note: 'Replied to every message on time. 2 more days for a bonus.' } as const,
  sponsor: { from: 'steady', to: 'confident' } as const,
  pulse: { upbeat: 6, steady: 3, struggling: 1, lastStruggling: 3 },
  badge: { key: 'listener', rule: 'listener', name: 'Listener', reason: 'You asked three open questions in your 1:1 with Kent before offering a fix.' },
  sponsorFirstName: 'Priya',
  rewards: [
    { key: 'half_day', name: 'An extra half day', description: 'Five and a half days of your time in week 3.' },
    { key: 'quiet_word', name: 'A quiet word', description: 'Learn one thing a team member has not told you yet.' },
    { key: 'team_lunch', name: 'Team lunch budget', description: 'Energize the team once in week 3 at no day cost.' }
  ],
  news: [
    { key: 'price_cut', card: 'impact', title: 'A competitor cut prices by 10%', body: 'Two of your open deals mention it. Expect tougher proposal conversations.', impact: 'Proposal and Closing stages will convert a little slower unless the team sells value.' },
    { key: 'ashcroft', card: 'opportunity', title: 'Ashcroft signed at list price', body: 'Jack and Green held the line. Priya sent a note to the whole team.', impact: 'Revenue +$8,400. Morale lifts for Jack and Green.' }
  ] as Array<{ key: string; card: 'impact' | 'opportunity'; title: string; body: string; impact: string }>,
  /** The design marks where GenieKreator's news illustration goes; the gallery keeps the annotation. */
  newsArtLabel: 'Illustration from GenieKreator config'
};
