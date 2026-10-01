import { useState, type ChangeEvent } from 'react';
import type { ScreenProps } from '../app/types';
import { NoWrapButton } from '../ds/Button';
import { css } from '../lib/css';

/** Port of `project/ilStyle.dc.html`. */
export interface StyleSettingProps extends ScreenProps {
  /** Initial view: `list`, `summary` or `tooltip` (Kent's Partnering tooltip open). Anything else shows cards. */
  view?: string;
}

type View = 'cards' | 'list';

interface State {
  view: View;
  summary: boolean;
  tip: string | null;
  noting: string | null;
  notes: Record<string, string>;
}

type Update = Partial<State> | ((s: State) => Partial<State> | null);

/** Mirrors the logic class's state plus what componentDidMount derives from `view`. */
function initialState(view: string | undefined): State {
  const st: State = { view: 'cards', summary: false, tip: null, noting: null, notes: { kent: 'Kent is experienced but hurt. Less telling, more listening.' } };
  if (view === 'list') st.view = 'list';
  if (view === 'summary') st.summary = true;
  if (view === 'tooltip') st.tip = 'kent:P';
  return st;
}

const VIEWS: Array<[View, string]> = [
  ['cards', 'Cards'],
  ['list', 'List']
];

const ROW_GRID = 'display:grid; grid-template-columns:minmax(220px,1.4fr) minmax(170px,1fr) minmax(170px,1fr) repeat(4,96px) minmax(180px,1.1fr); gap:12px';

export function StyleSetting({ d: D, app, act, view }: StyleSettingProps) {
  const [s, setRaw] = useState<State>(() => initialState(view));
  /** class component style setState: merges, `null` from an updater is a no-op. */
  const setState = (u: Update) =>
    setRaw(prev => {
      const patch = typeof u === 'function' ? u(prev) : u;
      return patch ? { ...prev, ...patch } : prev;
    });

  const rows = app.members.map(m => {
    const cur = D.styles.find(x => x.k === m.style)!;
    const last = D.styles.find(x => x.k === m.last)!;
    const pos = m.lastReact === 'pos';
    const note = s.notes[m.id];
    return {
      id: m.id,
      name: m.name,
      img: m.img,
      stage: D.stages[m.stage].n,
      skill: m.skill,
      morale: m.morale,
      trust: m.trust,
      backdrop: m.away ? 'linear-gradient(160deg,#E4E6F0,#C9CEDF)' : 'linear-gradient(160deg,#DEE9FF,#9FDCEB)',
      filter: m.away ? 'grayscale(1)' : 'none',
      border: m.style !== m.last ? 'var(--ik-acc-2)' : 'var(--ik-line)',
      changed: m.style !== m.last,
      lastN: last.n,
      lastArrow: pos ? '▲' : '▼',
      lastC: pos ? 'var(--ik-pos)' : 'var(--ik-neg)',
      lastBg: pos ? 'var(--ik-pos-soft)' : 'var(--ik-neg-soft)',
      lastWord: pos ? 'reacted well' : 'reacted badly',
      curN: cur.n,
      note: m.away ? 'Applies when he is back from training.' : cur.d,
      aria: `Style for ${m.name}`,
      radioName: 'st-' + m.id,
      seg: D.styles.map((st, i) => {
        const tipKey = m.id + ':' + st.k;
        const on = m.style === st.k;
        return {
          k: st.k,
          name: st.n,
          desc: st.d,
          on,
          aria: `${st.n} for ${m.name}`,
          tip: s.tip === tipKey,
          tipLeft: i < 2 ? '0' : '100%',
          tipShift: i < 2 ? '0' : '-100%',
          bg: on ? 'var(--grad-brand)' : 'transparent',
          color: on ? '#0A081B' : 'var(--ik-text-2)',
          tipOn: () => setState({ tip: tipKey }),
          tipOff: () => setState(x => (x.tip === tipKey ? { tip: null } : null)),
          pick: () => act.setStyle(m.id, st.k)
        };
      }),
      noting: s.noting === m.id,
      rationale: note || '',
      rationaleShow: note || 'No note',
      noteCta: note ? 'Note: ' + note.slice(0, 28) + '…' : 'Add a reason',
      noteAria: `Reason for ${m.name}`,
      addNote: () => setState({ noting: m.id }),
      onNote: (e: ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setState(x => ({ notes: { ...x.notes, [m.id]: v } }));
      }
    };
  });

  const confirm = () => {
    act.go('board');
    act.say('Priya: “Good. Let us see how the team takes it.” Styles are set for the week.');
  };

  return (
    <div style={css(`flex:1; min-height:${app.minH}; display:flex; flex-direction:column; gap:18px; padding:20px 32px 32px`)}>
      <header style={css('display:flex; align-items:center; gap:16px')}>
        <span style={css('font-size:22px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent')}>iLead</span>
        <span style={css('font-size:13px; color:var(--ik-text-2); white-space:nowrap')}>
          <b style={css('color:var(--ik-text)')}>Week {app.week}</b> of 8 · Style setting
        </span>
        <span style={css('flex:1')}></span>
        <div role="radiogroup" aria-label="View" style={css('display:flex; gap:2px; padding:3px; border-radius:999px; background:var(--ik-raised); border:1px solid var(--ik-line)')}>
          {VIEWS.map(([k, n]) => {
            const on = s.view === k;
            return (
              <button
                key={k}
                role="radio"
                aria-checked={on}
                onClick={() => setState({ view: k })}
                style={css(`height:32px; padding:0 14px; border:0; border-radius:999px; font-size:13px; font-weight:700; cursor:pointer; background:${on ? 'var(--grad-brand)' : 'transparent'}; color:${on ? '#0A081B' : 'var(--ik-text-2)'}`)}
              >
                {n}
              </button>
            );
          })}
        </div>
        <NoWrapButton variant="primary" size="md" onClick={() => setState({ summary: true })}>Review and confirm</NoWrapButton>
      </header>

      <div style={css('display:grid; grid-template-columns:minmax(0,1.1fr) repeat(4,minmax(0,1fr)); gap:12px')}>
        <div style={css('display:flex; gap:12px; align-items:center; padding:12px 14px; border-radius:18px; background:var(--ik-card); border:1px solid var(--ik-line)')}>
          <span style={css('flex:none; width:44px; height:44px; border-radius:50%; background:var(--grad-brand); color:#0A081B; font-weight:700; display:flex; align-items:center; justify-content:center')}>PN</span>
          <span style={css('font-size:14px; text-wrap:pretty')}>“To each their own. Your people need different things from you this week.”</span>
        </div>
        {D.styles.map(df => (
          <div key={df.k} style={css('padding:12px 14px; border-radius:18px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; gap:10px; align-items:flex-start')}>
            <span style={css('flex:none; width:30px; height:30px; border-radius:50%; background:var(--grad-brand); color:#0A081B; font-weight:700; display:flex; align-items:center; justify-content:center')}>{df.k}</span>
            <span style={css('display:flex; flex-direction:column')}>
              <b style={css('font-size:14px')}>{df.n}</b>
              <span style={css('font-size:12px; color:var(--ik-text-2); line-height:1.4')}>{df.d}</span>
            </span>
          </div>
        ))}
      </div>

      {s.view === 'cards' && (
        <div style={css('display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px')}>
          {rows.map(m => (
            <div key={m.id} style={css(`border-radius:20px; background:var(--ik-card); backdrop-filter:blur(12px); border:2px solid ${m.border}; display:flex; flex-direction:column`)}>
              <div style={css(`position:relative; height:120px; border-radius:18px 18px 0 0; overflow:hidden; background:${m.backdrop}`)}>
                <img src={m.img} alt="" style={css(`width:100%; height:100%; object-fit:cover; object-position:center 12%; mix-blend-mode:multiply; filter:${m.filter}`)} />
                <div style={css('position:absolute; inset:0; background:linear-gradient(180deg, transparent 50%, oklch(0.13 0.03 285 / 0.8))')}></div>
                <div style={css('position:absolute; left:12px; bottom:8px; color:#fff; display:flex; flex-direction:column')}>
                  <b style={css('font-size:15px')}>{m.name}</b>
                  <span style={css('font-size:12px')}>{m.stage}</span>
                </div>
              </div>
              <div style={css('padding:10px 12px 12px; display:flex; flex-direction:column; gap:10px')}>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>
                  Skill <b style={css('color:var(--ik-text)')}>{m.skill}</b> · Morale <b style={css('color:var(--ik-text)')}>{m.morale}</b> · Trust <b style={css('color:var(--ik-text)')}>{m.trust}</b>
                </span>
                <span style={css(`align-self:flex-start; display:flex; align-items:center; gap:5px; height:22px; padding:0 8px; border-radius:999px; background:${m.lastBg}; font-size:12px; font-weight:600`)}>
                  <span style={css(`color:${m.lastC}`)}>{m.lastArrow}</span>Last week: <span>{m.lastN}</span>
                </span>
                <div role="radiogroup" aria-label={m.aria} style={css('display:grid; grid-template-columns:repeat(4,1fr); gap:2px; padding:2px; border-radius:999px; background:var(--ik-raised); border:1px solid var(--ik-line)')}>
                  {m.seg.map(sg => (
                    <div key={sg.k} style={css('position:relative')}>
                      <button
                        role="radio"
                        aria-checked={sg.on}
                        aria-label={sg.aria}
                        onClick={sg.pick}
                        onMouseEnter={sg.tipOn}
                        onMouseLeave={sg.tipOff}
                        onFocus={sg.tipOn}
                        onBlur={sg.tipOff}
                        style={css(`width:100%; height:30px; border:0; border-radius:999px; cursor:pointer; font-size:13px; font-weight:700; background:${sg.bg}; color:${sg.color}; transition:background 160ms ease`)}
                      >
                        {sg.k}
                      </button>
                      {sg.tip && (
                        <div role="tooltip" style={css(`position:absolute; bottom:calc(100% + 10px); left:${sg.tipLeft}; transform:translateX(${sg.tipShift}); width:200px; padding:10px 12px; border-radius:12px; background:var(--ik-text); color:light-dark(#fff, #0A081B); z-index:45; pointer-events:none; display:flex; flex-direction:column; gap:2px`)}>
                          <b style={css('font-size:13px')}>{sg.name}</b>
                          <span style={css('font-size:12px; line-height:1.4')}>{sg.desc}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <span style={css('font-size:12px; color:var(--ik-text-2); min-height:34px; text-wrap:pretty')}>
                  <b style={css('color:var(--ik-text)')}>{m.curN}.</b> {m.note}
                </span>
                {m.noting && (
                  <input
                    value={m.rationale}
                    onChange={m.onNote}
                    placeholder="Why this style? Optional"
                    aria-label={m.noteAria}
                    style={css('height:34px; padding:0 10px; border-radius:10px; border:1px solid var(--ik-line-strong); background:var(--ik-raised); color:var(--ik-text); font-size:13px')}
                  />
                )}
                {!m.noting && (
                  <button onClick={m.addNote} style={css('align-self:flex-start; border:0; background:transparent; padding:0; color:var(--ik-acc-2); font-size:12px; font-weight:700; cursor:pointer')}>
                    {m.noteCta}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {s.view === 'list' && (
        <div role="table" aria-label="Styles for every team member" style={css('border-radius:22px; background:var(--ik-card); backdrop-filter:blur(12px); border:1px solid var(--ik-line); overflow:hidden')}>
          <div role="row" style={css(`${ROW_GRID}; padding:12px 18px; font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--ik-text-2); border-bottom:1px solid var(--ik-line)`)}>
            <span>Member</span>
            <span>Skill · Morale · Trust</span>
            <span>Last week</span>
            <span style={css('text-align:center')}>Directing</span>
            <span style={css('text-align:center')}>Guiding</span>
            <span style={css('text-align:center')}>Partnering</span>
            <span style={css('text-align:center')}>Entrusting</span>
            <span>Your reason</span>
          </div>
          {rows.map(m => (
            <div key={m.id} role="row" style={css(`${ROW_GRID}; align-items:center; padding:10px 18px; border-bottom:1px solid var(--ik-line)`)}>
              <div style={css('display:flex; gap:10px; align-items:center')}>
                <span style={css(`width:40px; height:40px; flex:none; border-radius:50%; overflow:hidden; background:${m.backdrop}`)}>
                  <img src={m.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />
                </span>
                <span style={css('display:flex; flex-direction:column')}>
                  <b style={css('font-size:14px')}>{m.name}</b>
                  <span style={css('font-size:12px; color:var(--ik-text-2)')}>{m.stage}</span>
                </span>
              </div>
              <span style={css('font-size:13px')}>
                {m.skill} · {m.morale} · {m.trust}
              </span>
              <span style={css('font-size:13px')}>
                <span style={css(`color:${m.lastC}`)}>{m.lastArrow}</span> {m.lastN}, {m.lastWord}
              </span>
              {m.seg.map(sg => (
                <label key={sg.k} style={css('display:flex; justify-content:center; cursor:pointer')}>
                  <input type="radio" name={m.radioName} checked={sg.on} onChange={sg.pick} aria-label={sg.aria} style={css('width:20px; height:20px; accent-color:#249DFF; cursor:pointer')} />
                </label>
              ))}
              <span style={css('font-size:13px; color:var(--ik-text-2)')}>{m.rationaleShow}</span>
            </div>
          ))}
        </div>
      )}

      {s.summary && (
        <div style={css('position:absolute; inset:0; z-index:40; background:var(--ik-scrim); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px')}>
          <div role="dialog" aria-label="Confirm styles" style={css('width:720px; max-width:100%; border-radius:26px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); padding:26px; display:flex; flex-direction:column; gap:16px; animation:ilIn 260ms ease')}>
            <h2 style={css('margin:0; font-size:24px; font-weight:700')}>Your styles for week {app.week}</h2>
            <div style={css('display:grid; grid-template-columns:1fr 1fr; gap:6px 24px')}>
              {rows.map(m => (
                <div key={m.id} style={css('display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--ik-line)')}>
                  <span style={css(`width:32px; height:32px; flex:none; border-radius:50%; overflow:hidden; background:${m.backdrop}`)}>
                    <img src={m.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />
                  </span>
                  <b style={css('flex:1; font-size:14px')}>{m.name}</b>
                  <span style={css('font-size:13px')}>{m.curN}</span>
                  {m.changed && <span style={css('font-size:12px; font-weight:700; color:var(--ik-acc-2)')}>Changed</span>}
                </div>
              ))}
            </div>
            <span style={css('font-size:13px; color:var(--ik-text-2)')}>Styles take effect straight away. Peter's applies when he is back from training.</span>
            <div style={css('display:flex; justify-content:flex-end; gap:10px')}>
              <NoWrapButton variant="secondary" size="lg" onClick={() => setState({ summary: false })}>Go back</NoWrapButton>
              <NoWrapButton variant="primary" size="lg" onClick={confirm}>Confirm styles</NoWrapButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
