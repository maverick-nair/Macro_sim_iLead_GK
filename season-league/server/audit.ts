/** Audit log: every decision, score, challenge, reveal and AI turn, with its time in KSA time. */
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, ksaNow } from "./state-store.ts";

export function audit(kind: string, body: unknown) {
  try {
    appendFileSync(join(DATA_DIR, "audit.log"), `${JSON.stringify({ at: ksaNow(), kind, body })}\n`);
  } catch (err) {
    console.error("[audit] write failed:", err);
  }
}
