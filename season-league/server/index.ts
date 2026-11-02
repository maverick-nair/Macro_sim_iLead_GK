/**
 * Season League server: proxies AI calls (keys stay here), holds squad results for the league and the
 * shared screen, and logs every turn and score in KSA time. In production it also serves the built game.
 */
import "dotenv/config";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import type { ChatRequest, PlanScoreRequest, TrustScoreRequest } from "../shared/ai-contract.ts";
import { chat, mode, scorePlan, scoreTrust } from "./ai.ts";

const app = express();
app.use(express.json({ limit: "1mb" }));

const DATA = fileURLToPath(new URL("./data/", import.meta.url));
mkdirSync(DATA, { recursive: true });
const RESULTS = `${DATA}results.json`;
const demo = process.env.DEMO_MODE !== "false";

/** ISO time in KSA (UTC+3), for the audit log. */
export function ksaNow(ms = Date.now()): string {
  return new Date(ms + 3 * 3600_000).toISOString().replace("Z", "+03:00");
}
const log = (kind: string, body: unknown) =>
  appendFileSync(`${DATA}audit.log`, `${JSON.stringify({ at: ksaNow(), kind, body })}\n`);

type ResultsStore = Record<string, unknown>;
let results: ResultsStore = existsSync(RESULTS)
  ? (JSON.parse(readFileSync(RESULTS, "utf8")) as ResultsStore)
  : {};
let feed: { breaking: unknown; trust: unknown; updatedAt: string | null } = {
  breaking: null,
  trust: null,
  updatedAt: null,
};

app.get("/api/health", (_req, res) => {
  res.json({ mode, demo });
});

app.post("/api/chat", async (req, res) => {
  const body = req.body as ChatRequest;
  const out = await chat(body);
  log("turn", {
    character: body.character?.id,
    round: body.round?.number,
    last: body.transcript?.at(-1),
    reply: out.reply,
    mode: out.mode,
  });
  res.json(out);
});

app.post("/api/score/plan", async (req, res) => {
  const out = await scorePlan(req.body as PlanScoreRequest);
  log("plan-score", out);
  res.json(out);
});

app.post("/api/score/trust", async (req, res) => {
  const out = await scoreTrust(req.body as TrustScoreRequest);
  log("trust-score", out);
  res.json(out);
});

app.get("/api/results", (_req, res) => {
  res.json({ results, feed });
});

app.post("/api/results", (req, res) => {
  const body = req.body as { squadId?: string; results?: unknown; breaking?: unknown; trust?: unknown };
  if (!body.squadId) {
    res.status(400).json({ error: "squadId is required" });
    return;
  }
  results = { ...results, [body.squadId]: body.results };
  writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  if (body.breaking || body.trust)
    feed = { breaking: body.breaking ?? feed.breaking, trust: body.trust ?? feed.trust, updatedAt: ksaNow() };
  log("results", body);
  res.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(`${dist}index.html`));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(
    `Season League server on http://localhost:${port} (AI: ${mode === "live" ? "live" : "Demo AI, mock mode"}, demo mode: ${demo})`,
  );
});
