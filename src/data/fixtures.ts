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
