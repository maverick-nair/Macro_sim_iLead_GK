/**
 * AI adapter. Live mode calls the Anthropic Messages API through the official SDK; mock mode returns
 * scripted replies and fixed sample scores. Every structured output is validated with Zod and retried
 * once on a validation failure, then falls back to the mock so the game never stops.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import {
  type ChatRequest,
  extractJson,
  type PlanScoreRequest,
  RubricPass,
  type TrustScoreRequest,
  TrustScore,
} from "../shared/ai-contract.ts";
import { mockReply, mockRubric, mockTrust } from "../shared/mock-ai.ts";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const model = process.env.AI_MODEL?.trim();
export const mode: "live" | "mock" = apiKey && model ? "live" : "mock";
const client = mode === "live" ? new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 }) : null;

const effortFor = (v: string | undefined, fallback: Effort): Effort | null =>
  v === "none" ? null : ((v as Effort | undefined) ?? fallback);
const CHAT_EFFORT = effortFor(process.env.AI_EFFORT_CHAT, "low");
const SCORE_EFFORT = effortFor(process.env.AI_EFFORT_SCORE, "medium");

const PROMPTS = fileURLToPath(new URL("../prompts/", import.meta.url));
const prompt = (task: string, version = "v1") => readFileSync(`${PROMPTS}${task}/${version}.md`, "utf8");
const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");

const listPromises = (ps: { action: string; owner: string; due: string }[]) =>
  ps.length ? ps.map((p) => `- ${p.action} (owner: ${p.owner}, due: ${p.due})`).join("\n") : "- None yet.";

async function complete(
  system: string,
  messages: Anthropic.MessageParam[],
  effort: Effort | null,
  maxTokens: number,
) {
  if (!client || !model) throw new Error("Live mode is not configured");
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages,
    ...(effort ? { output_config: { effort } } : {}),
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this request");
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Calls the model for strict JSON, validates, retries once with the validation error. */
async function structured<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await complete(system, messages, SCORE_EFFORT, 8000);
    try {
      return schema.parse(extractJson(text));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `That did not match the required JSON shape (${lastError.slice(0, 400)}). Return only the corrected JSON.`,
      });
    }
  }
  throw new Error(`Invalid structured output: ${lastError}`);
}

export async function chat(req: ChatRequest): Promise<{ reply: string; mode: "live" | "mock" }> {
  if (mode === "mock") return { reply: mockReply(req), mode };
  const c = req.character;
  const system = fill(prompt("character-chat"), {
    name: c.name,
    role: c.role,
    organisation: c.organisation,
    location: c.location ? `, based in ${c.location}` : "",
    speaks: c.speaks ?? "Professional and direct.",
    wants: c.wants ?? "A clear plan from the bank.",
    neverDoes: c.neverDoes ?? "Leaves the case.",
    habits: c.habits ?? "None noted.",
    roundNumber: String(req.round.number),
    roundTitle: req.round.title,
    scenario: req.round.scenario,
    inject: req.round.inject,
    prompt: req.round.prompt,
    decision: req.decision
      ? `${req.decision.id}. ${req.decision.text}`
      : "No play was called before time ran out.",
    clientMessage: req.clientMessage || "None written.",
    promises: listPromises(req.promises),
    history: req.history.length
      ? req.history.map((h) => `- ${h}`).join("\n")
      : "- This is the first conversation.",
  });
  // The conversation must start with a user turn: the call connecting is the opening cue.
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "(The call connects. Open the conversation.)" },
  ];
  for (const t of req.transcript)
    messages.push(
      t.who === "squad"
        ? { role: "user", content: `${t.speaker}: ${t.text}` }
        : { role: "assistant", content: t.text },
    );
  if (messages[messages.length - 1]?.role === "assistant")
    messages.push({ role: "user", content: "(Silence on the line. Continue.)" });
  try {
    const reply = await complete(system, messages, CHAT_EFFORT, 2000);
    return reply ? { reply, mode } : { reply: mockReply(req), mode: "mock" };
  } catch (err) {
    console.error("[ai] chat failed, using mock reply:", err instanceof Error ? err.message : err);
    return { reply: mockReply(req), mode: "mock" };
  }
}

export async function scorePlan(req: PlanScoreRequest): Promise<RubricPass & { mode: "live" | "mock" }> {
  if (mode === "mock") return { ...mockRubric(req), mode };
  const plan = [
    ...req.plan.headings.map((h) => `${h.heading}: ${h.text || "(empty)"}`),
    "Actions:",
    listPromises(req.plan.actions),
    `Message to the client: ${req.plan.clientMessage || "(empty)"}`,
    `Play called: ${req.plan.decision ? `${req.plan.decision.id}. ${req.plan.decision.text}` : "none"}`,
  ].join("\n");
  const user = fill(prompt("plan-rubric"), {
    roundNumber: String(req.roundNumber),
    roundTitle: req.roundTitle,
    scenario: req.scenario,
    evidence: req.evidence.map((e) => `- ${e}`).join("\n"),
    prompt: req.prompt,
    plan,
    lineMax: String(req.lineMax),
    lines: req.lines.map((l) => `- ${l.id}: ${l.label}`).join("\n"),
  });
  try {
    const result = await structured(
      "You are a strict, consistent rubric scorer. Output JSON only.",
      `${user}\n\n(Scoring pass ${req.pass})`,
      RubricPass,
    );
    return { ...result, mode };
  } catch (err) {
    console.error("[ai] plan score failed, using sample score:", err instanceof Error ? err.message : err);
    return { ...mockRubric(req), mode: "mock" };
  }
}

export async function scoreTrust(req: TrustScoreRequest): Promise<TrustScore & { mode: "live" | "mock" }> {
  if (mode === "mock") return { ...mockTrust(req), mode };
  const c = req.character;
  const user = fill(prompt("trust-meter"), {
    name: c.name,
    role: c.role,
    organisation: c.organisation,
    roundTitle: req.roundTitle,
    promises: listPromises(req.promises),
    transcript:
      req.transcript
        .map((t) => `${t.who === "squad" ? `Bank (${t.speaker})` : c.name}: ${t.text}`)
        .join("\n") || "(No one spoke.)",
    behaviors: req.behaviors.map((b) => `- ${b.id}: ${b.label}`).join("\n"),
  });
  try {
    const result = await structured(`You are ${c.name}. Output JSON only.`, user, TrustScore);
    return { ...result, mode };
  } catch (err) {
    console.error("[ai] trust score failed, using sample score:", err instanceof Error ? err.message : err);
    return { ...mockTrust(req), mode: "mock" };
  }
}
