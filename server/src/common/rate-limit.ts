import type { NextFunction, Request, Response } from "express";

/**
 * Requests per minute from one address (plan v3, section 12: abuse of the
 * API must not reach children's data or the SMS budget). Sign-in has its
 * own, smaller limit; the per-phone limit on codes (auth.service.ts) stays
 * on top. A whole school may share one address, so the general limit is
 * generous. Behind a reverse proxy set TRUST_PROXY, or every request comes
 * from the proxy's address.
 *
 * Counts live in this process's memory: one API process (as in
 * docker-compose.prod.yml). Several processes would need a shared store.
 */
export interface RateLimits {
  perMinute: number;
  authPerMinute: number;
}

const positive = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const rateLimits = (): RateLimits => ({
  perMinute: positive(process.env.RATE_LIMIT_PER_MIN, 600),
  authPerMinute: positive(process.env.RATE_LIMIT_AUTH_PER_MIN, 30),
});

const WINDOW_MS = 60_000;

export function rateLimit(limits: RateLimits, now: () => number = Date.now) {
  let windowStart = now();
  let counts = new Map<string, number>();
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS") return next(); // CORS preflight
    const t = now();
    if (t - windowStart >= WINDOW_MS) {
      // A fixed window: everything starts again each minute, and the old counts go.
      windowStart = t - ((t - windowStart) % WINDOW_MS);
      counts = new Map();
    }
    const auth = req.path.startsWith("/v1/auth/");
    const key = `${auth ? "auth" : "all"}|${req.ip ?? "?"}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > (auth ? limits.authPerMinute : limits.perMinute)) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((windowStart + WINDOW_MS - t) / 1000))));
      return res.status(429).json({ error: "rate_limited" });
    }
    next();
  };
}
