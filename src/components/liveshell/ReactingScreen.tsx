import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { shortNameOf, type LivePerson } from './types';

export interface ReactingScreenProps {
  /** The people taking in what you said. The first is the person you spoke to, drawn larger. */
  people: LivePerson[];
  /** The evaluation is taking longer than usual: offers Keep waiting and Retry. */
  slow?: boolean;
  onKeepWaiting?: () => void;
  onRetry?: () => void;
}

/**
 * "The team is reacting": shown for a few seconds while the engine evaluates a live interaction,
 * with the faces of the people it touched pulsing in turn.
 */
export function ReactingScreen({ people, slow = false, onKeepWaiting, onRetry }: ReactingScreenProps) {
  const { t } = useI18n();
  const names = people.map(shortNameOf);
  const lead = t('liveshell.reacting.lead', {
    count: names.length,
    rest: names.slice(0, -1).join(t('liveshell.reacting.separator')),
    last: names[names.length - 1] ?? ''
  });
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-7 p-8 text-center">
      <div className="flex gap-5">
        {people.map((person, i) => (
          <div key={person.id} className={`relative ${i === 0 ? 'size-30' : 'size-22'}`}>
            <div aria-hidden="true" className="absolute -inset-1.5 animate-(--il-liveshell-reacting-ring) rounded-round border-2 border-solid border-accent-secondary"
              style={{ animationDelay: `calc(var(--il-liveshell-reacting-stagger) * ${i})` }} />
            <div className="size-full overflow-hidden rounded-round border-2 border-solid border-line-strong bg-(image:--il-fill-portrait-calm)">
              {person.img && <img src={person.img} alt={person.name} className="size-full object-cover object-top mix-blend-multiply" />}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 text-28 font-700 tracking-(--il-liveshell-reacting-title-tracking)">{t('liveshell.reacting.title')}</h2>
        <span className="text-15 text-fg-secondary">{lead}</span>
      </div>
      {slow && (
        <div className="flex flex-col items-center gap-3 rounded-16 border border-line-default bg-surface-card px-5 py-4">
          <span className="text-13 text-fg-secondary">{t('liveshell.reacting.slow')}</span>
          <div className="flex gap-2">
            <NoWrapButton variant="secondary" size="sm" onClick={onKeepWaiting}>{t('liveshell.reacting.wait')}</NoWrapButton>
            <NoWrapButton variant="primary" size="sm" onClick={onRetry}>{t('liveshell.reacting.retry')}</NoWrapButton>
          </div>
        </div>
      )}
    </div>
  );
}
