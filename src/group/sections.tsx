import { useId, type ReactNode } from 'react';
import { ChartBlock } from '../components/report/ChartBlock';
import { BarsChart, type BarSeries } from '../components/report/charts';
import { DataTable } from '../components/report/context';
import { impactClass } from '../components/report/display';
import { SeriesLegend } from '../components/report/ResultsSections';
import type { GroupReport } from '../engine/groupContract';
import { useI18n } from '../i18n';
import { WithClientLogo } from '../theme/brand';
import { ShareGridChart, TrendChart, TrendSample, type TrendLook } from './charts';
import './messages';

/**
 * The group report's sections (D75, D77), in the individual report's design language: a heading, a
 * line on what the section shows, the chart with Show as table, the narrative from the group bank, and
 * questions to discuss. Every chart has a table; print shows the table where the chart would not read.
 */

type R = GroupReport;
type Money = (n: number) => string;
const CARD = 'flex flex-col gap-1.5 rounded-16 border border-line-default px-3.5 py-3 text-13';
const H2 = 'm-0 text-20 font-700';
const INTRO = 'm-0 text-13 text-fg-secondary text-pretty';
const BODY = 'm-0 text-14 text-pretty';

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className={H2}>{title}</h2>
      {intro && <p className={INTRO}>{intro}</p>}
      {children}
    </section>
  );
}

/** Questions for the organization to discuss, under a section. */
export function Prompts({ lines }: { lines: string[] }) {
  const { t } = useI18n();
  if (!lines.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-16 bg-surface-raised px-3.5 py-3">
      <h3 className="m-0 text-13 font-700">{t('group.prompts')}</h3>
      <ul className="m-0 flex flex-col gap-1 pl-5 text-13">
        {lines.map(l => <li key={l} className="text-pretty">{l}</li>)}
      </ul>
    </div>
  );
}

const pctText = (n: number | null, none: string) => (n === null ? none : `${Math.round(n)}%`);
const groupSeries = (t: ReturnType<typeof useI18n>['t'], benchmark: boolean): BarSeries[] => [
  { key: 'group', label: t('group.series', { series: 'group' }), look: 'solid' },
  ...(benchmark ? [{ key: 'benchmark', label: t('group.series', { series: 'benchmark' }), look: 'outline' as const }] : [])
];

/** The cover: the client's logo and the wordmark, "Group report", the cohort (the page's h1), the storyline and lens, and the counts. */
export function GroupCover({ report }: { report: R }) {
  const { t, number } = useI18n();
  const date = new Date(`${report.cohort.date}T12:00:00`);
  const when = Number.isNaN(date.getTime()) ? report.cohort.date : date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const boxes = [
    { key: 'participants', value: number(report.participants) },
    { key: 'completed', value: number(report.completed) },
    { key: 'date', value: when }
  ];
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <WithClientLogo className="self-start">
            <span className="self-start bg-(image:--il-fill-brand) bg-clip-text text-20 font-700 tracking-(--il-report-logo-tracking) text-transparent">{t('hud.logo')}</span>
          </WithClientLogo>
          <span className="text-12 font-700 tracking-(--il-tracking-eyebrow-wide) text-fg-secondary uppercase">{t('group.eyebrow', { purpose: report.cohort.purpose })}</span>
          <h1 tabIndex={-1} className="m-0 font-700 outline-0 leading-(--il-report-title-leading) tracking-(--il-report-title-tracking) text-48 text-balance">{report.cohort.name}</h1>
          <span className="text-14 text-fg-secondary">{t('group.cover.line', { storyline: report.cohort.storyline.name, lens: report.cohort.lens.title })}</span>
        </div>
        <dl className="m-0 flex flex-wrap gap-2.5">
          {boxes.map(b => (
            <div key={b.key} className="flex flex-col rounded-18 border border-line-default px-4 py-3">
              <dt className="text-12 text-fg-secondary">{t('group.cover.box', { box: b.key })}</dt>
              <dd className="m-0 text-24 font-700">{b.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="m-0 text-14 text-pretty">{t('group.cover.basis', { n: report.participants })}</p>
    </header>
  );
}

/** Development only: the group is below the minimum size, so aggregates are withheld. */
export function WithheldNotice({ message }: { message: string }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-1.5 rounded-16 border-2 border-status-attention px-4 py-3.5">
      <h2 id={`${id}h`} className="m-0 text-17 font-700">{t('group.withheld.title')}</h2>
      <p className={BODY}>{message}</p>
    </section>
  );
}

/** Assessment: the verdict distribution against the benchmark, and the participant table by name. */
export function VerdictsSection({ data }: { data: NonNullable<R['assessment']> }) {
  const { t, number } = useI18n();
  const hasBenchmark = data.verdicts.some(v => v.benchmark !== null);
  const series = groupSeries(t, hasBenchmark);
  const none = t('group.none');
  return (
    <Section title={t('group.verdicts.title')} intro={t('group.verdicts.bar', { bar: data.bar })}>
      <p className={BODY}>{data.narrative}</p>
      <ChartBlock
        title={t('group.verdicts.chartTitle')}
        chart={<BarsChart series={series} max={100} label={t('group.verdicts.aria', { list: data.verdicts.map(v => t('group.verdicts.item', { label: v.label, pct: Math.round(v.share) })).join(t('report.listSeparator')) })}
          rows={data.verdicts.map(v => ({ key: v.key, label: v.label, values: [{ value: v.share, text: `${Math.round(v.share)}% · ${number(v.count)}` }, ...(hasBenchmark ? [{ value: v.benchmark ?? 0, text: pctText(v.benchmark, none) }] : [])] }))} />}
        table={{
          columns: [t('group.verdicts.column', { column: 'verdict' }), t('group.verdicts.column', { column: 'count' }), t('group.verdicts.column', { column: 'share' }), ...(hasBenchmark ? [t('group.verdicts.column', { column: 'benchmark' })] : [])],
          rows: data.verdicts.map(v => ({ key: v.key, header: v.label, cells: [number(v.count), pctText(v.share, none), ...(hasBenchmark ? [pctText(v.benchmark, none)] : [])] }))
        }}
      />
      <SeriesLegend series={series} />
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0 text-15 font-700">{t('group.verdicts.participantsTitle')}</h3>
        <p className="m-0 text-12 text-fg-secondary">{t('group.verdicts.participantsNote')}</p>
        <DataTable
          caption={t('group.verdicts.participantsTitle')}
          columns={(['name', 'completion', 'level', 'verdict', 'review'] as const).map(c => t('group.verdicts.participantColumn', { column: c }))}
          rows={data.participants.map((p, i) => ({ key: `${i}${p.name}`, header: p.name, cells: [`${Math.round(p.completion)}%`, p.level ?? t('group.verdicts.noLevel'), p.label ?? none, t('group.verdicts.review', { review: p.review })] }))}
        />
      </div>
    </Section>
  );
}

/** Skills: the group's average out of 10 beside the benchmark's, with levels, and a narrative per skill. */
export function SkillsSection({ data, participants }: { data: NonNullable<R['skills']>; participants: number }) {
  const { t, number } = useI18n();
  const hasBenchmark = data.rows.some(s => s.benchmark !== null);
  const series = groupSeries(t, hasBenchmark);
  const noLevel = t('group.skills.noLevel');
  const value = (s: { outOf10: number | null; level: { name: string } | null } | null) => (s?.outOf10 == null ? noLevel : t('group.skills.value', { score: number(s.outOf10), level: s.level?.name ?? noLevel }));
  return (
    <Section title={t('group.skills.title')} intro={t('group.skills.intro')}>
      <p className="m-0 text-12 text-fg-secondary">{t('group.skills.levels', { list: data.scale.map(l => t('group.skills.levelFrom', { name: l.name, min: number(l.min / 10) })).join(t('report.listSeparator')) })}</p>
      <ChartBlock
        title={t('group.skills.chartTitle')}
        chart={<BarsChart series={series} max={10}
          label={t('group.skills.aria', { list: data.rows.map(s => t('group.skills.item', { skill: s.name, group: value(s.group), benchmark: hasBenchmark ? value(s.benchmark) : t('group.noBenchmark') })).join(t('report.listSeparator')) })}
          rows={data.rows.map(s => ({ key: s.key, label: s.name, values: [{ value: s.group.outOf10 ?? 0, text: value(s.group) }, ...(hasBenchmark ? [{ value: s.benchmark?.outOf10 ?? 0, text: value(s.benchmark) }] : [])] }))} />}
        table={{
          columns: [t('group.skills.column', { column: 'skill' }), t('group.skills.column', { column: 'group' }), t('group.skills.column', { column: 'groupLevel' }), ...(hasBenchmark ? [t('group.skills.column', { column: 'benchmark' }), t('group.skills.column', { column: 'benchmarkLevel' })] : [])],
          rows: data.rows.map(s => ({ key: s.key, header: s.name, cells: [s.group.outOf10 === null ? noLevel : number(s.group.outOf10), s.group.level?.name ?? noLevel,
            ...(hasBenchmark ? [s.benchmark?.outOf10 == null ? noLevel : number(s.benchmark.outOf10), s.benchmark?.level?.name ?? noLevel] : [])] }))
        }}
      />
      <SeriesLegend series={series} />
      <div className="grid gap-2.5 grid-cols-(--il-report-halves-columns)">
        {data.rows.map(s => (
          <article key={s.key} aria-label={s.name} className={CARD}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="m-0 text-15 font-700">{s.name}</h3>
              <span className="flex items-center gap-2 text-12 font-700">
                {s.reportOnly && <span className="rounded-pill bg-surface-raised px-2 py-0.5 text-fg-secondary">{t('report.skills.reportOnly')}</span>}
                {value(s.group)}
              </span>
            </div>
            {s.description && <p className="m-0 text-fg-secondary text-pretty">{s.description}</p>}
            <p className="m-0 text-pretty">{s.narrative}</p>
            {s.compare && <p className="m-0 font-600 text-pretty">{s.compare}</p>}
            <span className="text-12 text-fg-secondary">{t('group.skills.rated', { n: s.group.rated, total: participants })}</span>
          </article>
        ))}
      </div>
      <Prompts lines={data.prompts} />
    </Section>
  );
}

/** The share of the group at each level, per skill: a grid of percentages; print shows the table. */
export function DistributionSection({ data }: { data: NonNullable<R['skills']> }) {
  const { t, number } = useI18n();
  const columns = [...data.scale.map(l => l.name), t('group.distribution.none')];
  const rows = data.rows.map(s => ({ key: s.key, label: s.name, cells: [...s.distribution.map(d => d.share), s.unrated.share] }));
  return (
    <Section title={t('group.distribution.title')} intro={t('group.distribution.intro')}>
      <ChartBlock
        title={t('group.distribution.chartTitle')}
        printAs="table"
        chart={<ShareGridChart rows={rows} columns={columns} label={t('group.distribution.aria', { n: rows.length })} />}
        table={{ columns: [t('group.skills.column', { column: 'skill' }), ...columns], rows: rows.map(r => ({ key: r.key, header: r.label, cells: r.cells.map(v => `${number(Math.round(v * 10) / 10)}%`) })) }}
      />
    </Section>
  );
}

/** Completion: participants by how much of the simulation they completed. */
export function CompletionSection({ data }: { data: NonNullable<R['completion']> }) {
  const { t, number } = useI18n();
  const series: BarSeries[] = [{ key: 'share', label: t('group.completion.column', { column: 'share' }), look: 'solid' }];
  const bucket = (k: string) => t('group.completion.bucket', { key: k });
  return (
    <Section title={t('group.completion.title')} intro={t('group.completion.intro')}>
      <p className={BODY}>{data.narrative}</p>
      <ChartBlock
        title={t('group.completion.chartTitle')}
        chart={<BarsChart series={series} max={100} label={t('group.completion.aria', { list: data.buckets.map(b => t('group.completion.item', { bucket: bucket(b.key), pct: Math.round(b.share) })).join(t('report.listSeparator')) })}
          rows={data.buckets.map(b => ({ key: b.key, label: bucket(b.key), values: [{ value: b.share, text: t('group.completion.value', { pct: Math.round(b.share), n: number(b.count) }) }] }))} />}
        table={{
          columns: [t('group.completion.column', { column: 'completed' }), t('group.completion.column', { column: 'participants' }), t('group.completion.column', { column: 'share' })],
          rows: data.buckets.map(b => ({ key: b.key, header: bucket(b.key), cells: [number(b.count), `${Math.round(b.share)}%`] }))
        }}
      />
    </Section>
  );
}

/** Business: best and average revenue against the target and the benchmark, conversions, who beat the target, and the team at the end. */
export function BusinessSection({ data, money }: { data: NonNullable<R['business']>; money: Money }) {
  const { t, number } = useI18n();
  const b = data.benchmark;
  const tiles: Array<{ key: string; value: string; note?: string }> = [
    { key: 'best', value: money(data.best.revenue), note: t('group.business.ofTarget', { pct: Math.round(data.best.share), target: money(data.target) }) },
    { key: 'revenue', value: money(data.average.revenue), note: b ? t('group.business.benchmark', { value: money(b.revenue) }) : undefined },
    { key: 'conversions', value: number(Math.round(data.average.conversions * 10) / 10), note: b ? t('group.business.benchmark', { value: number(Math.round(b.conversions * 10) / 10) }) : undefined },
    { key: 'beat', value: `${Math.round(data.beatTarget.share)}%`, note: data.beatTarget.benchmark !== null ? t('group.business.benchmark', { value: `${Math.round(data.beatTarget.benchmark)}%` }) : undefined }
  ];
  const hasBenchmark = data.team.some(k => k.benchmark !== null);
  const series = groupSeries(t, hasBenchmark);
  const metric = (k: string) => t('group.business.metric', { metric: k });
  const v = (n: number) => number(Math.round(n));
  return (
    <Section title={t('group.business.title')} intro={t('group.business.intro')}>
      <p className={BODY}>{data.narrative}</p>
      <dl className="m-0 grid gap-2.5 grid-cols-(--il-report-tiles-columns)">
        {tiles.map(x => (
          <div key={x.key} className={CARD}>
            <dt className="text-12 text-fg-secondary">{t('group.business.tile', { tile: x.key })}</dt>
            <dd className="m-0 flex flex-col">
              <b className="text-22">{x.value}</b>
              {x.note && <span className="text-12 text-fg-secondary">{x.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <ChartBlock
        title={t('group.business.teamTitle')}
        chart={<BarsChart series={series} max={100}
          label={t('group.business.teamAria', { list: data.team.map(k => t('group.business.teamItem', { metric: metric(k.key), group: v(k.group.end), benchmark: k.benchmark ? v(k.benchmark.end) : t('group.noBenchmark') })).join(t('report.listSeparator')) })}
          rows={data.team.map(k => ({ key: k.key, label: metric(k.key), values: [{ value: k.group.end, text: v(k.group.end) }, ...(hasBenchmark ? [{ value: k.benchmark?.end ?? 0, text: k.benchmark ? v(k.benchmark.end) : t('group.none') }] : [])] }))} />}
        table={{
          columns: [t('group.business.column', { column: 'measure' }), t('group.business.column', { column: 'start' }), t('group.business.column', { column: 'group' }), ...(hasBenchmark ? [t('group.business.column', { column: 'benchmark' })] : [])],
          rows: data.team.map(k => ({ key: k.key, header: metric(k.key), cells: [v(k.group.start), v(k.group.end), ...(hasBenchmark ? [k.benchmark ? v(k.benchmark.end) : t('group.none')] : [])] }))
        }}
      />
      <SeriesLegend series={series} />
      <Prompts lines={data.prompts} />
    </Section>
  );
}

function Meter({ who, pct }: { who: 'group' | 'benchmark'; pct: number }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-12 text-fg-secondary">{t('group.adaptability.label', { who })}</span>
      <b className={who === 'group' ? 'text-40 font-700' : 'text-28 font-700'}>{`${Math.round(pct)}%`}</b>
      <div role="img" aria-label={t('group.adaptability.aria', { who, pct: Math.round(pct) })} className="h-(--il-report-meter-height) w-60 overflow-hidden rounded-pill bg-track">
        <div className={`h-full rounded-pill ${who === 'group' ? 'bg-accent-default' : 'border-2 border-accent-default'}`} style={{ inlineSize: `${pct}%` }}></div>
      </div>
    </div>
  );
}

/** Leadership style adaptability against the benchmark, and the styles participants used most. */
export function AdaptabilitySection({ data }: { data: NonNullable<R['styles']> }) {
  const { t } = useI18n();
  const a = data.adaptability;
  const hasBenchmark = data.preferred.some(p => p.benchmark !== null);
  const series = groupSeries(t, hasBenchmark);
  const none = t('group.none');
  const name = (k: string) => data.styles.find(s => s.key === k)?.name ?? k;
  return (
    <Section title={t('group.adaptability.title')} intro={t('group.adaptability.intro')}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <Meter who="group" pct={a.group} />
        {a.benchmark !== null && <Meter who="benchmark" pct={a.benchmark} />}
      </div>
      <p className={BODY}>{a.narrative}</p>
      {a.compare && <p className="m-0 text-14 font-600">{a.compare}</p>}
      <h3 className="m-0 text-17 font-700">{t('group.adaptability.preferredTitle')}</h3>
      <ChartBlock
        title={t('group.adaptability.preferredChart')}
        chart={<BarsChart series={series} max={100}
          label={t('group.adaptability.preferredAria', { list: data.preferred.map(p => t('group.adaptability.preferredItem', { style: name(p.key), group: Math.round(p.share), benchmark: pctText(p.benchmark, none) })).join(t('report.listSeparator')) })}
          rows={data.preferred.map(p => ({ key: p.key, label: name(p.key), values: [{ value: p.share, text: `${Math.round(p.share)}%` }, ...(hasBenchmark ? [{ value: p.benchmark ?? 0, text: pctText(p.benchmark, none) }] : [])] }))} />}
        table={{
          columns: [t('group.styles.column', { column: 'style' }), t('group.series', { series: 'group' }), ...(hasBenchmark ? [t('group.series', { series: 'benchmark' })] : [])],
          rows: data.preferred.map(p => ({ key: p.key, header: name(p.key), cells: [`${Math.round(p.share)}%`, ...(hasBenchmark ? [pctText(p.benchmark, none)] : [])] }))
        }}
      />
      <SeriesLegend series={series} />
      {data.preferredNarrative && <p className="m-0 text-14 font-600 text-pretty">{data.preferredNarrative}</p>}
      {data.preferredTop.map(k => {
        const s = data.styles.find(x => x.key === k);
        return s ? <p key={k} className={INTRO}>{`${s.name}: ${s.description}`}</p> : null;
      })}
      <Prompts lines={data.prompts} />
    </Section>
  );
}

/** Each style: proportion and accuracy (with the benchmark's), what people needed, and its narrative. */
export function StylesSection({ data }: { data: NonNullable<R['styles']> }) {
  const { t } = useI18n();
  const series: BarSeries[] = [{ key: 'proportion', label: t('group.series', { series: 'proportion' }), look: 'solid' }, { key: 'accuracy', label: t('group.series', { series: 'accuracy' }), look: 'hatch' }];
  const notUsed = t('report.styles.notUsed');
  const name = (k: string) => data.styles.find(s => s.key === k)?.name ?? k;
  const hasBenchmark = data.perStyle.some(s => s.benchmark !== null);
  return (
    <Section title={t('group.styles.title')} intro={t('group.styles.intro')}>
      <ChartBlock
        title={t('group.styles.chartTitle')}
        chart={<BarsChart series={series} max={100}
          label={t('group.styles.aria', { list: data.perStyle.map(s => t('group.styles.item', { style: name(s.key), proportion: Math.round(s.proportion), accuracy: pctText(s.accuracy, notUsed) })).join(t('report.listSeparator')) })}
          rows={data.perStyle.map(s => ({ key: s.key, label: name(s.key), values: [{ value: s.proportion, text: `${Math.round(s.proportion)}%` }, { value: s.accuracy ?? 0, text: pctText(s.accuracy, notUsed) }] }))} />}
        table={{
          columns: [t('group.styles.column', { column: 'style' }), t('group.styles.column', { column: 'proportion' }), t('group.styles.column', { column: 'accuracy' }), t('group.styles.column', { column: 'needed' }),
            ...(hasBenchmark ? [t('group.styles.column', { column: 'benchmarkProportion' }), t('group.styles.column', { column: 'benchmarkAccuracy' })] : [])],
          rows: data.perStyle.map(s => ({ key: s.key, header: name(s.key), cells: [`${Math.round(s.proportion)}%`, pctText(s.accuracy, notUsed), `${Math.round(s.neededShare)}%`,
            ...(hasBenchmark ? [pctText(s.benchmark?.proportion ?? null, t('group.none')), pctText(s.benchmark?.accuracy ?? null, notUsed)] : [])] }))
        }}
      />
      <SeriesLegend series={series} />
      <div className="grid gap-2.5 grid-cols-(--il-report-tiles-columns)">
        {data.perStyle.map(s => (
          <article key={s.key} aria-label={name(s.key)} className={CARD}>
            <h3 className="m-0 text-15 font-700">{name(s.key)}</h3>
            <span className="flex flex-wrap gap-x-3 text-12 font-600 text-fg-secondary">
              <span>{t('report.styles.proportion', { pct: Math.round(s.proportion) })}</span>
              <span>{t('report.styles.accuracy', { used: String(s.accuracy !== null), pct: Math.round(s.accuracy ?? 0) })}</span>
              <span>{t('group.styles.needed', { pct: Math.round(s.neededShare) })}</span>
            </span>
            {s.benchmark && <span className="text-12 text-fg-secondary">{t('group.styles.benchmark', { proportion: `${Math.round(s.benchmark.proportion)}%`, accuracy: pctText(s.benchmark.accuracy, notUsed) })}</span>}
            {s.narrative.map(l => <p key={l} className="m-0 text-pretty">{l}</p>)}
          </article>
        ))}
      </div>
    </Section>
  );
}

/** Consistency: needed against used, intended against used, needed against intended, group and benchmark. */
export function ConsistencySection({ data }: { data: NonNullable<R['consistency']> }) {
  const { t } = useI18n();
  const none = t('report.consistency.none');
  const measure = (k: string) => t('report.consistency.measure', { key: k });
  const hasBenchmark = data.deviations.some(d => d.benchmark !== null);
  const series = groupSeries(t, hasBenchmark);
  return (
    <Section title={t('group.consistency.title')} intro={t('group.consistency.intro', { actions: data.actions.join(t('report.listSeparator')) })}>
      <div className="grid gap-2.5 grid-cols-(--il-report-tiles-columns)">
        {data.deviations.map(d => (
          <article key={d.key} aria-label={measure(d.key)} className={CARD}>
            <h3 className="m-0 text-15 font-700">{measure(d.key)}</h3>
            <b className="text-22">{t('report.consistency.deviation', { has: String(d.group !== null), pct: Math.round(d.group ?? 0) })}</b>
            {d.benchmark !== null && <span className="text-12 text-fg-secondary">{t('group.business.benchmark', { value: `${Math.round(d.benchmark)}%` })}</span>}
            <span className="text-12 text-fg-secondary text-pretty">{t('report.consistency.explain', { key: d.key })}</span>
            {d.narrative && <p className="m-0 text-pretty">{d.narrative}</p>}
          </article>
        ))}
      </div>
      <ChartBlock
        title={t('group.consistency.chartTitle')}
        printAs="table"
        chart={<BarsChart series={series} max={100}
          label={t('group.consistency.aria', { list: data.deviations.map(d => t('group.consistency.item', { measure: measure(d.key), group: pctText(d.group, none), benchmark: pctText(d.benchmark, none) })).join(t('report.listSeparator')) })}
          rows={data.deviations.map(d => ({ key: d.key, label: measure(d.key), values: [{ value: d.group ?? 0, text: pctText(d.group, none) }, ...(hasBenchmark ? [{ value: d.benchmark ?? 0, text: pctText(d.benchmark, none) }] : [])] }))} />}
        table={{
          columns: [t('report.objectives.column', { column: 'measure' }), t('group.series', { series: 'group' }), ...(hasBenchmark ? [t('group.series', { series: 'benchmark' })] : [])],
          rows: data.deviations.map(d => ({ key: d.key, header: measure(d.key), cells: [pctText(d.group, none), ...(hasBenchmark ? [pctText(d.benchmark, none)] : [])] }))
        }}
      />
      <SeriesLegend series={series} />
    </Section>
  );
}

/** The funnel's last stage, period by period: the ideal, the group and the benchmark. */
export function FunnelSection({ data, unit }: { data: NonNullable<R['funnel']>; unit: string }) {
  const { t, number } = useI18n();
  const hasBenchmark = data.periods.some(p => p.benchmark !== null);
  const fmt = (n: number) => number(Math.round(n * 100) / 100);
  const periods = data.periods.map(p => t('group.funnel.period', { unit, n: p.period }));
  const series: Array<{ key: string; label: string; look: TrendLook; values: number[] }> = [
    { key: 'ideal', label: t('group.series', { series: 'ideal' }), look: 'dashed', values: data.periods.map(p => p.ideal) },
    { key: 'actual', label: t('group.series', { series: 'actual' }), look: 'solid', values: data.periods.map(p => p.actual) },
    ...(hasBenchmark ? [{ key: 'benchmark', label: t('group.series', { series: 'benchmark' }), look: 'dotted' as const, values: data.periods.map(p => p.benchmark ?? 0) }] : [])
  ];
  const title = t('group.funnel.chartTitle', { stage: data.stage, unit });
  return (
    <Section title={t('group.funnel.title')} intro={t('group.funnel.intro', { unit })}>
      {data.narrative && <p className={BODY}>{data.narrative}</p>}
      <ChartBlock
        title={title}
        chart={<TrendChart periods={periods.map((_, i) => String(data.periods[i].period))} series={series} format={fmt}
          label={t('group.funnel.aria', { stage: data.stage, unit, list: data.periods.map((p, i) => t('group.funnel.item', { period: periods[i], ideal: fmt(p.ideal), actual: fmt(p.actual) })).join(t('report.listSeparator')) })} />}
        table={{
          columns: [t('group.funnel.unit', { unit }), ...series.map(s => s.label)],
          rows: data.periods.map((p, i) => ({ key: String(p.period), header: periods[i], cells: [fmt(p.ideal), fmt(p.actual), ...(hasBenchmark ? [p.benchmark === null ? t('group.none') : fmt(p.benchmark)] : [])] }))
        }}
      />
      <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-12 text-fg-secondary">
        {series.map(s => <li key={s.key} className="flex items-center gap-1.25"><TrendSample look={s.look} />{s.label}</li>)}
      </ul>
      <Prompts lines={data.prompts} />
    </Section>
  );
}

/** Actions: times taken per participant with the impact written beside each bar, and the benchmark's frequency. */
export function ActionsSection({ data }: { data: NonNullable<R['actions']> }) {
  const { t, number } = useI18n();
  const impact = (b: string) => t('report.actions.impact', { impact: b });
  const hasBenchmark = data.rows.some(r => r.benchmark !== null);
  const series = groupSeries(t, hasBenchmark);
  const f = (n: number) => number(Math.round(n * 10) / 10);
  return (
    <Section title={t('group.actions.title')} intro={t('group.actions.intro')}>
      {data.narrative && <p className={BODY}>{data.narrative}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-fg-secondary">
        <span className="font-700">{t('report.distribution.legend')}</span>
        {(['none', 'veryLow', 'low', 'moderate', 'high'] as const).map(b => (
          <span key={b} className="flex items-center gap-1.25 whitespace-nowrap"><span aria-hidden="true" className={`size-3.5 shrink-0 rounded-4 ${impactClass(b)}`}></span>{impact(b)}</span>
        ))}
      </div>
      <ChartBlock
        title={t('group.actions.chartTitle')}
        chart={<BarsChart series={series}
          label={t('group.actions.aria', { list: data.rows.map(r => t('group.actions.item', { action: r.name, n: f(r.frequency), impact: impact(r.impact) })).join(t('report.listSeparator')) })}
          rows={data.rows.map(r => ({ key: r.key, label: r.name, values: [{ value: r.frequency, text: `${f(r.frequency)}${t('report.separator')}${impact(r.impact)}` }, ...(hasBenchmark ? [{ value: r.benchmark ?? 0, text: r.benchmark === null ? t('group.none') : f(r.benchmark) }] : [])] }))} />}
        table={{
          columns: (['action', 'frequency', 'used', 'impact', ...(hasBenchmark ? ['benchmark'] : [])]).map(c => t('group.actions.column', { column: c })),
          rows: data.rows.map(r => ({ key: r.key, header: r.name, cells: [f(r.frequency), `${Math.round(r.used)}%`, impact(r.impact), ...(hasBenchmark ? [r.benchmark === null ? t('group.none') : f(r.benchmark)] : [])] }))
        }}
      />
      <SeriesLegend series={series} />
      <div className="grid gap-2 grid-cols-(--il-report-tiles-columns)">
        {data.rows.filter(r => r.frequency > 0).map(r => (
          <div key={r.key} className="flex items-center justify-between gap-2 rounded-12 border border-line-default px-3 py-2 text-13">
            <span className="font-600">{r.name}</span>
            <span className="flex items-center gap-1.25 whitespace-nowrap text-12"><span aria-hidden="true" className={`size-3.5 shrink-0 rounded-4 ${impactClass(r.impact)}`}></span>{impact(r.impact)}</span>
          </div>
        ))}
      </div>
      <Prompts lines={data.prompts} />
    </Section>
  );
}

/** Management style: one to one time with top, average and bottom performers, group and benchmark. */
export function AttentionSection({ data }: { data: NonNullable<R['attention']> }) {
  const { t } = useI18n();
  const bands = ['top', 'average', 'bottom'] as const;
  const band = (b: string) => t('group.attention.band', { band: b });
  const hasBenchmark = data.benchmark !== null;
  const series = groupSeries(t, hasBenchmark);
  const none = t('group.none');
  return (
    <Section title={t('group.attention.title')} intro={t('group.attention.intro')}>
      <ul className="m-0 flex flex-col gap-1 pl-5 text-13 text-fg-secondary">
        {bands.map(b => <li key={b} className="text-pretty">{t('group.attention.define', { band: b })}</li>)}
      </ul>
      {data.group ? (
        <>
          {data.narrative && <p className={BODY}>{data.narrative}</p>}
          <ChartBlock
            title={t('group.attention.chartTitle')}
            chart={<BarsChart series={series} max={100}
              label={t('group.attention.aria', { list: bands.map(b => t('group.attention.item', { band: band(b), group: pctText(data.group![b], none), benchmark: pctText(data.benchmark?.[b] ?? null, none) })).join(t('report.listSeparator')) })}
              rows={bands.map(b => ({ key: b, label: band(b), values: [{ value: data.group![b], text: pctText(data.group![b], none) }, ...(hasBenchmark ? [{ value: data.benchmark![b], text: pctText(data.benchmark![b], none) }] : [])] }))} />}
            table={{
              columns: [t('report.objectives.column', { column: 'measure' }), t('group.series', { series: 'group' }), ...(hasBenchmark ? [t('group.series', { series: 'benchmark' })] : [])],
              rows: bands.map(b => ({ key: b, header: band(b), cells: [pctText(data.group![b], none), ...(hasBenchmark ? [pctText(data.benchmark![b], none)] : [])] }))
            }}
          />
          <SeriesLegend series={series} />
        </>
      ) : <p className={BODY}>{t('group.attention.none')}</p>}
      <Prompts lines={data.prompts} />
    </Section>
  );
}

/** Key takeaways: organizational questions, section by section. */
export function TakeawaysSection({ data }: { data: R['takeaways'] }) {
  const { t } = useI18n();
  return (
    <Section title={t('group.takeaways.title')} intro={t('group.takeaways.intro')}>
      <div className="grid gap-2.5 grid-cols-(--il-report-halves-columns)">
        {data.map(g => (
          <article key={g.key} aria-label={g.title} className={CARD}>
            <h3 className="m-0 text-15 font-700">{g.title}</h3>
            <ul className="m-0 flex flex-col gap-1 pl-5 text-13">
              {g.questions.map(q => <li key={q} className="text-pretty">{q}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  );
}
