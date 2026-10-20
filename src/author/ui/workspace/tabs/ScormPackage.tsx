import { useMemo, useState } from 'react';
import { parseStoryline } from '../../../../engine/config';
import { DEFAULT_SCALE } from '../../../../engine/report/defaults';
import { useI18n } from '../../../../i18n';
import '../../../../lms/messages';
import { lmsSettingsOf, type LmsSettings, type ScormVersion } from '../../../../lms/settings';
import type { AuthorDraft } from '../../../model/draft';
import { useAuthor } from '../../../model/store';
import { toStoryline } from '../../../model/export';
import { validateDraft } from '../../../model/validate';
import { BUTTON, CARD, Field, Segmented, Select, TextInput, Toggle } from '../../kit';

type Done = { standard: string; title: string; version: number; hash: string };

function save(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Download SCORM package" (D207): the draft as last saved, exported and checked the way Publish checks it,
 * packaged with the participant player for an LMS. The author picks the standard, when a run counts as
 * complete, what passes, and connected mode; the package records the draft's version and content hash so it
 * ties to the Preview of the same draft. The choices are the draft's own LMS settings (`draft.lms`, exported as
 * the storyline's `lms` block, D184): the section edits them, and the package reads them back from the exported
 * storyline through `lmsSettingsOf`, so what the LMS records traces to this section.
 */
export function ScormPackage({ d }: { d: AuthorDraft }) {
  const { t } = useI18n();
  const exported = useMemo(() => toStoryline(d).storyline, [d]);
  const edit = useAuthor(x => x.edit);
  const facts = useMemo(() => {
    const p = parseStoryline(exported);
    const scale = p.ok ? p.config.report.scale.map(l => l.name) : DEFAULT_SCALE.map(l => l.name);
    return { unit: p.ok ? p.config.time.period.unit : 'week', periods: p.ok ? p.config.time.period.count : 8, scale, settings: lmsSettingsOf(p.ok ? p.config : exported) };
  }, [exported]);
  const s = facts.settings;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const version = d.publish.version + 1;
  /** Writes a choice into the draft's LMS settings (D184), in the draft's terms. */
  const set = (patch: Partial<LmsSettings>) => {
    edit(x => {
      const l = x.lms;
      if (patch.version) l.package = patch.version;
      if (patch.completion) { l.completion = patch.completion.kind; if (patch.completion.kind === 'weeks') l.completionWeeks = patch.completion.weeks; }
      if (patch.pass) {
        l.pass = patch.pass.kind;
        if (patch.pass.kind === 'score') l.passScore = patch.pass.min;
        if (patch.pass.kind === 'level') l.passLevel = facts.scale[patch.pass.min] ?? l.passLevel;
      }
      if (patch.connected !== undefined) l.connected = patch.connected;
    });
    setDone(null);
  };
  const standard = (v: ScormVersion) => t(v === 'scorm12' ? 'lms.scorm.version.scorm12' : 'lms.scorm.version.scorm2004');

  async function download() {
    setProblem(null);
    setDone(null);
    // The same checks as publishing, on the draft as it is now: anything blocking stops the package.
    const blocking = validateDraft(d).blocking;
    if (blocking.length) { setProblem(`${t('lms.scorm.blocked', { count: blocking.length })} ${blocking[0].title}.`); return; }
    setBusy(true);
    try {
      const { storyline, issues } = toStoryline(d);
      if (issues.length) { setProblem(t('lms.scorm.error.other', { reason: issues[0] })); return; }
      const { buildPackageFromSite } = await import('../../../../lms/package');
      const look = d.brand.look === 'light' ? 'light' : undefined;
      const built = await buildPackageFromSite({ storyline, settings: s, version, serviceUrl: location.origin, look });
      save(built.name, built.zip);
      setDone({ standard: standard(built.info.settings.version), title: built.info.title, version: built.info.version, hash: built.info.hash.slice(0, 12) });
    } catch (e) {
      const m = (e as Error).message;
      setProblem(m === 'playerMissing' ? t('lms.scorm.error.player') : t('lms.scorm.error.other', { reason: m }));
    } finally {
      setBusy(false);
    }
  }

  const pass = s.pass;
  return (
    <section aria-labelledby="scorm-title" className={`${CARD} mt-4 flex flex-col gap-4 p-6`}>
      <div className="flex flex-col gap-1">
        <h2 id="scorm-title" className="m-0 text-22 font-800">{t('lms.scorm.title')}</h2>
        <p className="m-0 text-14 text-author-body">{t('lms.scorm.intro')}</p>
        <p className="m-0 text-13 text-author-muted">{t('lms.scorm.from', { version, title: d.title })}</p>
      </div>
      <div className="grid grid-cols-3 gap-4 max-[1180px]:grid-cols-1">
        <div className="flex flex-col gap-1.5">
          <Segmented label={t('lms.scorm.version.label')} value={s.version} onChange={v => set({ version: v })}
            options={[{ value: 'scorm2004', label: t('lms.scorm.version.scorm2004') }, { value: 'scorm12', label: t('lms.scorm.version.scorm12') }]} />
          <p className="m-0 text-12 text-author-muted">{t('lms.scorm.version.help', { unit: facts.unit })}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Field label={t('lms.scorm.completion.label')}>
            {id => (
              <Select id={id} value={s.completion.kind} onChange={e => set({ completion: e.target.value === 'weeks' ? { kind: 'weeks', weeks: Math.min(facts.periods, d.lms.completionWeeks ?? 4) } : { kind: 'finish' } })}>
                <option value="finish">{t('lms.scorm.completion.finish')}</option>
                <option value="weeks">{t('lms.scorm.completion.periods', { unit: facts.unit })}</option>
              </Select>
            )}
          </Field>
          {s.completion.kind === 'weeks' && (
            <Field label={t('lms.scorm.completion.count', { unit: facts.unit, total: facts.periods })}>
              {id => <TextInput id={id} type="number" min={1} max={facts.periods} value={s.completion.kind === 'weeks' ? s.completion.weeks : 1}
                onChange={e => set({ completion: { kind: 'weeks', weeks: Math.min(facts.periods, Math.max(1, Math.round(Number(e.target.value) || 1))) } })} />}
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Field label={t('lms.scorm.pass.label')}>
            {id => (
              <Select id={id} value={pass.kind} onChange={e => set({ pass: e.target.value === 'score' ? { kind: 'score', min: d.lms.passScore } : e.target.value === 'level' ? { kind: 'level', min: facts.scale.includes(d.lms.passLevel.trim()) ? facts.scale.indexOf(d.lms.passLevel.trim()) : Math.min(2, facts.scale.length - 1) } : { kind: 'none' } })}>
                <option value="none">{t('lms.scorm.pass.none')}</option>
                <option value="score">{t('lms.scorm.pass.score')}</option>
                <option value="level">{t('lms.scorm.pass.level')}</option>
              </Select>
            )}
          </Field>
          {pass.kind === 'score' && (
            <Field label={t('lms.scorm.pass.scoreMin')} hint={t('lms.scorm.pass.scoreHelp')}>
              {id => <TextInput id={id} type="number" min={0} max={100} value={pass.min} onChange={e => set({ pass: { kind: 'score', min: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) } })} />}
            </Field>
          )}
          {pass.kind === 'level' && (
            <Field label={t('lms.scorm.pass.levelMin')} hint={t('lms.scorm.pass.levelHelp')}>
              {id => (
                <Select id={id} value={pass.min} onChange={e => set({ pass: { kind: 'level', min: Number(e.target.value) } })}>
                  {facts.scale.map((name, i) => <option key={name} value={i}>{name}</option>)}
                </Select>
              )}
            </Field>
          )}
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-12 bg-author-track p-4">
        <Toggle checked={s.connected} onChange={v => set({ connected: v })} label={t('lms.scorm.connected.label')} />
        <div className="flex flex-col gap-1">
          <b className="text-15">{t('lms.scorm.connected.label')}</b>
          <p className="m-0 text-13 text-author-body">{t('lms.scorm.connected.help')}</p>
        </div>
      </div>
      {problem && <p role="alert" className="m-0 rounded-12 bg-author-need-field p-3 text-14 font-700 text-author-need">{problem}</p>}
      {done && <p role="status" className="m-0 rounded-12 bg-author-gain-soft p-3 text-14 font-700 text-author-gain">{t('lms.scorm.done', done)}</p>}
      <div>
        <button type="button" className={`${BUTTON.big}`} disabled={busy} aria-busy={busy} onClick={() => void download()}>
          {busy ? t('lms.scorm.working') : t('lms.scorm.button')}
        </button>
      </div>
    </section>
  );
}
