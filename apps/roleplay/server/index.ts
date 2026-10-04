import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Band, type IndicatorHit, type Scenario, type SessionTurn } from "../src/domain/scenario";
import { BAND_POINTS } from "../src/domain/scoring";
import { mockProviders } from "../src/providers/mock";
import {
  ClassifyRequest,
  LanguageAnalysis,
  NpcRequest,
  ReportRequest,
  type ClassifyResponse,
  type NpcResponse,
  type ReportNarrative,
} from "../src/providers/types";

// Local API server for the AI RolePlay app. It is the only process that holds the provider key.
// Each route validates its input with Zod, builds its prompt from a versioned file under
// /prompts/roleplay, calls Claude with a structured output schema where one applies, validates the
// result, and retries once on a validation failure. With no model configured it answers with the
// mock providers so the client contract is identical either way.

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTS = join(here, "..", "..", "..", "prompts", "roleplay");
const PORT = Number(process.env.ROLEPLAY_API_PORT ?? 8787);
const MODEL_NPC = process.env.LLM_MODEL_NPC ?? "";
const MODEL_JUDGE = process.env.LLM_MODEL_JUDGE ?? "";
const DUAL_PASS = process.env.ROLEPLAY_DUAL_PASS === "1";
const useLlm = process.env.AI_PROVIDER !== "mock" && Boolean(MODEL_NPC && MODEL_JUDGE);
const client = useLlm ? new Anthropic() : null;

type Prompt = { version: string; body: string };
function loadPrompt(task: string, version = "v1"): Prompt {
  const raw = readFileSync(join(PROMPTS, task, `${version}.md`), "utf8");
  const body = raw.replace(/^---[\s\S]*?---\s*/, "");
  return { version, body };
}
const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");

const PLAYER = "You";
const transcriptText = (t: SessionTurn[]) => t.map((x) => `${x.time} ${x.speaker}: ${x.text}`).join("\n");

// ---------- NPC ----------

const npcPrompt = loadPrompt("npc");

async function npc(req: NpcRequest): Promise<NpcResponse> {
  const { scenario, mode, difficulty, transcript, playerTurn } = req;
  const incident = scenario.stimulus.incidents.find((i) => i.afterPlayerTurn === playerTurn);
  if (!client) return mockProviders.npc.reply(req);
  const p = scenario.stimulus.persona;
  const system = fill(npcPrompt.body, {
    personaName: p.name,
    personaRole: p.role,
    personaOrganisation: p.organisation,
    scene: scenario.stimulus.player.scene,
    playerRole: scenario.stimulus.player.role,
    hiddenInterests: p.hiddenInterests.map((h) => `- ${h}`).join("\n"),
    style: p.styleByDifficulty[difficulty],
    modeRules:
      mode === "assessment"
        ? "This is a standardised assessment. Keep your position, pressure and concessions consistent with the directives you are given each turn. Do not volunteer information the participant has not asked for. Do not soften because the participant seems to struggle."
        : "This is practice. Respond naturally to what the participant does. Reward good questions with information and make poor moves cost something, so the participant can feel the difference.",
    incidentDirective: incident
      ? `Critical incident for this reply: ${incident.directive}`
      : "No scripted incident this turn. Respond to what the participant just said.",
  });
  const messages: Anthropic.MessageParam[] = transcript.map((t) => ({
    role: t.speaker === PLAYER ? "user" : "assistant",
    content: t.text,
  }));
  const response = await client.messages.create({
    model: MODEL_NPC,
    max_tokens: 400,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low" },
    messages,
  });
  if (response.stop_reason === "refusal") return mockProviders.npc.reply(req);
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  return {
    text: text || (await mockProviders.npc.reply(req)).text,
    incidentId: incident?.id ?? null,
    meta: { provider: "anthropic", model: MODEL_NPC, promptVersion: npcPrompt.version },
  };
}

// ---------- Classifier ----------

const classifyPrompt = loadPrompt("classify");

const ClassifierOutput = z.object({
  onTopic: z.boolean(),
  hits: z.array(z.object({ indicatorId: z.string(), band: Band, quote: z.string(), note: z.string() })),
});

function indicatorText(scenario: Scenario) {
  return scenario.instrument.skills
    .map(
      (s) =>
        `### ${s.name}\n` +
        s.indicators
          .map(
            (i) =>
              `- id: ${i.id}\n  behaviour: ${i.label}\n  Strong: ${i.anchors.strong}\n  Adequate: ${i.anchors.adequate}\n  Weak: ${i.anchors.weak}\n  Harmful: ${i.anchors.harmful}`,
          )
          .join("\n"),
    )
    .join("\n\n");
}

async function classifyOnce(req: ClassifyRequest): Promise<IndicatorHit[] | null> {
  if (!client) return null;
  const { scenario, transcript, turnIndex } = req;
  const turn = transcript[turnIndex];
  const p = scenario.stimulus.persona;
  const prompt = fill(classifyPrompt.body, {
    title: scenario.title,
    playerRole: scenario.stimulus.player.role,
    personaName: p.name,
    personaRole: p.role,
    personaOrganisation: p.organisation,
    indicators: indicatorText(scenario),
    transcript: transcriptText(transcript.slice(0, turnIndex)),
    turn: `${turn.time} ${turn.speaker}: ${turn.text}`,
  });
  const known = new Set(scenario.instrument.skills.flatMap((s) => s.indicators.map((i) => i.id)));
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.parse({
      model: MODEL_JUDGE,
      max_tokens: 2000,
      output_config: { format: zodOutputFormat(ClassifierOutput), effort: "medium" },
      messages: [{ role: "user", content: prompt }],
    });
    const out = response.parsed_output;
    if (!out) continue;
    lastOnTopic = out.onTopic;
    return out.hits.filter((h) => known.has(h.indicatorId));
  }
  return null;
}
let lastOnTopic = true;

// When two passes disagree, the more conservative band is kept. Agreement is the share of
// indicator and band pairs both passes produced identically.
function reconcile(a: IndicatorHit[], b: IndicatorHit[]) {
  const byId = new Map<string, IndicatorHit>();
  for (const h of a) byId.set(h.indicatorId, h);
  let matches = 0;
  for (const h of b) {
    const prev = byId.get(h.indicatorId);
    if (!prev) byId.set(h.indicatorId, h);
    else if (prev.band === h.band) matches += 1;
    else if (BAND_POINTS[h.band] < BAND_POINTS[prev.band]) byId.set(h.indicatorId, h);
  }
  const union = byId.size || 1;
  return { hits: [...byId.values()], agreement: matches / union };
}

async function classify(req: ClassifyRequest): Promise<ClassifyResponse> {
  const first = await classifyOnce(req);
  if (!first) return mockProviders.classifier.classify(req);
  let hits = first;
  let agreement: number | null = null;
  if (DUAL_PASS) {
    const second = await classifyOnce(req);
    if (second) ({ hits, agreement } = reconcile(first, second));
  }
  return {
    classification: { turnIndex: req.turnIndex, onTopic: lastOnTopic || hits.length > 0, hits },
    agreement,
    meta: { provider: "anthropic", model: MODEL_JUDGE, promptVersion: classifyPrompt.version },
  };
}

// ---------- Report writer ----------

const reportPrompt = loadPrompt("report");

const ReportNarrativeOutput = z.object({
  overall: z.array(z.string()),
  recommendations: z.array(z.object({ title: z.string(), detail: z.string() })),
  skillFeedback: z.array(z.object({ skillId: z.string(), feedback: z.string() })),
  language: LanguageAnalysis,
});

async function report(req: ReportRequest): Promise<ReportNarrative> {
  if (!client) return mockProviders.reporter.write(req);
  const prompt = fill(reportPrompt.body, {
    title: req.scenario.title,
    playerRole: req.scenario.stimulus.player.role,
    overall: String(req.overall),
    skills: req.skills
      .map(
        (s) =>
          `### ${s.name} (id ${s.skillId}): ${s.score}/10\n` +
          s.indicators
            .map(
              (i) =>
                `- ${i.label}: ${i.band ?? "Not observed"}${i.quotes.length ? `\n  evidence: ${i.quotes.map((q) => `"${q}"`).join(" | ")}` : ""}`,
            )
            .join("\n"),
      )
      .join("\n\n"),
    transcript: transcriptText(req.transcript),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.parse({
      model: MODEL_JUDGE,
      max_tokens: 6000,
      output_config: { format: zodOutputFormat(ReportNarrativeOutput), effort: "medium" },
      messages: [{ role: "user", content: prompt }],
    });
    const out = response.parsed_output;
    if (!out || out.overall.length === 0 || out.recommendations.length === 0) continue;
    const skillFeedback: Record<string, string> = {};
    for (const s of out.skillFeedback) skillFeedback[s.skillId] = s.feedback;
    return {
      overall: out.overall,
      recommendations: out.recommendations,
      skillFeedback,
      language: out.language,
      meta: { provider: "anthropic", model: MODEL_JUDGE, promptVersion: reportPrompt.version },
    };
  }
  return mockProviders.reporter.write(req);
}

// ---------- HTTP plumbing ----------

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const routes: Record<string, (body: unknown) => Promise<unknown>> = {
  "/api/npc": (b) => npc(NpcRequest.parse(b)),
  "/api/classify": (b) => classify(ClassifyRequest.parse(b)),
  "/api/report": (b) => report(ReportRequest.parse(b)),
  "/api/health": async () => ({
    ok: true,
    provider: useLlm ? "anthropic" : "mock",
    dualPass: DUAL_PASS,
    prompts: { npc: npcPrompt.version, classify: classifyPrompt.version, report: reportPrompt.version },
  }),
};

createServer(async (req, res) => {
  const path = (req.url ?? "").split("?")[0];
  const route = routes[path];
  if (!route) return send(res, 404, { error: "Not found" });
  try {
    const body = req.method === "POST" ? await readJson(req) : null;
    send(res, 200, await route(body));
  } catch (err) {
    if (err instanceof z.ZodError) return send(res, 400, { error: "Invalid request", issues: err.issues });
    if (err instanceof Anthropic.AuthenticationError)
      return send(res, 502, { error: "Provider authentication failed" });
    if (err instanceof Anthropic.RateLimitError) return send(res, 503, { error: "Provider rate limited" });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: `Provider error ${err.status}` });
    console.error(err);
    send(res, 500, { error: "Internal error" });
  }
}).listen(PORT, () => {
  console.log(`roleplay api on http://localhost:${PORT} (${useLlm ? "anthropic" : "mock"} providers)`);
});
