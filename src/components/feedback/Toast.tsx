export interface ToastProps {
  /** The confirmation to show, or null when nothing is showing. Text from the caller. */
  message: string | null;
}

/**
 * The bottom pill that confirms an action ("Report sent to your work email."). The status region
 * stays mounted, empty and invisible, so screen readers announce each new message politely; the
 * pill only draws while there is a message. The app clears it after a few seconds.
 */
export function Toast({ message }: ToastProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="absolute bottom-6 left-1/2 z-60 max-w-(--il-toast-max-width) -translate-x-1/2 text-center">
      {message && (
        <div className="animate-(--il-toast-enter) rounded-pill bg-(color:--il-toast-bg) px-4.5 py-3 text-13 font-600 text-(color:--il-toast-fg)">{message}</div>
      )}
    </div>
  );
}
