import { useI18n } from '../../i18n';

/** "Setting up your office": the logo over a shimmering bar while the session loads. */
export function LoadingScreen() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 [min-height:inherit]">
      <span className="bg-(image:--il-fill-brand) bg-clip-text text-28 font-700 tracking-(--il-app-logo-tracking) text-transparent">{t('hud.logo')}</span>
      <div className="h-1.5 w-55 animate-(--il-app-loading-shimmer) rounded-3 bg-(image:--il-app-loading-track) bg-size-(--il-app-loading-track-size)" />
      <span role="status" className="text-13 text-fg-secondary">{t('app.loading')}</span>
    </div>
  );
}
