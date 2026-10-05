import { useEffect, useMemo, type ReactNode } from 'react';
import { ApiContext, createMockApi } from '../api';
import { App, type AppProps } from '../app/App';
import './gallery.css';

/** One frame on the review canvas: the live app opened at a given state. */
export interface Frame extends AppProps {
  id: string;
  label: string;
  /** Card width, default 1440px. */
  w?: string;
}

export interface FrameGroup {
  id: string;
  title: string;
  frames: Frame[];
}

/** Builds a frame. Every frame except the playable prototype `p1` is frozen. */
export function F(id: string, label: string, o: Omit<Frame, 'id' | 'label'> = {}): Frame {
  return { id, label, frozen: id !== 'p1', ...o, w: o.w ?? '1440px' };
}

/**
 * The review canvas used by the Screens and States pages: numbered sections of
 * side by side frames with stable, linkable ids.
 */
export function FrameCanvas({ intro, groups, flat = false }: { intro: ReactNode; groups: FrameGroup[]; flat?: boolean }) {
  // Frames load instantly from an in memory scenario.
  const api = useMemo(() => createMockApi({ latencyMs: 0 }), []);

  useEffect(() => {
    // Honour a deep link like /screens#b4 once the frames have rendered.
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <ApiContext.Provider value={api}>
      <div className={flat ? 'dv-page dv-flat' : 'dv-page'}>
        {intro}
        {groups.map((g, i) => (
          <section className="dv-turn" id={g.id} key={g.id}>
            <div className="dv-thd">
              <a className="dv-tid" href={'#' + g.id}>{String(i + 1)}</a>
              <span className="dv-tname">{g.title}</span>
            </div>
            <div className="dv-opts">
              {g.frames.map(({ id, label, w, ...appProps }) => (
                <div className="dv-opt" id={id} key={id}>
                  <div className="dv-olabel">
                    <a className="dv-oid" href={'#' + id}>{id}</a>
                    {label}
                  </div>
                  <div className="dv-card" style={{ width: w }}>
                    <div><App {...appProps} /></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ApiContext.Provider>
  );
}
