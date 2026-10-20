import { Component, type ReactNode } from 'react';
import { isChunkError } from '../../../lib/lazyRetry';
import { useAuthorStore } from '../../model/store';
import { BUTTON } from '../kit';
import { useDownloadDraft } from './SafetyNotices';

/** Catches an error below it and renders `fallback` instead of a blank page; `reset` tries again. */
export class Boundary extends Component<{ children: ReactNode; fallback: (error: unknown, reset: () => void) => ReactNode; onError?: (error: unknown) => void }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown) { this.props.onError?.(error); }
  reset = () => this.setState({ error: null });
  render() { return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children; }
}

/** What a failure says, in the author's words: a chunk that did not load, or anything else. */
function Failed({ error, retry, whole }: { error: unknown; retry?: () => void; whole?: boolean }) {
  const download = useDownloadDraft();
  const chunk = isChunkError(error);
  return (
    <div role="alert" className={`flex flex-col items-start gap-3 ${whole ? 'm-auto max-w-140 p-8' : 'p-7'}`}>
      <h1 className="m-0 text-24 font-800">{chunk ? (whole ? 'This page could not load' : 'This section could not load') : 'Something went wrong'}</h1>
      <p className="m-0 text-15 text-author-body">
        {chunk ? 'You may be offline, or GenieKreator was just updated. ' : ''}
        Your draft is saved in this browser{chunk ? '' : ', and nothing you did is lost'}. {retry ? 'Try again, or reload the page.' : 'Reload the page to carry on.'}
      </p>
      <span className="flex flex-wrap gap-2">
        {retry && <button type="button" className={BUTTON.primary} onClick={retry}>Try again</button>}
        <button type="button" className={retry ? BUTTON.secondary : BUTTON.primary} onClick={() => location.reload()}>Reload page</button>
        <button type="button" className={BUTTON.secondary} onClick={download}>Download draft</button>
      </span>
    </div>
  );
}

/**
 * A boundary that saves the draft at once and shows a readable message with Reload and Download
 * draft (D123). `retry` adds Try again (a tab whose chunk failed to load is loaded afresh).
 */
export function AuthorBoundary({ children, retry, whole = false }: { children: ReactNode; retry?: () => void; whole?: boolean }) {
  const store = useAuthorStore();
  return (
    <Boundary onError={e => { store.getState().flush(); console.error('/author stopped on an error', e); }}
      fallback={(error, reset) => <Failed error={error} whole={whole} retry={retry ? () => { retry(); reset(); } : undefined} />}>
      {children}
    </Boundary>
  );
}
