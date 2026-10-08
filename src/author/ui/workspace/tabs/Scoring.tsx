import { useState } from 'react';
import { extractFramework } from '../../../extract';
import { BANDS, type AuthorDraft, type Band } from '../../../model/draft';
import { seedDraft } from '../../../model/seed';
import { useAuthor } from '../../../model/store';
import { DEFAULT_SECTIONS, REPORT_SECTIONS } from '../../../../engine/config';
import { SECTION_NAMES } from '../../../storyline';
import { Badge, BUTTON, CARD, CardHead, Icon, MarkOf, Modal, Segmented, Select, SHORT_MAX, TEXT_MAX, TextInput } from '../../kit';
import { navigate } from '../../route';
import { TabBody, TabHead } from '../Workspace';

const BAND: Record<Band, string> = { strong: 'Strong', adequate: 'Adequate', weak: 'Weak', harmful: 'Harmful' };
type Framework = NonNullable<AuthorDraft['scoring']['framework']>;

/** Rows Kora reads from an uploaded framework: from the text when it has headings and bullets, else (a PDF, offline) nothing invented, one row per heading the author fills. */
export function readFramework(name: string, text: string | null): Framework {
  const dims = text ? extractFramework(text) : [];
  const rows: Framework['rows'] = dims.map((d, i) => ({ skill: d.name, behaviors: d.behaviours.join('; '), levels: d.levels.length || null, page: i + 1, include: d.behaviours.length > 0 }));
  return { file: name, pages: text ? Math.max(1, Math.ceil(text.length / 2500)) : 0, step: 2, rows, confirmed: false };
}

/**
 * Use your own skills framework (docs/design/genie/Framework): upload, check what Kora found (every row
 * cites its page; nothing is invented, a skill without behaviors needs the author), confirm. The lens
 * still drives the team and the style fit; the framework's skills replace the lens's in the report.
 */
function FrameworkSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const setOffer = useAuthor(s => s.setOffer);
  const f = d.scoring.framework;
  const setRow = (i: number, patch: Partial<Framework['rows'][number]>) => edit(x => { const r = x.scoring.framework?.rows[i]; if (r) Object.assign(r, patch); }, 'scoring.framework');
  const found = f?.rows.filter(r => r.behaviors.trim()).length ?? 0;
  const needs = (f?.rows.length ?? 0) - found;
  return (
    <Modal open={open} onOpenChange={onOpenChange} side title="Use your own skills framework" description="Your skills replace the lens skills in scoring and the report. The lens still drives the team and style fit."
      footer={<>
        <button type="button" className={BUTTON.big} disabled={!f || found < 2} onClick={() => { edit(x => {
          if (!x.scoring.framework) return;
          x.scoring.framework.confirmed = true; x.scoring.framework.step = 3;
          x.scoring.skills = x.scoring.framework.rows.filter(r => r.include && r.behaviors.trim()).map(r => ({ key: r.skill.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: r.skill, reportOnly: false }));
        }, { mark: 'scoring.framework', label: `Confirm the framework's ${found} skills`, restorePoint: true });
        // The actions scored on the old skills and the old sample calls: "Update N places" (D148), which scores each
        // action on two of the new skills in turn so every skill is observed (D128) and asks for the calls again.
        setOffer({ kind: 'skills', why: 'framework' }); onOpenChange(false); }}>Confirm {found} skills</button>
        <button type="button" className={BUTTON.secondary} onClick={() => { onOpenChange(false); navigate({ page: 'workspace', tab: 'scoring' }); }}>Ask Kora about this framework</button>
        <span className="flex-1" />
        <button type="button" className={BUTTON.link} onClick={() => { edit(x => {
          const fresh = seedDraft({ ...x.chat, primary: x.lens.id, secondary: x.lens.secondary }, 'workspace');
          x.scoring.framework = null; x.scoring.skills = fresh.scoring.skills;
          for (const a of x.actions) a.scoredOn = fresh.actions.find(y => y.key === a.template)?.scoredOn ?? fresh.scoring.skills.filter(k => !k.reportOnly).slice(0, 2).map(k => k.name);
        }, { label: 'Keep the lens skills', restorePoint: true }); onOpenChange(false); }}>Keep the lens skills</button>
      </>}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <ol className="m-0 flex list-none flex-wrap gap-6 p-0 text-14 font-700" aria-label="Steps">
          {['Upload', 'Check what Kora found', 'Confirm'].map((s, i) => {
            const step = f ? (f.confirmed ? 3 : 2) : 1;
            return <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className={`flex items-center gap-2 ${step === i + 1 ? 'text-author-ink' : 'text-author-label'}`}><span aria-hidden="true" className={`flex size-6 items-center justify-center rounded-round text-12 ${step > i + 1 ? 'bg-author-gain-soft text-author-gain' : step === i + 1 ? 'bg-author-primary text-author-on-primary' : 'bg-author-track'}`}>{step > i + 1 ? Icon.check(12) : i + 1}</span>{s}</li>;
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-3 rounded-12 bg-author-track p-4">
          {Icon.file()}
          <span className="flex-1 text-15">{f ? <><b>{f.file}</b> &middot; {f.pages ? `${f.pages} page${f.pages === 1 ? '' : 's'}` : 'not read yet'} &middot; uploaded by you</> : 'Upload your skills or leadership framework: .txt, .md or .pdf.'}</span>
          <label className={`${BUTTON.secondary} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary`}>{f ? 'Replace' : 'Upload'}
            <input type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" className="sr-only" onChange={async e => {
              const file = e.target.files?.[0]; e.target.value = '';
              if (!file) return;
              const text = /\.(txt|md|markdown)$/i.test(file.name) || file.type.startsWith('text/') ? await file.text() : null;
              edit(x => { x.scoring.framework = readFramework(file.name, text); }, 'scoring.framework');
            }} />
          </label>
        </div>
        {f && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 flex-1 text-14"><b>Kora found {f.rows.length} skills.</b> Edit any cell. Nothing here is invented: every row cites its page.</p>
              <Badge kind="ai">{found} found</Badge>{needs > 0 && <Badge kind="need">{needs} needs you</Badge>}
            </div>
            {f.rows.length === 0 && <p className="m-0 rounded-12 bg-author-need-field p-3 text-14 text-author-need">I could not read skills from this file here. Upload it as text, or add the skills below; a server reads PDFs.</p>}
            <div className="overflow-hidden rounded-12 border border-solid border-author-line">
              <table className="w-full table-fixed border-collapse text-14">
                <caption className="sr-only">Skills from your framework</caption>
                <thead><tr className="bg-author-track text-11 font-800 tracking-[0.08em] text-author-label uppercase"><th scope="col" className="w-[26%] px-3 py-2 text-start">Skill</th><th scope="col" className="px-2 py-2 text-start">Observable behaviors</th><th scope="col" className="w-16 px-2 py-2 text-start">Levels</th><th scope="col" className="w-16 px-2 py-2 text-start">Source</th><th scope="col" className="w-20 px-2 py-2 text-start">Use</th></tr></thead>
                <tbody>
                  {f.rows.map((r, i) => {
                    const need = !r.behaviors.trim();
                    const inp = 'w-full rounded-8 border border-transparent bg-transparent px-2 py-1 text-14 hover:border-author-line-control focus-visible:outline-2 focus-visible:outline-author-primary';
                    return (
                      <tr key={i} className={`border-t border-solid border-author-rule ${need ? 'bg-author-need-field' : 'bg-author-ai-field'}`}>
                        <td className="px-1 py-1"><input maxLength={SHORT_MAX} aria-label={`Skill ${i + 1}`} className={`${inp} font-800`} value={r.skill} onChange={e => setRow(i, { skill: e.target.value })} /></td>
                        <td className="px-1 py-1"><input maxLength={TEXT_MAX} aria-label={`Behaviors for ${r.skill}`} className={inp} placeholder="The document lists this skill but gives no behaviors. Add 2 or 3, or leave it out." value={r.behaviors} onChange={e => setRow(i, { behaviors: e.target.value, include: !!e.target.value.trim() })} /></td>
                        <td className="px-1 py-1"><input aria-label={`Levels for ${r.skill}`} className={inp} value={r.levels ?? ''} placeholder="?" onChange={e => setRow(i, { levels: Number(e.target.value) || null })} /></td>
                        <td className="px-2 py-1 text-13">{r.page ? `p. ${r.page}` : 'You'}</td>
                        <td className="px-2 py-1"><input type="checkbox" aria-label={`Use ${r.skill}`} checked={r.include} onChange={e => setRow(i, { include: e.target.checked })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => edit(x => { x.scoring.framework?.rows.push({ skill: 'New skill', behaviors: '', levels: null, page: null, include: false }); }, 'scoring.framework')}>Add a skill</button>
            <div className="flex flex-col gap-1 rounded-12 border-[1.5px] border-dashed border-author-kora p-4">
              <b className="text-14 text-author-ai">When you confirm</b>
              <p className="m-0 text-13 text-author-body">Each skill is mapped to the conversations that observe it, at least twice each. The report and development plan use your framework&rsquo;s words. The sample answers step comes back so scoring still matches your judgment.</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Workspace: Scoring and report (docs/design/genie/Scoring, D110): the purpose, the skills scored (the
 * lens's, or the author's own framework), and sample answers the author agrees or disagrees with, so
 * scoring matches their judgment before publishing.
 */
export default function Scoring() {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const s = d.scoring;
  const answered = s.samples.filter(x => x.call !== null);
  const agreed = s.samples.filter(x => x.call === x.scored).length;
  const who = s.samples[0]?.with ?? '';
  const sections = s.reportSections ?? DEFAULT_SECTIONS[d.brief.purpose];
  return (
    <TabBody label="Scoring and report" head={<TabHead title="Scoring and report">How conversations are scored and what participants receive at the end.</TabHead>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="purpose">
            <CardHead id="purpose" title={<>Purpose <span className="text-13 font-700 text-author-decline">Required</span></>}><MarkOf path="brief.purpose" /></CardHead>
            <Segmented label="Purpose" value={d.brief.purpose} onChange={v => edit(x => { x.brief.purpose = v; }, 'brief.purpose')} options={[{ value: 'development', label: 'Development' }, { value: 'assessment', label: 'Assessment' }]} />
            <p className="m-0 text-14 text-author-body">Development reports frame findings as next steps. Assessment adds verdicts against a bar.</p>
          </section>
          <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="skills">
            <CardHead id="skills" title="Skills scored"><Badge kind={s.framework?.confirmed ? 'you' : 'ai'}>{s.framework?.confirmed ? 'Your framework' : 'From your lens'}</Badge></CardHead>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {s.skills.map(k => <li key={k.key} className="inline-flex min-h-10 items-center gap-2 rounded-pill bg-author-ai-field px-4 text-15 font-800">{k.name}{k.reportOnly && <Badge kind="muted">Report only</Badge>}</li>)}
            </ul>
            <button type="button" className={`${BUTTON.link} self-start`} onClick={() => setSheet(true)}>{s.framework ? 'Review your skills framework' : 'Use your own skills framework instead'}</button>
          </section>
        </div>
        <section aria-labelledby="samples" className={`flex flex-col gap-3 rounded-16 border border-solid p-5 ${answered.length < s.samples.length ? 'border-author-need-line bg-author-need-field' : 'border-author-line bg-author-surface'}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="samples" className={`m-0 text-17 font-800 ${answered.length < s.samples.length ? 'text-author-need' : ''}`}>{answered.length < s.samples.length ? `Needs you: check ${s.samples.length} sample answers` : 'Sample answers checked'}</h2>
            <span className="text-14 text-author-body">So scoring matches your judgment. {agreed} of {s.samples.length} agreed.</span>
          </div>
          <table className="w-full border-collapse text-14">
            <caption className="sr-only">Sample answers, how GenieKreator scored each, and your call</caption>
            <thead><tr className="text-11 font-800 tracking-[0.08em] text-author-label uppercase"><th scope="col" className="px-2 py-2 text-start">Sample answer in the 1:1 with {who}</th><th scope="col" className="w-32 px-2 py-2 text-start">GenieKreator scored</th><th scope="col" className="w-44 px-2 py-2 text-start">Your call</th></tr></thead>
            <tbody>
              {s.samples.map(x => (
                <tr key={x.id} className="border-t border-solid border-author-rule">
                  <td className="px-2 py-2">&ldquo;{x.answer}&rdquo;</td>
                  <td className="px-2 py-2"><Badge kind="ai">{BAND[x.scored]}</Badge></td>
                  <td className="px-2 py-2">
                    <Select aria-label={`Your call on: ${x.answer}`} value={x.call ?? ''} tone={x.call === null ? 'border-author-need-line bg-author-surface' : ''} onChange={e => edit(y => { const t = y.scoring.samples.find(z => z.id === x.id); if (t) t.call = (e.target.value || null) as Band | null; }, 'scoring.samples')}>
                      <option value="">Choose</option>
                      {BANDS.map(b => <option key={b} value={b}>{BAND[b]}{b === x.scored ? ', agree' : ''}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => edit(y => { for (const t of y.scoring.samples) if (t.call === null) t.call = t.scored; }, 'scoring.samples')}>Agree with the rest</button>
        </section>
        <section className={`${CARD} flex flex-col p-5`} aria-labelledby="advanced">
          <CardHead id="advanced" title="Advanced settings"><span className="text-13 text-author-body">Sensible defaults are set. Open only what you want to change.</span></CardHead>
          <ul className="m-0 flex list-none flex-col p-0">
            {[
              ['scale', 'Rating scale', `${s.levels.length} levels, ${s.levels[0]} to ${s.levels[s.levels.length - 1]}`, 'default'],
              ['linkage', 'Which conversations observe which skill', 'Set per action, under Scored on', 'ai'],
              ['sections', 'Report sections', `${sections.length} sections for ${d.brief.purpose}${s.reportSections ? '' : ', the default set'}`, 'default'],
              ['narratives', 'Narratives and development plan copy', `Written for your team, naming your ${d.lens.styles.length} styles`, 'ai']
            ].map(([k, title, sub, kind]) => (
              <li key={k} className="flex flex-col gap-2 border-b border-solid border-author-rule py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex flex-1 flex-col"><b className="text-15">{title}</b><span className="text-13 text-author-body">{sub}</span></span>
                  <Badge kind={kind === 'ai' ? 'generated' : 'default'} />
                  <button type="button" className={BUTTON.secondary} aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>Edit<span className="sr-only"> {title}</span></button>
                </div>
                {open === k && k === 'scale' && (
                  <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                    <legend className="mb-1 text-13 text-author-body">Level names, lowest first: 3 to 7 levels. Each skill&rsquo;s descriptions follow the number of levels.</legend>
                    {s.levels.map((l, i) => (
                      <div key={i} className="flex gap-2">
                        <TextInput aria-label={`Level ${i + 1}`} value={l} onChange={e => edit(x => { x.scoring.levels[i] = e.target.value; }, 'scoring.levels')} />
                        {s.levels.length > 3 && <button type="button" className={BUTTON.secondary} onClick={() => edit(x => { x.scoring.levels.splice(i, 1); }, 'scoring.levels')}>Remove<span className="sr-only"> level {i + 1}</span></button>}
                      </div>
                    ))}
                    <button type="button" className={`${BUTTON.secondary} self-start`} disabled={s.levels.length >= 7} onClick={() => edit(x => { x.scoring.levels.push('New level'); }, 'scoring.levels')}>Add a level</button>
                  </fieldset>
                )}
                {open === k && k === 'sections' && (
                  <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                    <legend className="mb-1 text-13 text-author-body">The report shows these, in this order.</legend>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[900px]:grid-cols-1">
                      {REPORT_SECTIONS.map(r => (
                        <label key={r} className="flex items-center gap-2 text-14"><input type="checkbox" checked={sections.includes(r)} disabled={sections.length === 1 && sections.includes(r)}
                          onChange={e => edit(x => { const next = REPORT_SECTIONS.filter(v => (v === r ? e.target.checked : sections.includes(v))); x.scoring.reportSections = next; }, 'scoring.reportSections')} /> {SECTION_NAMES[r]}</label>
                      ))}
                    </div>
                    {s.reportSections && <button type="button" className={`${BUTTON.link} self-start`} onClick={() => edit(x => { x.scoring.reportSections = null; }, 'scoring.reportSections')}>Use the default set for {d.brief.purpose}</button>}
                  </fieldset>
                )}
                {open === k && (k === 'linkage' || k === 'narratives') && <p className="m-0 text-13 text-author-body">{k === 'linkage' ? 'Each conversation lists the skills it observes under Scored on, in Actions and conversations. Pick at most 4 per action.' : 'Report lines name each style by its current name, so a rename in the Leadership lens tab reaches the report.'}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
      {sheet && <FrameworkSheet open onOpenChange={setSheet} />}
    </TabBody>
  );
}
