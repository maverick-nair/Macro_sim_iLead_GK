import { createContext, useContext, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import type { ReportLayout } from './types';
import './messages';

/**
 * How the report is shown. `tables`: `toggle` gives every chart a visible "Show as table" button
 * (the engine report); `hidden` keeps the design frames' pixels and puts each chart's table in a
 * visually hidden copy for screen readers.
 */
export interface ReportSettings {
  layout: ReportLayout;
  print: boolean;
  tables: 'toggle' | 'hidden';
}

const ReportContext = createContext<ReportSettings>({ layout: 'desktop', print: false, tables: 'toggle' });

export function ReportProvider({ value, children }: { value: ReportSettings; children: ReactNode }) {
  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export const useReport = () => useContext(ReportContext);

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * Chart or table. In the web view the button switches between them, for everyone, keyboard included.
 * In print, `printAs` picks the one that reads on paper. Whichever shows, the other is never lost:
 * a chart that shows keeps a visually hidden copy of its table.
 */
export function useTableAlternative(printAs: 'chart' | 'table' = 'chart'): { showTable: boolean; srTable: boolean; button: ReactNode } {
  const { print, tables } = useReport();
  const { t } = useI18n();
  const [table, setTable] = useState(false);
  if (print) return { showTable: printAs === 'table', srTable: printAs === 'chart', button: null };
  if (tables === 'hidden') return { showTable: false, srTable: true, button: null };
  const button = (
    <button type="button" aria-pressed={table} onClick={() => setTable(v => !v)}
      className={`cursor-pointer rounded-pill border border-line-control bg-transparent px-2.5 py-0.5 text-12 font-600 text-fg-primary aria-pressed:bg-accent-soft print:hidden ${FOCUS}`}>
      {t('report.chart.showTable')}
    </button>
  );
  return { showTable: table, srTable: !table, button };
}

export interface DataTableProps {
  caption: string;
  /** Column headers; the first heads the row header column. */
  columns: string[];
  rows: Array<{ key: string; header: string; cells: string[] }>;
  /** A visually hidden copy beside a chart. */
  hidden?: boolean;
}

/** The data behind a chart, as a real table: caption, column headers and row headers. Scrolls sideways when wide. */
export function DataTable({ caption, columns, rows, hidden }: DataTableProps) {
  const table = (
    <table className="w-full border-collapse text-13">
      <caption className={hidden ? 'sr-only' : 'pb-1.5 text-left text-12 text-fg-secondary'}>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} scope="col" className={`border-b border-line-default px-2 py-1 font-700 text-fg-secondary ${i ? 'text-right' : 'text-left'}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key}>
            <th scope="row" className="border-b border-line-default px-2 py-1 text-left font-600">{r.header}</th>
            {r.cells.map((c, i) => <td key={i} className="border-b border-line-default px-2 py-1 text-right">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (hidden) return <div className="sr-only print:hidden">{table}</div>;
  // Wide tables scroll inside a focusable region, so keyboard users can scroll them too.
  return <div role="region" aria-label={caption} tabIndex={0} className={`overflow-x-auto ${FOCUS}`}>{table}</div>;
}
