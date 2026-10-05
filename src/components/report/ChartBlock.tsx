import { useId, type ReactNode } from 'react';
import { DataTable, useTableAlternative, type DataTableProps } from './context';

export interface ChartBlockProps {
  title: string;
  /** Draws the chart; gets the id of the title so the chart can say what it is. */
  chart: ReactNode;
  table: Omit<DataTableProps, 'hidden' | 'caption'>;
  /** What print shows: the chart, or the table where the chart would not read on paper. */
  printAs?: 'chart' | 'table';
  className?: string;
}

/** A titled chart with its data table alternative: a "Show as table" toggle on screen, a visually hidden copy otherwise. */
export function ChartBlock({ title, chart, table, printAs = 'chart', className = '' }: ChartBlockProps) {
  const id = useId();
  const alt = useTableAlternative(printAs);
  return (
    <div role="group" aria-labelledby={`${id}t`} className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}t`} className="m-0 text-15 font-700">{title}</h3>
        {alt.button}
      </div>
      {alt.showTable ? <DataTable caption={title} {...table} /> : (
        <>
          {chart}
          {alt.srTable && <DataTable caption={title} {...table} hidden />}
        </>
      )}
    </div>
  );
}
