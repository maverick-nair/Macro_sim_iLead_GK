import type { AuthorDraftResponse } from '../../api/author';
import { Tag } from './parts';

export interface PreviewPanelProps {
  preview: AuthorDraftResponse['preview'];
  lensTitle: string;
  secondaryTitle?: string | null;
}

const H3 = 'm-0 text-14 font-700 uppercase tracking-wide text-fg-secondary';

/** Module step 6, the build preview: team size, one sample event, the lens's style names, the scoring dimensions (secondary marked "Report only") and the report sections. */
export function PreviewPanel({ preview, lensTitle, secondaryTitle }: PreviewPanelProps) {
  return (
    <div className="grid gap-5">
      <p className="m-0 text-15">
        <b>{preview.teamSize} team members</b>, led through the <b>{lensTitle}</b> lens{secondaryTitle ? <>, with <b>{secondaryTitle}</b> in the report</> : null}.
      </p>
      <div className="grid gap-2">
        <h3 className={H3}>Sample event</h3>
        <div className="rounded-14 border border-solid border-line-default bg-surface-raised p-3">
          <b className="block">{preview.sampleEvent.title}</b>
          <span className="text-14 text-fg-secondary">{preview.sampleEvent.body}</span>
        </div>
      </div>
      <div className="grid gap-2">
        <h3 className={H3}>Leadership styles</h3>
        <ul aria-label="Leadership styles" className="m-0 grid list-none gap-1.5 p-0">
          {preview.styles.map(s => <li key={s.name} className="text-14"><b>{s.name}.</b> <span className="text-fg-secondary">{s.short}</span></li>)}
        </ul>
      </div>
      <div className="grid gap-2">
        <h3 className={H3}>Scoring dimensions</h3>
        <ul aria-label="Scoring dimensions" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {preview.dimensions.map(d => (
            <li key={d.name} className="inline-flex items-center gap-2 rounded-pill border border-solid border-line-default px-3 py-1 text-14">
              {d.name}{d.reportOnly && <Tag tone="muted">Report only</Tag>}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2">
        <h3 className={H3}>Participant report</h3>
        <p className="m-0 text-14 text-fg-secondary">{preview.reportSections.join(', ')}</p>
      </div>
    </div>
  );
}
