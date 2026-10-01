import { useState, type ChangeEvent } from 'react';
import type { ScreenProps } from '../app/types';
import { css } from '../lib/css';
import { NoWrapButton } from '../ds/Button';

/** End of simulation reflection, ported from `project/ilEnd.dc.html`. */

const TIERS = ([['Bronze', '20px'], ['Silver', '30px'], ['Gold', '40px'], ['Platinum', '50px']] as const).map(([n, h], i) => ({
  n,
  h,
  bg: i <= 2 ? 'var(--grad-spectrum)' : 'var(--ik-track)'
}));

const RESULTS = [
  ['Conversions', '27', '+9 on week 1 pace'],
  ['Team skill', '71', '+14'],
  ['Team morale', '68', '+11'],
  ['Team result', '74', '+15'],
  ['Team trust', '70', '+14']
].map(([n, v, d]) => ({ n, v, d }));

const MOMENTS = [
  { img: '/assets/npc/kent.png', t: 'Kent opened up about the territory split', w: 'Week 2 · Best moment', tag: 'Best', tagBg: 'var(--ik-pos-soft)', border: 'var(--ik-line)' },
  { img: '/assets/npc/peter.png', t: 'Peter qualified his first $10,000 lead', w: 'Week 5 · Best moment', tag: 'Best', tagBg: 'var(--ik-pos-soft)', border: 'var(--ik-line)' },
  { img: '/assets/npc/jack.png', t: 'Jack and Green held price on Ashcroft', w: 'Week 3 · Best moment', tag: 'Best', tagBg: 'var(--ik-pos-soft)', border: 'var(--ik-line)' },
  { img: '/assets/npc/lowe.png', t: 'Feedback to Lowe landed in front of the team', w: 'Week 2 · Worth revisiting', tag: 'Revisit', tagBg: 'var(--ik-warn-soft)', border: 'var(--ik-warn)' }
];

const QUESTIONS = ['What did you learn about adapting your style to each person?', 'What will you do differently with your real team next week?'];

export function End({ d, app, act }: ScreenProps) {
  const [answers, setAnswers] = useState<string[]>(['Kent taught me that the loudest problem is not always the real one. Asking first changed everything.', '']);
  const [rating, setRating] = useState(4);

  const badges = d.badges.map((b, i) => ({
    n: b.n,
    d: b.d,
    c: i < 4 ? 'var(--ik-text)' : 'var(--ik-text-2)',
    bg: i < 4 ? 'var(--grad-spectrum)' : 'var(--ik-track)'
  }));

  const onAnswer = (i: number) => (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setAnswers(x => {
      const a = [...x];
      a[i] = v;
      return a;
    });
  };
  const mic = () => act.say('Listening. Your words will appear in the box to edit.');
  const toReport = () => act.go('report');
  const pdf = () => act.say('Your PDF report is downloading.');
  const email = () => act.say('Report sent to your work email.');

  return (
    <div style={css(`flex:1; min-height:${app.minH}; display:flex; flex-direction:column; padding:20px 32px 32px; gap:22px; position:relative`)}>
      <div aria-hidden="true" style={css('position:absolute; left:50%; top:0; width:900px; height:500px; transform:translateX(-50%); background:radial-gradient(ellipse at center, oklch(0.75 0.14 200 / 0.3), transparent 65%); pointer-events:none')}></div>
      <header style={css('position:relative; display:flex; align-items:center; gap:16px')}>
        <span style={css('font-size:22px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent')}>iLead</span>
        <span style={css('font-size:13px; color:var(--ik-text-2)')}>Simulation complete</span>
      </header>

      <section style={css('position:relative; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:32px; align-items:end')}>
        <div style={css('display:flex; flex-direction:column; gap:10px')}>
          <span style={css('font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--ik-acc-2)')}>Eight weeks, ten people, one team</span>
          <h1 style={css('margin:0; font-size:60px; line-height:1; font-weight:700; letter-spacing:-0.03em')}>
            You finished at <span style={css('background:var(--grad-spectrum); -webkit-background-clip:text; background-clip:text; color:transparent')}>Gold</span>.
          </h1>
          <p style={css('margin:0; font-size:17px; color:var(--ik-text-2); max-width:640px; text-wrap:pretty')}>
            Take a moment before the report. What you notice now is what you will use on Monday.
          </p>
        </div>
        <div style={css('display:flex; align-items:center; gap:16px; padding:16px 22px; border-radius:24px; background:var(--ik-card); border:1px solid var(--ik-line)')}>
          <div aria-label="Tier: Gold. Bronze, Silver, Gold, Platinum" style={css('display:flex; gap:6px')}>
            {TIERS.map(t => (
              <span key={t.n} title={t.n} style={css(`width:14px; height:${t.h}; border-radius:4px; background:${t.bg}; align-self:flex-end`)}></span>
            ))}
          </div>
          <div style={css('display:flex; flex-direction:column')}>
            <span style={css('font-size:12px; color:var(--ik-text-2)')}>Leadership Score</span>
            <b style={css('font-size:34px; letter-spacing:-0.02em')}>4,860</b>
          </div>
        </div>
      </section>

      <section aria-label="Results" style={css('position:relative; display:grid; grid-template-columns:minmax(0,1.6fr) repeat(5,minmax(0,1fr)); gap:12px')}>
        <div style={css('padding:16px; border-radius:20px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:8px')}>
          <span style={css('font-size:12px; color:var(--ik-text-2)')}>Target achieved</span>
          <b style={css('font-size:24px')}>
            $226,400 <span style={css('font-size:13px; color:var(--ik-text-2); font-weight:600')}>of $240,000</span>
          </b>
          <div style={css('height:8px; border-radius:4px; background:var(--ik-track)')}>
            <div style={css('height:100%; width:94%; border-radius:4px; background:linear-gradient(90deg,var(--ik-acc),var(--ik-acc-2))')}></div>
          </div>
        </div>
        {RESULTS.map(r => (
          <div key={r.n} style={css('padding:16px; border-radius:20px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:4px')}>
            <span style={css('font-size:12px; color:var(--ik-text-2)')}>{r.n}</span>
            <b style={css('font-size:24px')}>{r.v}</b>
            <span style={css('font-size:12px; color:var(--ik-pos); font-weight:700')}>{r.d}</span>
          </div>
        ))}
      </section>

      <section style={css('position:relative; display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr); gap:20px')}>
        <div style={css('display:flex; flex-direction:column; gap:12px')}>
          <h2 style={css('margin:0; font-size:20px; font-weight:700')}>Moments from your eight weeks</h2>
          {MOMENTS.map(m => (
            <div key={m.t} style={css(`display:grid; grid-template-columns:52px minmax(0,1fr) auto; gap:14px; align-items:center; padding:12px 14px; border-radius:18px; background:var(--ik-card); border:1px solid ${m.border}`)}>
              <span style={css('width:52px; height:52px; border-radius:50%; overflow:hidden; background:linear-gradient(160deg,#DEE9FF,#9FDCEB)')}>
                <img src={m.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />
              </span>
              <span style={css('display:flex; flex-direction:column')}>
                <b style={css('font-size:14px')}>{m.t}</b>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>{m.w}</span>
              </span>
              <span style={css(`height:24px; padding:0 10px; border-radius:999px; background:${m.tagBg}; font-size:12px; font-weight:700; display:flex; align-items:center`)}>{m.tag}</span>
            </div>
          ))}
          <div style={css('display:flex; flex-direction:column; gap:8px; padding-top:6px')}>
            <h2 style={css('margin:0; font-size:16px; font-weight:700')}>Badges</h2>
            <div style={css('display:flex; gap:10px; flex-wrap:wrap')}>
              {badges.map(b => (
                <span key={b.n} title={b.d} style={css(`display:flex; align-items:center; gap:8px; height:36px; padding:0 14px 0 4px; border-radius:999px; background:var(--ik-card); border:1px solid var(--ik-line); font-size:13px; font-weight:700; color:${b.c}`)}>
                  <span style={css(`width:28px; height:28px; border-radius:50%; background:${b.bg}`)}></span>
                  <span>{b.n}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={css('display:flex; flex-direction:column; gap:14px; padding:20px; border-radius:24px; background:var(--ik-mat); border:1px solid var(--ik-line-strong)')}>
          <h2 style={css('margin:0; font-size:20px; font-weight:700')}>Reflect, two questions</h2>
          <span style={css('font-size:13px; color:var(--ik-text-2)')}>Optional. Answer by voice or text. Your answers shape your development plan.</span>
          {QUESTIONS.map((q, i) => (
            <div key={i} style={css('display:flex; flex-direction:column; gap:6px')}>
              <b style={css('font-size:14px')}>{q}</b>
              <div style={css('display:flex; gap:8px; align-items:flex-start')}>
                <textarea
                  value={answers[i]}
                  onChange={onAnswer(i)}
                  rows={3}
                  aria-label={q}
                  placeholder="A sentence or two is plenty"
                  style={css('flex:1; padding:10px 12px; border-radius:14px; border:1px solid var(--ik-line-strong); background:var(--ik-raised); color:var(--ik-text); font-size:14px; resize:none')}
                ></textarea>
                <button type="button" onClick={mic} aria-label="Answer by voice" style={css('width:44px; height:44px; flex:none; border-radius:50%; border:0; background:var(--grad-brand); color:#0A081B; cursor:pointer; display:flex; align-items:center; justify-content:center')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <div style={css('display:flex; flex-direction:column; gap:6px; padding-top:4px; border-top:1px solid var(--ik-line)')}>
            <b style={css('font-size:14px; padding-top:10px')}>How was the experience?</b>
            <div role="radiogroup" aria-label="Rating, 1 to 5" style={css('display:flex; gap:6px')}>
              {[1, 2, 3, 4, 5].map(n => {
                const on = rating === n;
                const border = on ? 'transparent' : 'var(--ik-line-strong)';
                const bg = on ? 'var(--grad-brand)' : 'transparent';
                const color = on ? '#0A081B' : 'var(--ik-text)';
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${n} of 5`}
                    onClick={() => setRating(n)}
                    style={css(`width:44px; height:44px; border-radius:50%; border:1.5px solid ${border}; background:${bg}; color:${color}; font-weight:700; cursor:pointer`)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={css('display:flex; gap:10px; flex-wrap:wrap; padding-top:6px')}>
            <NoWrapButton variant="primary" size="lg" onClick={toReport}>View my report</NoWrapButton>
            <NoWrapButton variant="secondary" size="lg" onClick={pdf}>Download PDF</NoWrapButton>
            <NoWrapButton variant="ghost" size="lg" onClick={email}>Email to me</NoWrapButton>
          </div>
        </div>
      </section>
    </div>
  );
}
