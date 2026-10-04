export const REPORT_META = {
  id: "RPT-2026-0930-4417",
  date: "30 Sep 2026, 10:42",
  percentile: 72,
};

export const KPIS = [
  { label: "Talk : Listen", value: "58 : 42", target: "Target 45 : 55", ok: false },
  { label: "Questions Asked", value: "11", target: "6 open, 5 closed", ok: true },
  { label: "Concessions", value: "2", target: "1 conditional, 1 not", ok: false },
  { label: "Interruptions", value: "2", target: "Target 0", ok: false },
  { label: "Speaking Pace", value: "148 wpm", target: "Ideal 130 to 160", ok: true },
  { label: "Deal Outcome", value: "Open", target: "Follow-up agreed", ok: true },
];

export const STRENGTHS = [
  {
    title: "Client-specific value case",
    detail: "Used Northwind's own 14% improvement and a $310K figure to reframe price as return.",
    time: "3:15",
  },
  {
    title: "Strong opening question",
    detail: "Asked what success looks like for the CFO before discussing numbers.",
    time: "0:34",
  },
  {
    title: "Composure under an ultimatum",
    detail: "Kept a calm, collaborative tone when the Friday deadline was raised.",
    time: "1:02",
  },
];

export const DEVELOPMENT = [
  {
    title: "Unconditional concession",
    detail: "Offered 10% without asking for a longer term or volume in return.",
    time: "6:40",
  },
  {
    title: "Missed buying signal",
    detail: "Margaret's openness to a longer term was not explored.",
    time: "7:55",
  },
  {
    title: "Shallow follow-up",
    detail: "Accepted 'lower cost, plain and simple' without probing the real driver.",
    time: "1:02",
  },
];

export const PDF_NAME = `${REPORT_META.id}-renewal-negotiation.pdf`;
