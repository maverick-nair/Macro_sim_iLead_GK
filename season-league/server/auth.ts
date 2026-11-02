/**
 * Access for the non-squad accounts in the PRD: Setup (KSPL, before launch), Reports (SAB L&D and KSPL,
 * after play) and the read-only Observer view (F21). Each has a key from the environment, sent in the
 * `x-access-key` header. In demo mode an unset key falls back to "demo" so the screens can be tried.
 */
import type { NextFunction, Request, Response } from "express";

export type Role = "setup" | "reports" | "observer";

const ENV: Record<Role, string> = { setup: "SETUP_KEY", reports: "REPORTS_KEY", observer: "OBSERVER_KEY" };

export function keyFor(role: Role): string | null {
  const v = process.env[ENV[role]]?.trim();
  if (v) return v;
  return process.env.DEMO_MODE !== "false" ? "demo" : null;
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const expected = keyFor(role);
    const given =
      req.header("x-access-key") ?? (typeof req.query.key === "string" ? req.query.key : undefined);
    if (!expected || given !== expected) {
      res.status(401).json({ error: `The ${role} key is missing or wrong.` });
      return;
    }
    next();
  };
}
