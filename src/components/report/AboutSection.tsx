import { useId } from 'react';
import { useI18n } from '../../i18n';
import type { AboutData } from './types';
import './messages';

/** "About this report": the simulation, how to read the report, and the confidentiality note (the 1.0 report's opening pages). */
export function AboutSection({ data }: { data: AboutData }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section aria-labelledby={`${id}h`} className="flex flex-col gap-3">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{t('report.about.title')}</h2>
      <div className="grid gap-4 grid-cols-(--il-report-halves-columns)">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-15 font-700">{t('report.about.simulation')}</h3>
          {data.lines.map(l => <p key={l} className="m-0 text-14 text-pretty">{l}</p>)}
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-15 font-700">{t('report.about.read')}</h3>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-14">
            {data.howToRead.map(l => <li key={l} className="text-pretty">{l}</li>)}
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-16 border border-line-default px-3.5 py-3">
        <h3 className="m-0 text-13 font-700">{t('report.about.confidential')}</h3>
        <p className="m-0 text-13 text-fg-secondary text-pretty">{data.confidentiality}</p>
      </div>
    </section>
  );
}
