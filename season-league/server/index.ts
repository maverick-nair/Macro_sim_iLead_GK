/**
 * Season League server: proxies AI calls (keys stay here), serves content, holds squad state and results,
 * and logs every turn, score, challenge and reveal in KSA time. In production it also serves the built game.
 *
 * Each feature registers its own routes from server/routes/*.ts.
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import express from "express";
import type { ChatRequest, PlanScoreRequest, TrustScoreRequest } from "../shared/ai-contract.ts";
import { chat, mode, scorePlan, scoreTrust } from "./ai.ts";
import { registerContent } from "./content.ts";
import { kudosValues, registerKudos } from "./routes/kudos.ts";
import { registerMoments } from "./routes/moments.ts";
import { registerObserver } from "./routes/observer.ts";
import { missionValues, registerReports } from "./routes/reports.ts";
import { registerSetup } from "./routes/setup.ts";
import { registerState } from "./routes/state.ts";
import { registerTrustChallenge } from "./routes/trust-challenge.ts";
import { audit } from "./audit.ts";
import { getFeed, getResults, ksaNow, putFeed, putResults } from "./state-store.ts";

export const app = express();
app.use(express.json({ limit: "5mb" }));

const demo = process.env.DEMO_MODE !== "false";

app.get("/api/health", (_req, res) => {
  res.json({ mode, demo });
});

app.post("/api/chat", async (req, res) => {
  const body = req.body as ChatRequest;
  const out = await chat(body);
  audit("turn", {
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
  audit("plan-score", out);
  res.json(out);
});

app.post("/api/score/trust", async (req, res) => {
  const out = await scoreTrust(req.body as TrustScoreRequest);
  audit("trust-score", out);
  res.json(out);
});

app.get("/api/results", (_req, res) => {
  // extras: league categories computed on the server (kudos received, imported missions), each 0 to 1.
  const extras: Record<string, Record<string, number>> = {};
  for (const [id, v] of Object.entries(kudosValues())) extras[id] = { ...extras[id], kudos: v };
  for (const [id, v] of Object.entries(missionValues())) extras[id] = { ...extras[id], missions: v };
  res.json({ results: getResults(), feed: getFeed(), extras });
});

app.post("/api/results", (req, res) => {
  const body = req.body as { squadId?: string; results?: unknown; breaking?: unknown; trust?: unknown };
  if (!body.squadId) {
    res.status(400).json({ error: "squadId is required" });
    return;
  }
  putResults(body.squadId, body.results);
  if (body.breaking || body.trust) {
    const feed = getFeed();
    putFeed({
      breaking: body.breaking ?? feed.breaking,
      trust: body.trust ?? feed.trust,
      updatedAt: ksaNow(),
    });
  }
  audit("results", body);
  res.json({ ok: true });
});

registerContent(app);
registerState(app);
registerTrustChallenge(app);
registerMoments(app);
registerKudos(app);
registerReports(app);
registerSetup(app);
registerObserver(app);

if (process.env.NODE_ENV === "production") {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(`${dist}index.html`));
}

if (process.env.SEASON_LEAGUE_NO_LISTEN !== "1") {
  const port = Number(process.env.PORT ?? 8787);
  app.listen(port, () => {
    console.log(
      `Season League server on http://localhost:${port} (AI: ${mode === "live" ? "live" : "Demo AI, mock mode"}, demo mode: ${demo})`,
    );
  });
}
