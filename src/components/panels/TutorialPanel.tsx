import { useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { PanelHeading, PanelShell } from './PanelShell';

export interface TutorialPanelProps {
  view: Pick<EngineView, 'storyline' | 'lens' | 'clock'>;
  onClose: () => void;
  /** Replays the guided tour of the board (D94). */
  onTour?: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

type Tab = 'video' | 'transcript' | 'styles';

/**
 * Tutorial and video (D90, D91): the sponsor's welcome video when the storyline has one, replayable,
 * with its captions; its transcript; and the leadership model the run is built on, from the lens: each
 * style, the four needs, and worked examples of which style fits whom and why. The guided tour replays
 * from here too.
 */
export function TutorialPanel({ view, onClose, onTour, returnFocus }: TutorialPanelProps) {
  const { t } = useI18n();
  const video = view.storyline.video ?? null;
  const tabs: Array<{ key: Tab; label: string }> = [
    ...(video?.src ? [{ key: 'video' as const, label: t('panels.tutorial.tab', { tab: 'video' }) }] : []),
    ...(video?.transcript.length ? [{ key: 'transcript' as const, label: t('panels.tutorial.tab', { tab: 'transcript' }) }] : []),
    { key: 'styles', label: t('panels.tutorial.tab', { tab: 'styles' }) }
  ];
  const [tab, setTab] = useState<Tab>(tabs[0].key);
  const { lens } = view;
  const styleOf = (key: string) => lens.styles.find(s => s.key === key);
  const needOf = (key: string) => lens.needs.find(n => n.key === key);
  return (
    <PanelShell title={t('panels.tutorial.title')} intro={t('panels.tutorial.intro', { lens: lens.title })} tabs={tabs} tab={tab} onTab={setTab} onClose={onClose} returnFocus={returnFocus}>
      {tab === 'video' && video?.src && (
        // Captions come with the video when the storyline has a track; the transcript is the next tab either way.
        // eslint-disable-next-line jsx-a11y/media-has-caption -- the captions track is authored when there is one, and the transcript tab carries every word
        <video controls preload="metadata" src={video.src} poster={video.poster} className="aspect-video w-full rounded-16 bg-surface-raised">
          {video.captions && <track kind="captions" src={video.captions} srcLang={view.storyline.locale} label={t('panels.tutorial.captions')} default />}
        </video>
      )}
      {tab === 'transcript' && video && video.transcript.map((p, i) => <p key={i} className="m-0 text-15 leading-(--il-onboarding-sponsor-leading) text-pretty">{p}</p>)}
      {tab === 'styles' && (
        <>
          <p className="m-0 text-14 text-pretty">{t('panels.tutorial.how', { count: lens.styles.length, unit: view.clock.periodUnit })}</p>
          <section aria-labelledby="tutorial-styles" className="flex flex-col gap-2">
            <PanelHeading id="tutorial-styles">{t('panels.tutorial.styles')}</PanelHeading>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lens.styles.map(s => (
                <li key={s.key} className="grid grid-cols-(--il-team-legend-columns) items-start gap-3">
                  <span aria-hidden="true" className={`flex size-8 items-center justify-center rounded-round bg-brand font-700 text-brand-deep-space ${s.letter.length > 1 ? 'text-12' : ''}`}>{s.letter}</span>
                  <span className="flex flex-col"><b>{s.name}</b><span className="text-13 text-fg-secondary">{s.description}</span></span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="tutorial-needs" className="flex flex-col gap-2">
            <PanelHeading id="tutorial-needs">{t('panels.tutorial.needs')}</PanelHeading>
            <p className="m-0 text-14 text-pretty text-fg-secondary">{t('panels.tutorial.needsIntro')}</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 text-large:grid-cols-1">
              {lens.needs.map(n => (
                <li key={n.key} className="flex flex-col rounded-12 bg-surface-raised p-3"><b className="text-14">{n.label}</b><span className="text-13 text-fg-secondary">{n.short}</span></li>
              ))}
            </ul>
          </section>
          {lens.examples.length > 0 && (
            <section aria-labelledby="tutorial-examples" className="flex flex-col gap-2">
              <PanelHeading id="tutorial-examples">{t('panels.tutorial.examples')}</PanelHeading>
              <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                {lens.examples.map((x, i) => (
                  <li key={i} className="flex flex-col gap-1.5 rounded-16 border border-line-default bg-surface-card p-4">
                    <span className="text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase">{t('panels.tutorial.example', { n: i + 1, need: needOf(x.need)?.label ?? '' })}</span>
                    <p className="m-0 text-14 text-pretty">{x.person}</p>
                    <p className="m-0 text-14 text-pretty"><b>{t('panels.tutorial.fits', { style: styleOf(x.style)?.name ?? x.style })}</b> {x.why}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <p className="m-0 text-13 text-fg-secondary">{t('panels.tutorial.diagnose')}</p>
          {onTour && <div><Button variant="secondary" size="md" onClick={onTour}>{t('panels.tutorial.tour')}</Button></div>}
        </>
      )}
    </PanelShell>
  );
}
