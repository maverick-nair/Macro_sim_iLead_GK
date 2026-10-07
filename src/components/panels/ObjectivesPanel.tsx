import { useState } from 'react';
import { engineLetter } from '../../app/EngineOnboarding';
import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { SPONSOR_TABS, type SponsorTab } from '../onboarding/types';
import { PanelHeading, PanelShell } from './PanelShell';

export interface ObjectivesPanelProps {
  view: EngineView;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

type Tab = SponsorTab | 'stages';

/**
 * Objectives during play (D90): the sponsor's welcome letter with its three tabs, as onboarding showed
 * it (the authored letter, or the one worded from the storyline's facts), where the run stands against
 * the target, and every stage with what it does and which skills suit it (1.0's Module Scope, D97).
 */
export function ObjectivesPanel({ view, onClose, returnFocus }: ObjectivesPanelProps) {
  const i18n = useI18n();
  const { t, number } = i18n;
  const money = useMoney();
  const [tab, setTab] = useState<Tab>('welcome');
  const letter = view.storyline.intro ?? engineLetter(i18n, view);
  const { clock } = view;
  const tabs: Array<{ key: Tab; label: string }> = [
    ...SPONSOR_TABS.map(k => ({ key: k as Tab, label: t('onboarding.sponsor.tab', { tab: k }) })),
    { key: 'stages', label: t('panels.objectives.stages') }
  ];
  const pct = view.money.target > 0 ? Math.round(view.money.value / view.money.target * 100) : 0;
  return (
    <PanelShell title={t('panels.objectives.title')} intro={t('panels.objectives.intro', { name: view.sponsor.name })} tabs={tabs} tab={tab} onTab={setTab} onClose={onClose} returnFocus={returnFocus}>
      {tab !== 'stages' && letter[tab].map((p, j) => <p key={j} className="m-0 text-15 leading-(--il-onboarding-sponsor-leading) text-pretty">{p}</p>)}
      {tab === 'targets' && (
        <section aria-labelledby="objectives-now" className="flex flex-col gap-2 rounded-16 border border-line-default bg-surface-raised p-4">
          <PanelHeading id="objectives-now">{t('panels.objectives.now')}</PanelHeading>
          <p className="m-0 text-14">{t('panels.objectives.money', { value: money.format(view.money.value), target: money.format(view.money.target), pct: number(pct) })}</p>
          <p className="m-0 text-14 text-fg-secondary">{t('panels.objectives.time', { unit: clock.periodUnit, n: clock.period, total: clock.periods })}</p>
        </section>
      )}
      {tab === 'stages' && (
        <>
          <p className="m-0 text-14 text-fg-secondary">{t('panels.objectives.stagesIntro', { max: view.maxPerStage })}</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {view.funnel.map(st => (
              <li key={st.key} className="flex flex-col gap-1 rounded-16 border border-line-default bg-surface-card p-4">
                <b className="text-15">{st.name}</b>
                <span className="text-14">{st.about ?? t('panels.stage.noAbout')}</span>
                {st.suits && <span className="text-13 text-fg-secondary"><b className="text-fg-primary">{t('panels.stage.suits')}</b> {st.suits}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </PanelShell>
  );
}
