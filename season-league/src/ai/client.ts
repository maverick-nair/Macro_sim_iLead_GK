/**
 * Game side of the AI proxy. If the server cannot be reached, the game falls back to the same
 * mock used in mock mode, so a session never stops.
 */
import {
  type ChatRequest,
  ChatResponse,
  Health,
  type PlanScoreRequest,
  RubricPass,
  type TrustScoreRequest,
  TrustScore,
} from "../../shared/ai-contract.ts";
import { mockReply, mockRubric, mockTrust } from "../../shared/mock-ai.ts";

async function post<T>(url: string, body: unknown, parse: (v: unknown) => T, timeoutMs = 45_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parse(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function health(): Promise<Health> {
  try {
    const res = await fetch("/api/health");
    return Health.parse(await res.json());
  } catch {
    return { mode: "mock", demo: true };
  }
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  try {
    return await post("/api/chat", req, (v) => ChatResponse.parse(v), 20_000);
  } catch {
    return { reply: mockReply(req), mode: "mock" };
  }
}

export async function scorePlan(req: PlanScoreRequest): Promise<{ pass: RubricPass; mode: "live" | "mock" }> {
  try {
    return await post("/api/score/plan", req, (v) => {
      const m = (v as { mode?: string }).mode === "live" ? "live" : "mock";
      return { pass: RubricPass.parse(v), mode: m as "live" | "mock" };
    });
  } catch {
    return { pass: mockRubric(req), mode: "mock" };
  }
}

export async function scoreTrust(
  req: TrustScoreRequest,
): Promise<{ score: TrustScore; mode: "live" | "mock" }> {
  try {
    return await post("/api/score/trust", req, (v) => {
      const m = (v as { mode?: string }).mode === "live" ? "live" : "mock";
      return { score: TrustScore.parse(v), mode: m as "live" | "mock" };
    });
  } catch {
    return { score: mockTrust(req), mode: "mock" };
  }
}

export async function fetchResults(): Promise<{
  results: Record<string, unknown>;
  feed: { breaking: unknown; trust: unknown };
} | null> {
  try {
    const res = await fetch("/api/results");
    if (!res.ok) return null;
    return (await res.json()) as {
      results: Record<string, unknown>;
      feed: { breaking: unknown; trust: unknown };
    };
  } catch {
    return null;
  }
}

export async function pushResults(body: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
