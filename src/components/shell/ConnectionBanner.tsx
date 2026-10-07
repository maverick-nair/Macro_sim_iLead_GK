import { useSyncExternalStore } from 'react';
import type { ConnectionState } from '../../engine/resilient';
import { useI18n } from '../../i18n';

export interface ConnectionSource {
  state(): ConnectionState;
  subscribe(fn: () => void): () => void;
}

const ALWAYS: ConnectionState = { online: true, pending: 0, retrying: false };
const none = () => () => undefined;

/**
 * Says when the connection is gone (D86): the participant can keep reading and planning, and every
 * action waits, saved on this device, until the connection is back; then they go out in order.
 * A status region that is always mounted, so screen readers hear it appear. Built from the existing
 * notice style (the live screen's time warning); D80 brings the canvas design.
 */
export function ConnectionBanner({ source }: { source: ConnectionSource | null }) {
  const { t } = useI18n();
  const s = useSyncExternalStore(source?.subscribe ?? none, source ? source.state : () => ALWAYS, () => ALWAYS);
  const message = !s.online ? t('app.offline', { count: s.pending }) : s.retrying ? t('app.reconnecting', { count: s.pending }) : '';
  return (
    <div role="status" className={message ? 'absolute top-3 left-1/2 z-50 max-w-(--il-board-panel-max-width) -translate-x-1/2 rounded-14 border border-status-attention bg-status-attention-soft px-3.5 py-2.5 text-center text-13 text-fg-primary' : 'sr-only'}>
      {message}
    </div>
  );
}
