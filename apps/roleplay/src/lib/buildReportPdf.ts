import type { Line } from "../types";
import { bandFor, scoreLabel } from "./score";
import { SCENARIO_TITLE, SCORE, DURATION } from "../data/scenario";
import { SKILLS, RAW_SCORE } from "../data/skills";
import { REPORT_META, KPIS, STRENGTHS, DEVELOPMENT } from "../data/report";
import { CEFR, SENTIMENT, TONE, CLARITY } from "../data/communication";

export default async function buildReportPdf(lines: Line[]) {
  // Loaded on demand so the PDF library stays out of the initial bundle.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (
    t: string,
    size = 10,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = [30, 26, 22],
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(t, W - M * 2);
    ensure(wrapped.length * size * 1.35);
    doc.text(wrapped, M, y);
    y += wrapped.length * size * 1.35;
  };
  const gap = (h = 10) => (y += h);
  const heading = (t: string) => {
    gap(8);
    ensure(30);
    doc.setDrawColor(194, 65, 12);
    doc.setLineWidth(1.5);
    doc.line(M, y, M + 28, y);
    gap(14);
    text(t, 13, "bold");
    gap(4);
  };
  const band = bandFor(SCORE);

  text("AI ROLEPLAY  ·  PERFORMANCE REPORT", 9, "bold", [184, 50, 15]);
  gap(6);
  text(SCENARIO_TITLE, 20, "bold");
  text(`${REPORT_META.id}   ·   ${REPORT_META.date}   ·   Duration ${DURATION}`, 9, "normal", [90, 84, 78]);

  heading("Performance Overview");
  text(`Overall score: ${SCORE}/10  (${band.label}, weighted average ${RAW_SCORE.toFixed(2)})`, 12, "bold");
  text(
    "Knolskape ten-point scale: Novice 1-2, Emerging 3-4, Competent 5-6, Proficient 7-8, Role Model 9-10.",
    9,
    "normal",
    [90, 84, 78],
  );
  gap(6);
  text(KPIS.map((k) => `${k.label}: ${k.value} (${k.target})`).join("   |   "), 9);
  gap(6);
  text("Key strengths", 10, "bold");
  STRENGTHS.forEach((x) => text(`•  ${x.title} (${x.time}): ${x.detail}`, 10));
  gap(4);
  text("Development priorities", 10, "bold");
  DEVELOPMENT.forEach((x) => text(`•  ${x.title} (${x.time}): ${x.detail}`, 10));

  heading("Detailed Analysis");
  SKILLS.forEach((k, i) => {
    ensure(60);
    text(`${i + 1}. ${k.name}  ·  ${k.score}/10 ${scoreLabel(k.score)}  ·  weight ${k.weight}%`, 11, "bold");
    k.subskills.forEach((sub) => text(`    ${sub.name}: ${sub.score}/10. ${sub.note}`, 9));
    text(`Analysis: ${k.feedback}`, 9.5);
    text(`Recommendation: ${k.recommendation}`, 9.5);
    text(`Practice drill: ${k.drill}`, 9.5, "italic");
    gap(8);
  });

  heading("Communication Metrics");
  text(`CEFR level: ${CEFR.overall} (${CEFR.band}). ${CEFR.summary}`, 10);
  CEFR.dimensions.forEach((d) => text(`    ${d.name}: ${d.level}. ${d.note}`, 9));
  text(`Sentiment: ${SENTIMENT.map((x) => `${x.label} ${x.pct}%`).join(", ")}`, 10);
  text(`Tone: ${TONE.map((x) => `${x.label} ${x.pct}%`).join(", ")}`, 10);
  text(`Clarity: ${CLARITY.score.toFixed(1)}/10. ${CLARITY.note}`, 10);

  heading("Transcript");
  lines.forEach((l) => {
    text(
      `${l.time}  ${l.speaker}${l.tag ? `  [${l.tag === "strength" ? "Strength" : "Missed opportunity"}]` : ""}`,
      9,
      "bold",
      [90, 84, 78],
    );
    text(l.text, 10);
    gap(4);
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 114, 108);
    doc.text(`${REPORT_META.id}  ·  Page ${i} of ${pages}`, M, H - 24);
  }
  return doc;
}
