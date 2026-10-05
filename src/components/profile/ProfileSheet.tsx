import { useI18n } from '../../i18n';
import { ActionTile } from '../action/ActionTile';
import { SubPeriodUnitContext } from '../action/days';
import { LOW_BELOW } from '../metric/MetricBar';
import { backdrop, PromiseLine, STATS, TimelineItem, type ProfilePanelProps } from './ProfilePanel';

/** The profile in one column for a phone's sheet: who they are, your interactions with them, then actions. */
export function ProfileSheet({ title, img, mood, away = false, stats, style, facts, shared, periodUnit, subPeriodUnit, timeline, promises, actions, name }: ProfilePanelProps) {
  const { t, number } = useI18n();
  const factRow = (label: string, value: string) => (
    <div key={label} className="grid grid-cols-(--il-profile-fact-columns) gap-2.5 text-13"><span className="text-fg-secondary">{label}</span><span className="min-w-0 break-words">{value}</span></div>
  );
  return (
    <div className="flex flex-col gap-4 px-(--il-phone-gutter-x) pt-3">
      <div className="flex items-center gap-3.5">
        <div className={`size-20 flex-none overflow-hidden rounded-round shadow-(--il-profile-portrait-ring) ${backdrop(mood, away)}`}>
          <img src={img} alt="" className={`size-full object-cover object-top mix-blend-multiply ${away ? 'grayscale' : ''}`} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-13 text-pretty text-fg-secondary">{title}</span>
          <span className="text-13 font-700">{away ? t('member.mood.away') : t('member.mood', { mood })}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {STATS.map(k => (
          <div key={k} className="flex flex-col rounded-12 bg-surface-raised p-2.5">
            <span className="text-12 text-fg-secondary">{t('metric.name', { metric: k })}</span>
            <b className={`text-20 ${stats[k] < LOW_BELOW ? 'text-status-attention' : 'text-fg-primary'}`}>{number(stats[k])}</b>
          </div>
        ))}
      </div>
      {shared && <div className="rounded-12 bg-accent-soft px-3 py-2.5 text-13"><b>{t('profile.shared')}</b> {shared}</div>}
      {factRow(t('profile.fact.label', { key: 'style', unit: periodUnit }), style ? t('style.name', { style }) : t('profile.fact.empty', { key: 'style' }))}
      {facts.map(f => factRow(t('profile.fact.label', { key: f.key, unit: periodUnit }), f.value ?? t('profile.fact.empty', { key: f.key })))}
      <h3 className="m-0 pt-2 text-18 font-700">{t('profile.actions.title')}</h3>
      <SubPeriodUnitContext.Provider value={subPeriodUnit}>
        <div className="flex flex-col gap-2">{actions.map((a, i) => <ActionTile key={`${a.name}:${i}`} layout="compact" {...a} />)}</div>
      </SubPeriodUnitContext.Provider>
      <h3 className="m-0 pt-2 text-18 font-700">{t('profile.interactions.title')}</h3>
      {timeline.length === 0
        ? <p className="m-0 text-13 text-fg-secondary">{t('profile.interactions.empty', { name })}</p>
        : <ol className="m-0 flex list-none flex-col p-0">{timeline.map(e => <TimelineItem key={e.id} entry={e} periodUnit={periodUnit} subPeriodUnit={subPeriodUnit} />)}</ol>}
      {promises.map((p, i) => <PromiseLine key={i} promise={p} />)}
    </div>
  );
}

