import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { useDays } from '../action/days';
import { PanelShell } from './PanelShell';

export interface ActionsListPanelProps {
  view: Pick<EngineView, 'actions' | 'clock'>;
  /** Whether each action can be taken now, worded by the board from the engine's reasons (D41). */
  availability: Record<string, string>;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

/**
 * Every action in one place (D97, 1.0's Actions (i)): what each does, live or instant, for the team or
 * one person, what it costs, how long before it can be taken again, when it unlocks, its options, and
 * whether it can be taken now. All from the engine's view: nothing here decides availability.
 */
export function ActionsListPanel({ view, availability, onClose, returnFocus }: ActionsListPanelProps) {
  const { t } = useI18n();
  const { clock } = view;
  const days = useDays(clock.subPeriodUnit);
  const groups = (['team', 'member'] as const).map(scope => ({ scope, actions: view.actions.filter(a => a.scope === scope) })).filter(g => g.actions.length);
  return (
    <PanelShell title={t('panels.actions.title')} intro={t('panels.actions.intro', { unit: clock.subPeriodUnit, n: clock.capacity, period: clock.periodUnit })} onClose={onClose} returnFocus={returnFocus}>
      {groups.map(g => (
        <section key={g.scope} aria-labelledby={`actions-${g.scope}`} className="flex flex-col gap-2.5">
          <h3 id={`actions-${g.scope}`} className="m-0 text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase">{t('panels.actions.scope', { scope: g.scope })}</h3>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {g.actions.map(a => {
              const facts = [
                t('panels.actions.kind', { kind: a.kind }),
                t('panels.actions.cost', { cost: a.cost === 0 ? t('actions.costNothing') : days(a.cost) }),
                // An action whose options each have their own wait says so per option, below.
                a.cooldown > 0 ? t('panels.actions.cooldown', { amount: days(a.cooldown) }) : a.options.every(o => o.cooldown === 0) ? t('panels.actions.noCooldown') : null,
                a.unlockPeriod > 1 ? t('panels.actions.unlocks', { unit: clock.periodUnit, n: a.unlockPeriod }) : null
              ].filter((x): x is string => !!x);
              const options = a.options.length > 1 ? a.options : [];
              return (
                <li key={a.key} className="flex flex-col gap-1.5 rounded-16 border border-line-default bg-surface-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <b className="text-15">{a.name}</b>
                    <span className="text-12 font-700 text-fg-secondary">{availability[a.key] ?? ''}</span>
                  </div>
                  <p className="m-0 text-14 text-pretty">{a.description}</p>
                  <p className="m-0 text-13 text-fg-secondary">{facts.join(' · ')}</p>
                  {options.length > 0 && (
                    <ul className="m-0 flex list-disc flex-col gap-0.5 ps-5 text-13">
                      {options.map(o => (
                        <li key={o.key}>
                          {o.label}
                          {(o.cost !== a.cost || o.cooldown !== a.cooldown || o.away > 0) && (
                            <span className="text-fg-secondary">{' '}{t('panels.actions.option', {
                              cost: o.cost === 0 ? t('actions.costNothing') : days(o.cost),
                              cooldown: o.cooldown > 0 ? days(o.cooldown) : 'none',
                              away: o.away > 0 ? days(o.away) : 'none'
                            })}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </PanelShell>
  );
}
