import { useId } from 'react';
import { useI18n } from '../../i18n';
import { ChartBlock } from './ChartBlock';
import { BarsChart, type BarLook, type BarSeries } from './charts';
import { DataTable, usePurpose } from './context';
import { SeriesLegend } from './ResultsSections';
import type { ProgressData, ThoughtData } from './types';
import './messages';

/** "Food for thought": reflective questions, each with its guiding line. */
export function ThoughtSection({ data }: { data: ThoughtData }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.thought.title')}</h2>
      <p className="m-0 text-13 text-fg-secondary">{t('report.thought.intro')}</p>
      <ol className="m-0 grid list-none gap-2.5 p-0 grid-cols-(--il-report-halves-columns)">
        {data.items.map(q => (
          <li key={q.question} className="flex flex-col gap-1.5 rounded-16 border border-line-default px-3.5 py-3">
            <p className="m-0 text-14 font-600 text-pretty">{q.question}</p>
            <p className="m-0 text-13 text-fg-secondary text-pretty">{q.guide}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "Key takeaways": the points to take away. */
export function TakeawaysSection({ lines }: { lines: string[] }) {
  const { t } = useI18n();
  const purpose = usePurpose();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.takeaways.title')}</h2>
      <p className="m-0 text-14">{t('report.takeaways.intro', { purpose })}</p>
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-14">
        {lines.map(l => <li key={l} className="text-pretty">{l}</li>)}
      </ul>
    </section>
  );
}

/** Looks for attempts, oldest first: the current attempt is the solid bar. */
const LOOKS: BarLook[] = ['outline', 'hatch'];

/**
 * "Progress over time": earlier attempts (from `getHistory`) beside this one, as a table of the headline
 * numbers and the skill scores by attempt. Shown only when there are earlier attempts.
 */
export function ProgressSection({ data }: { data: ProgressData }) {
  const { t, number } = useI18n();
  const id = useId();
  const recent = data.attempts.slice(-3);
  const series: BarSeries[] = recent.map((a, i) => ({ key: a.key, label: a.label, look: a.current ? 'solid' : LOOKS[(i + LOOKS.length - (recent.length - 1)) % LOOKS.length] }));
  const none = t('report.progress.none');
  const score = (v: number | null) => (v === null ? none : number(v));
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.progress.title')}</h2>
      <p className="m-0 text-13 text-fg-secondary">{t('report.progress.intro')}</p>
      <DataTable
        caption={t('report.progress.chartTitle')}
        columns={[t('report.progress.attemptColumn'), t('report.progress.metric', { metric: 'headline' }), t('report.progress.metric', { metric: 'score' }), t('report.progress.metric', { metric: 'adaptability' }), t('report.progress.metric', { metric: 'target' })]}
        rows={data.attempts.map(a => ({ key: a.key, header: a.label, cells: [a.headline, number(a.score), t('report.percent', { pct: a.adaptability }), t('report.percent', { pct: a.target })] }))}
      />
      <ChartBlock
        title={t('report.progress.skillsTitle')}
        printAs="table"
        chart={<BarsChart series={series} max={100}
          label={t('report.progress.aria', { list: recent.map(a => t('report.progress.item', { attempt: a.label, score: number(a.score), adaptability: a.adaptability, target: a.target })).join(t('report.listSeparator')) })}
          rows={data.skills.map((s, i) => ({ key: s.key, label: s.name, values: recent.map(a => ({ value: a.skills[i] ?? 0, text: score(a.skills[i]) })) }))} />}
        table={{
          columns: [t('report.skills.title'), ...data.attempts.map(a => a.label)],
          rows: data.skills.map((s, i) => ({ key: s.key, header: s.name, cells: data.attempts.map(a => score(a.skills[i])) }))
        }}
      />
      <SeriesLegend series={series} />
    </section>
  );
}
