import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { ApiExceptionFilter } from "./common/exception.filter";
import { rateLimit, rateLimits } from "./common/rate-limit";

export const BODY_LIMIT = "1mb";

export const corsOrigins = () =>
  (process.env.CORS_ORIGINS ?? "http://localhost:3100,http://localhost:3217")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

/**
 * Everything around the routes, shared by main.ts and the tests. Create
 * the app with { bodyParser: false }: the JSON parser here has the size
 * limit and answers its own errors as { error }. No request logging: bodies
 * hold children's data.
 */
export function configureApp(app: INestApplication) {
  const ex = app as NestExpressApplication;
  ex.disable("x-powered-by");
  if (process.env.TRUST_PROXY) ex.set("trust proxy", process.env.TRUST_PROXY === "true" ? true : process.env.TRUST_PROXY);
  ex.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  ex.enableCors({
    origin: corsOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  });
  // Before the body is read: a flood costs as little as possible.
  ex.use(rateLimit(rateLimits()));
  const json = express.json({ limit: BODY_LIMIT, strict: true });
  ex.use((req: Request, res: Response, next: NextFunction) =>
    json(req, res, (err?: { type?: string; status?: number }) => {
      if (!err) return next();
      if (err.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large" });
      return res.status(err.status && err.status < 500 ? err.status : 400).json({ error: "bad_json" });
    }),
  );
  ex.setGlobalPrefix("v1");
  ex.useGlobalFilters(new ApiExceptionFilter());
  ex.enableShutdownHooks();
  return ex;
}
