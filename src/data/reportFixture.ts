/**
 * The development report as the design draws it (frames e2, e3 and m7), ported from `project/ilReport.dc.html`:
 * Jordan Lee's run on the Northwind fixture. The playable app renders the report from the engine's
 * `view.report` instead (src/components/report/EngineReport.tsx).
 */
const REPORT_SERIES: Array<[key: string, label: string, values: number[], target: number, note: string]> = [
  ['revenue', 'Revenue, $k', [18, 41, 70, 101, 134, 166, 198, 226], 240, 'Cumulative, dashed line is target pace'],
  ['skill', 'Team skill', [57, 57, 60, 63, 65, 68, 70, 71], 0, 'Training and coaching from week 3'],
  ['morale', 'Team morale', [57, 58, 61, 60, 64, 66, 67, 68], 0, 'Dip in week 4 after the price war'],
  ['result', 'Team result', [59, 60, 63, 66, 69, 71, 73, 74], 0, 'Steady climb'],
  ['trust', 'Team trust', [56, 57, 60, 62, 65, 67, 69, 70], 0, 'Biggest gain after Kent']
];
const REPORT_PACE = [30, 60, 90, 120, 150, 180, 210, 240];
const REPORT_LEVELS = ['Emerging', 'Developing', 'Proficient', 'Strong'];

/** The design's week by week fit pattern: early misses that fade, with Kent and Lowe missed in weeks 1 and 2. */
function reportFit(mi: number, w: number, id: string): 0 | 1 | 2 {
  if ((id === 'kent' || id === 'lowe') && w < 2) return 2;
  const r = (mi * 7 + w * 13) % 10;
  if (w < 2) return r < 5 ? 2 : r < 8 ? 1 : 0;
  if (w < 4) return r < 2 ? 2 : r < 5 ? 1 : 0;
  return r < 1 ? 2 : r < 3 ? 1 : 0;
}

export const REPORT_FIXTURE = {
  name: 'Jordan Lee',
  line: 'Northwind Sales Leaders · October 2026 · 98 minutes of play',
  tier: 'Gold',
  score: '4,860',
  lede: 'You built a team that trusts you. Your strongest skill is diagnosing people early and changing course when you get it wrong. The next step is pace: you reached 94% of target, and most of the gap came from weeks 1 and 2, when you spent days on fixes before you understood the problem.',
  periods: 8,
  series: REPORT_SERIES.map(([key, label, values, target, note]) => {
    const money = (v: number) => `$${v}k`;
    const fmt = target ? money : String;
    return {
      key, label, note, values,
      end: fmt(values[7]),
      target: target ? REPORT_PACE : null,
      domain: (target ? [0, 245] : [Math.min(...values) - 2, Math.max(...values) + 2]) as [number, number],
      summary: `${label} from ${values[0]} to ${values[7]}`,
      cells: values.map(fmt),
      targetCells: target ? REPORT_PACE.map(money) : null
    };
  }),
  /** The design draws four levels; the engine sends the storyline's scale (five by default). */
  levels: REPORT_LEVELS,
  skills: ([
    ['Diagnosing people', 3, 'Since the territory split, my best leads go to Beth. What would make this feel fair to you?', 'Week 2, 1:1 with Kent'],
    ['Adapting your style', 2, 'Peter is new and unsure. Directing for now, then Guiding.', 'Week 3, style note'],
    ['Coaching conversations', 2, "Let's walk through your first three calls together tomorrow.", 'Week 2, 1:1 with Beth'],
    ['Giving feedback', 1, "Lowe, your demos are running long. Let's fix that before Friday.", 'Week 2, team meeting'],
    ['Business judgement', 2, 'We hold price on Ashcroft. Jack leads, Ruth shows the payback.', 'Week 3, sponsor briefing']
  ] as const).map(([name, index, text, when]) => ({ key: name, name, level: { index, name: REPORT_LEVELS[index] }, quote: { text, when } })),
  /** Style fit per member and week: the style chosen and how it fit. */
  fit: (members: Array<{ id: string }>) => members.map((m, mi) => [0, 1, 2, 3, 4, 5, 6, 7].map(w => ({
    style: 'DGPE'[(mi + Math.floor(w / 3)) % 4] as 'D' | 'G' | 'P' | 'E',
    fit: reportFit(mi, w, m.id)
  }))),
  fitSummary: 'You matched 61 of 80 choices. Most misses were early, with Kent and Lowe, and you corrected both by week 3.',
  intent: [
    { key: 'kent', said: 'Kent is experienced but hurt. Less telling, more listening.', did: 'Kept Directing for Kent in week 2, then switched to Partnering in week 3.', verdict: 'Action caught up with intent a week later', tone: 'attention' as const },
    { key: 'peter', said: 'Peter needs structure before freedom.', did: 'Directing for Peter in weeks 1 to 3, Guiding from week 4.', verdict: 'Action matched intent', tone: 'gain' as const }
  ],
  plan: [
    { key: '1', text: 'Ask one open question before giving any fix, in every 1:1.' },
    { key: '2', text: 'Give corrective feedback in private, within a day.' },
    { key: '3', text: 'Check each person’s style fit on Monday, not Friday.' }
  ],
  reflection: 'Kent taught me that the loudest problem is not always the real one.'
};
