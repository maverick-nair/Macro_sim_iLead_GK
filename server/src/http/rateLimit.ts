/**
 * Fixed window rate limits, in memory, per caller. Enough for one instance; with several instances behind
 * a load balancer each keeps its own count (a caller gets up to N times the limit), so put a shared limit
 * (the load balancer's, or a Redis backed implementation of this interface) in front when that matters.
 */
export interface RateLimiter {
  hit(bucket: string, key: string): { ok: true } | { ok: false; retryAfter: number };
}

export function createRateLimiter(limits: Record<string, { max: number; windowMs: number }>, now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  let sweeps = 0;
  return {
    hit(bucket, key) {
      const l = limits[bucket];
      if (!l || l.max <= 0) return { ok: true };
      const t = now();
      // Drop finished windows now and then, so the map stays small.
      if (++sweeps % 1000 === 0) for (const [k, w] of windows) if (t - w.start > 24 * 3600_000) windows.delete(k);
      const w = windows.get(key);
      if (!w || t - w.start >= l.windowMs) {
        windows.set(key, { start: t, count: 1 });
        return { ok: true };
      }
      if (w.count >= l.max) return { ok: false, retryAfter: Math.max(1, Math.ceil((w.start + l.windowMs - t) / 1000)) };
      w.count++;
      return { ok: true };
    }
  };
}
