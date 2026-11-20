// The limiter alone, with a clock the test moves.
import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "../src/common/rate-limit";

function call(mw: ReturnType<typeof rateLimit>, path: string, ip: string) {
  let status = 200;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => (headers[k] = v),
    status: (s: number) => ((status = s), res),
    json: () => res,
  } as unknown as Response;
  let passed = false;
  mw({ method: "GET", path, ip } as Request, res, (() => (passed = true)) as NextFunction);
  return { status: passed ? 200 : status, headers };
}

it("counts per address and per minute, and starts again each minute", () => {
  let t = 1_000_000;
  const mw = rateLimit({ perMinute: 2, authPerMinute: 1 }, () => t);
  expect(call(mw, "/v1/me", "a").status).toBe(200);
  expect(call(mw, "/v1/me", "a").status).toBe(200);
  const third = call(mw, "/v1/me", "a");
  expect(third.status).toBe(429);
  expect(third.headers["Retry-After"]).toBe("60");
  // Another address, and sign-in, have their own counts.
  expect(call(mw, "/v1/me", "b").status).toBe(200);
  expect(call(mw, "/v1/auth/otp", "a").status).toBe(200);
  expect(call(mw, "/v1/auth/verify", "a").status).toBe(429);
  t += 45_000;
  expect(call(mw, "/v1/me", "a").headers["Retry-After"]).toBe("15");
  t += 15_000;
  expect(call(mw, "/v1/me", "a").status).toBe(200);
  expect(call(mw, "/v1/auth/otp", "a").status).toBe(200);
});
