import { Fragment, type CSSProperties } from 'react';
import type { ScreenProps } from '../app/types';
import type { StyleKey } from '../data/types';
import { css } from '../lib/css';
import { NoWrapButton } from '../ds/Button';

/** Development report, ported from `project/ilReport.dc.html`. Web view, print layout (two letter pages) and mobile. */
export interface ReportProps extends ScreenProps {
  print?: boolean;
  mobile?: boolean;
}

/** Polyline points in the 100x44 viewBox of the small multiples. */
function pts(a: number[], lo: number, hi: number): string {
  return a.map((v, i) => `${((i / (a.length - 1)) * 100).toFixed(1)},${(42 - ((v - lo) / (hi - lo)) * 40).toFixed(1)}`).join(' ');
}

type Series = [name: string, values: number[], target: number, note: string];

const SERIES: Series[] = [
  ['Revenue, $k', [18, 41, 70, 101, 134, 166, 198, 226], 240, 'Cumulative, dashed line is target pace'],
  ['Team skill', [57, 57, 60, 63, 65, 68, 70, 71], 0, 'Training and coaching from week 3'],
  ['Team morale', [57, 58, 61, 60, 64, 66, 67, 68], 0, 'Dip in week 4 after the price war'],
  ['Team result', [59, 60, 63, 66, 69, 71, 73, 74], 0, 'Steady climb'],
  ['Team trust', [56, 57, 60, 62, 65, 67, 69, 70], 0, 'Biggest gain after Kent']
];

const MULTIPLES = SERIES.map(([n, a, tgt, note]) => {
  const lo = Math.min(...a) - 2;
  const hi = tgt ? 245 : Math.max(...a) + 2;
  return {
    n,
    end: n.startsWith('Rev') ? '$' + a[7] + 'k' : String(a[7]),
    pts: pts(a, tgt ? 0 : lo, hi),
    target: tgt ? pts([30, 60, 90, 120, 150, 180, 210, 240], 0, hi) : '',
    note,
    aria: `${n} from ${a[0]} to ${a[7]}`
  };
});

const LEVELS = ['Emerging', 'Developing', 'Proficient', 'Strong'];

const SKILLS = (
  [
    ['Diagnosing people', 3, 'Since the territory split, my best leads go to Beth. What would make this feel fair to you?', 'Week 2, 1:1 with Kent'],
    ['Adapting your style', 2, 'Peter is new and unsure. Directing for now, then Guiding.', 'Week 3, style note'],
    ['Coaching conversations', 2, "Let's walk through your first three calls together tomorrow.", 'Week 2, 1:1 with Beth'],
    ['Giving feedback', 1, "Lowe, your demos are running long. Let's fix that before Friday.", 'Week 2, team meeting'],
    ['Business judgement', 2, 'We hold price on Ashcroft. Jack leads, Ruth shows the payback.', 'Week 3, sponsor briefing']
  ] as const
).map(([n, l, ev, when]) => ({
  n,
  level: LEVELS[l],
  ev,
  when,
  aria: `${n}: ${LEVELS[l]}, level ${l + 1} of 4`,
  steps: [0, 1, 2, 3].map(i => (i <= l ? 'var(--ik-acc)' : 'var(--ik-track)'))
}));

const STYLE_NAMES: Record<StyleKey, string> = { D: 'Directing', G: 'Guiding', P: 'Partnering', E: 'Entrusting' };
const FIT_NAMES = ['matched', 'one step off', 'missed'];

function fitOf(mi: number, w: number): number {
  const r = (mi * 7 + w * 13) % 10;
  if (w < 2) return r < 5 ? 2 : r < 8 ? 1 : 0;
  if (w < 4) return r < 2 ? 2 : r < 5 ? 1 : 0;
  return r < 1 ? 2 : r < 3 ? 1 : 0;
}

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8].map(w => 'W' + w);

const INTENT = [
  { said: 'Kent is experienced but hurt. Less telling, more listening.', did: 'Kept Directing for Kent in week 2, then switched to Partnering in week 3.', verdict: 'Action caught up with intent a week later', c: 'var(--ik-warn)' },
  { said: 'Peter needs structure before freedom.', did: 'Directing for Peter in weeks 1 to 3, Guiding from week 4.', verdict: 'Action matched intent', c: 'var(--ik-pos)' }
];

const PLAN = [
  { n: '1', t: 'Ask one open question before giving any fix, in every 1:1.' },
  { n: '2', t: 'Give corrective feedback in private, within a day.' },
  { n: '3', t: 'Check each person’s style fit on Monday, not Friday.' }
];

const H2 = 'margin:0; font-size:20px; font-weight:700';

export function Report({ d, act, print: printProp, mobile: mobileProp }: ReportProps) {
  const print = !!printProp;
  const mobile = !!mobileProp;

  const heat = d.members.map((m, mi) => ({
    id: m.id,
    n: mobile ? m.name.split(' ')[0] : m.name,
    cells: [0, 1, 2, 3, 4, 5, 6, 7].map(w => {
      const f = (m.id === 'kent' || m.id === 'lowe') && w < 2 ? 2 : fitOf(mi, w);
      const k = 'DGPE'[(mi + Math.floor(w / 3)) % 4] as StyleKey;
      return {
        k,
        t: `${m.name}, week ${w + 1}: ${STYLE_NAMES[k]}, ${FIT_NAMES[f]}`,
        bg: f === 0 ? 'var(--ik-acc)' : f === 1 ? 'transparent' : 'repeating-linear-gradient(45deg, var(--ik-warn-soft) 0 3px, transparent 3px 7px)',
        border: f === 0 ? '0' : f === 1 ? '2px solid var(--ik-acc)' : '1px solid var(--ik-warn)',
        color: f === 0 ? 'var(--ik-on-acc)' : 'var(--ik-text)'
      };
    })
  }));

  const pageStyle: CSSProperties = print
    ? { colorScheme: 'light', width: '1020px', height: '1320px', zoom: 0.8, background: '#fff', color: 'oklch(0.2 0.03 280)', padding: '64px 64px 48px', display: 'flex', flexDirection: 'column', gap: '28px', boxShadow: '0 20px 60px oklch(0.05 0.03 280 / 0.4)', overflow: 'hidden' }
    : { display: 'flex', flexDirection: 'column', gap: '28px', padding: mobile ? '20px 16px' : '32px', borderRadius: mobile ? '20px' : '28px', background: 'var(--ik-card)', border: '1px solid var(--ik-line)', backdropFilter: 'blur(14px)' };

  const outerStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: print ? 'center' : 'stretch',
    gap: print ? '24px' : '20px',
    padding: mobile ? '12px' : print ? '32px' : '24px 32px 40px',
    maxWidth: print ? 'none' : '1180px',
    margin: '0 auto',
    width: '100%',
    background: print ? 'oklch(0.3 0.02 280)' : 'transparent'
  };

  const h1 = mobile ? '34px' : '48px';
  const multiCols = mobile ? '1fr 1fr' : 'repeat(5,minmax(0,1fr))';
  const skillCols = mobile ? '1fr' : '200px 200px minmax(0,1fr)';
  const twoCols = mobile ? '1fr' : '1fr 1fr';
  const heatCols = mobile ? '70px repeat(8,30px)' : '150px repeat(8,minmax(0,1fr))';
  const heatMin = mobile ? '330px' : '0';

  const back = () => act.go('end');
  const pdf = () => act.say('Your PDF report is downloading.');
  const email = () => act.say('Report sent to your work email.');

  return (
    <div style={outerStyle}>
      {!print && (
        <div style={css('display:flex; align-items:center; gap:10px; flex-wrap:wrap')}>
          <button type="button" onClick={back} style={css('border:0; background:transparent; padding:0; color:var(--ik-text-2); font-size:13px; font-weight:600; cursor:pointer')}>
            ← Back to results
          </button>
          <span style={css('flex:1')}></span>
          <NoWrapButton variant="secondary" size="sm" onClick={email}>Email me</NoWrapButton>
          <NoWrapButton variant="primary" size="sm" onClick={pdf}>Download PDF</NoWrapButton>
        </div>
      )}

      <article aria-label="Development report, page 1" style={pageStyle}>
        <header style={css('display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap')}>
          <div style={css('display:flex; flex-direction:column; gap:6px')}>
            <span style={css('font-size:20px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent; align-self:flex-start')}>iLead</span>
            <span style={css('font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--ik-text-2)')}>Development report</span>
            <h1 style={css(`margin:0; font-size:${h1}; line-height:1.05; font-weight:700; letter-spacing:-0.03em`)}>Jordan Lee</h1>
            <span style={css('color:var(--ik-text-2); font-size:14px')}>Northwind Sales Leaders · October 2026 · 98 minutes of play</span>
          </div>
          <div style={css('display:flex; gap:10px')}>
            <div style={css('padding:12px 16px; border-radius:18px; border:1px solid var(--ik-line); display:flex; flex-direction:column')}>
              <span style={css('font-size:12px; color:var(--ik-text-2)')}>Tier</span>
              <b style={css('font-size:24px')}>Gold</b>
            </div>
            <div style={css('padding:12px 16px; border-radius:18px; border:1px solid var(--ik-line); display:flex; flex-direction:column')}>
              <span style={css('font-size:12px; color:var(--ik-text-2)')}>Leadership Score</span>
              <b style={css('font-size:24px')}>4,860</b>
            </div>
          </div>
        </header>
        <p style={css('margin:0; font-size:16px; line-height:1.65; text-wrap:pretty')}>
          You built a team that trusts you. Your strongest skill is diagnosing people early and changing course when you get it wrong. The next step is pace: you reached 94% of target, and most of the gap came from weeks 1 and 2, when you spent days on fixes before you understood the problem.
        </p>

        <section style={css('display:flex; flex-direction:column; gap:12px')}>
          <h2 style={css(H2)}>Your team over eight weeks</h2>
          <div style={css(`display:grid; grid-template-columns:${multiCols}; gap:10px`)}>
            {MULTIPLES.map(m => (
              <div key={m.n} style={css('padding:12px; border-radius:16px; border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:6px')}>
                <div style={css('display:flex; justify-content:space-between; font-size:12px')}>
                  <span style={css('color:var(--ik-text-2)')}>{m.n}</span>
                  <b>{m.end}</b>
                </div>
                <svg width="100%" height="44" viewBox="0 0 100 44" preserveAspectRatio="none" aria-label={m.aria}>
                  <polyline points={m.target} fill="none" stroke="var(--ik-line-strong)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"></polyline>
                  <polyline points={m.pts} fill="none" stroke="var(--ik-acc)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round"></polyline>
                </svg>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>{m.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={css('display:flex; flex-direction:column; gap:10px')}>
          <div style={css('display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap')}>
            <h2 style={css(H2)}>Your leadership skills</h2>
            <span style={css('font-size:12px; color:var(--ik-text-2)')}>Shown only here, never during play. Based on what you said and did.</span>
          </div>
          {SKILLS.map(k => (
            <div key={k.n} style={css(`display:grid; grid-template-columns:${skillCols}; gap:14px; align-items:center; padding:10px 0; border-top:1px solid var(--ik-line)`)}>
              <b style={css('font-size:14px')}>{k.n}</b>
              <div style={css('display:flex; align-items:center; gap:8px')}>
                <div aria-label={k.aria} style={css('display:flex; gap:3px')}>
                  {k.steps.map((st, i) => (
                    <span key={i} style={css(`width:26px; height:8px; border-radius:4px; background:${st}`)}></span>
                  ))}
                </div>
                <span style={css('font-size:12px; font-weight:700')}>{k.level}</span>
              </div>
              <span style={css('font-size:13px; color:var(--ik-text-2); text-wrap:pretty')}>
                “{k.ev}”{' '}<span style={css('white-space:nowrap')}>{k.when}</span>
              </span>
            </div>
          ))}
        </section>
        {print && (
          <footer style={css('margin-top:auto; display:flex; justify-content:space-between; font-size:12px; color:var(--ik-text-2)')}>
            <span>Genie · Powered by KNOLSKAPE</span>
            <span>Page 1 of 2</span>
          </footer>
        )}
      </article>

      <article aria-label="Development report, page 2" style={pageStyle}>
        <section style={css('display:flex; flex-direction:column; gap:12px')}>
          <div style={css('display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap')}>
            <h2 style={css(H2)}>Style fit, week by week</h2>
            <div style={css('display:flex; gap:12px; font-size:12px; color:var(--ik-text-2)')}>
              <span style={css('display:flex; gap:5px; align-items:center')}>
                <span style={css('width:14px; height:14px; border-radius:4px; background:var(--ik-acc)')}></span>Matched
              </span>
              <span style={css('display:flex; gap:5px; align-items:center')}>
                <span style={css('width:14px; height:14px; border-radius:4px; border:2px solid var(--ik-acc)')}></span>One step off
              </span>
              <span style={css('display:flex; gap:5px; align-items:center')}>
                <span style={css('width:14px; height:14px; border-radius:4px; background:repeating-linear-gradient(45deg, var(--ik-warn) 0 2px, transparent 2px 5px); border:1px solid var(--ik-warn)')}></span>Missed
              </span>
            </div>
          </div>
          <div style={css('overflow-x:auto')}>
            <div role="table" aria-label="Style you chose for each person each week, and whether it fit" style={css(`display:grid; grid-template-columns:${heatCols}; gap:4px; min-width:${heatMin}`)}>
              <span></span>
              {WEEKS.map(w => (
                <span key={w} style={css('font-size:12px; color:var(--ik-text-2); text-align:center')}>{w}</span>
              ))}
              {heat.map(h => (
                <Fragment key={h.id}>
                  <span style={css('font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; align-self:center')}>{h.n}</span>
                  {h.cells.map((c, i) => (
                    <span key={i} title={c.t} aria-label={c.t} style={css(`height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; background:${c.bg}; border:${c.border}; color:${c.color}`)}>
                      {c.k}
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <span style={css('font-size:13px; color:var(--ik-text-2)')}>You matched 61 of 80 choices. Most misses were early, with Kent and Lowe, and you corrected both by week 3.</span>
        </section>

        <section style={css(`display:grid; grid-template-columns:${twoCols}; gap:16px`)}>
          <div style={css('display:flex; flex-direction:column; gap:10px')}>
            <h2 style={css(H2)}>Intent and action</h2>
            {INTENT.map((it, i) => (
              <div key={i} style={css('padding:12px 14px; border-radius:16px; border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:4px; font-size:13px')}>
                <span>
                  <b>You said:</b> “{it.said}”
                </span>
                <span>
                  <b>You did:</b> {it.did}
                </span>
                <span style={css(`color:${it.c}; font-weight:700`)}>{it.verdict}</span>
              </div>
            ))}
          </div>
          <div style={css('display:flex; flex-direction:column; gap:10px')}>
            <h2 style={css(H2)}>Your plan for next week</h2>
            {PLAN.map(pl => (
              <div key={pl.n} style={css('display:grid; grid-template-columns:28px 1fr; gap:10px; padding:12px 14px; border-radius:16px; border:1px solid var(--ik-line); font-size:14px')}>
                <b style={css('width:28px; height:28px; border-radius:50%; background:var(--grad-brand); color:#0A081B; display:flex; align-items:center; justify-content:center; font-size:13px')}>{pl.n}</b>
                <span style={css('text-wrap:pretty')}>{pl.t}</span>
              </div>
            ))}
            <span style={css('font-size:12px; color:var(--ik-text-2)')}>Built from your reflection: “Kent taught me that the loudest problem is not always the real one.”</span>
          </div>
        </section>
        {print && (
          <footer style={css('margin-top:auto; display:flex; justify-content:space-between; font-size:12px; color:var(--ik-text-2)')}>
            <span>Genie · Powered by KNOLSKAPE · Shared with you and your program manager</span>
            <span>Page 2 of 2</span>
          </footer>
        )}
      </article>
    </div>
  );
}
