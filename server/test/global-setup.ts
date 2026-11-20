import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./env";

/** Brings the test database to the current migrations (the container must be up: npm run db:up). */
export default function globalSetup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } });
}
