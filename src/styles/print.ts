/**
 * While the development report's print view is open, a printed sheet is a whole letter page: the
 * report's pages carry their own margins (src/components/report/ReportDocument.tsx). Rendered in a
 * style element only then, so other screens keep the global print margins in global.css.
 */
export const REPORT_PAGE_RULE = '@media print { @page { size: letter; margin: 0; } }';
