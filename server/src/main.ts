import "./ignore-css";
import "reflect-metadata";
import { existsSync } from "node:fs";

// Local .env (Node 20.12+); in Docker the variables come from the environment.
if (existsSync(".env")) process.loadEnvFile(".env");

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { configureApp, corsOrigins } from "./app";
import { AppModule } from "./app.module";
import { ADAPTERS } from "./shared/practice";

const FORBIDDEN_PORTS = new Set([3000, 3100, 3333, 4200, 5432, 5433]);

async function main() {
  const port = Number(process.env.PORT ?? 3200);
  if (FORBIDDEN_PORTS.has(port)) throw new Error(`Port ${port} belongs to another project; use PORT=3200`);
  const app = configureApp(await NestFactory.create(AppModule, { bodyParser: false }));
  await app.listen(port, process.env.HOST ?? "0.0.0.0");
  const log = new Logger("Main");
  log.log(`API on :${port}/v1 · tools: ${ADAPTERS.map((a) => a.version).join(", ")} · CORS: ${corsOrigins().join(", ")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
