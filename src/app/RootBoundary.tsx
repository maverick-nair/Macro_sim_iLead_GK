import { Component, type ReactNode } from 'react';
import { isChunkError } from '../lib/lazyRetry';

/**
 * The last line under every route (D123): an error anywhere below shows a short message with Reload
 * instead of a blank page. Kept small and plain (no tokens, no theme) so it is safe on every route and
 * light in the participant's first load. Routes with their own boundary (/author) catch first.
 */
export class RootBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown) { console.error('The page stopped on an error', error); }
  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkError(this.state.error);
    return (
      <div role="alert" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'Canvas', color: 'CanvasText', font: '16px/1.5 system-ui, sans-serif' }}>
        <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{chunk ? 'Part of this page could not load' : 'Something went wrong'}</h1>
          <p style={{ margin: 0 }}>{chunk ? 'You may be offline, or the app was just updated. Check your connection, then reload.' : 'Reload the page to try again.'}</p>
          <button type="button" onClick={() => location.reload()} style={{ alignSelf: 'flex-start', minHeight: 44, padding: '0 20px', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Reload</button>
        </div>
      </div>
    );
  }
}
