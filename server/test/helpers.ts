import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { configureApp } from "../src/app";
import { AppModule } from "../src/app.module";
import { SMS_SENDER, type SmsSender } from "../src/auth/sms";
import { PrismaService } from "../src/prisma/prisma.service";
import type { AttemptDto } from "../src/shared/practice";

/** Catches the codes instead of logging them, so tests can sign in. */
export class CaptureSms implements SmsSender {
  last = new Map<string, string>();
  async sendOtp(phone: string, code: string) {
    this.last.set(phone, code);
  }
}

export async function createTestApp() {
  const sms = new CaptureSms();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SMS_SENDER)
    .useValue(sms)
    .compile();
  const app: INestApplication = configureApp(moduleRef.createNestApplication({ bodyParser: false, logger: ["error", "warn"] }));
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, sms, prisma, http: () => request(app.getHttpServer()) };
}

export async function wipe(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    "TRUNCATE users, otp_codes, auth_tokens, children, classrooms, memberships, assignments, attempts, skill_states, review_items CASCADE",
  );
}

let phoneCounter = 0;
/** A fresh valid phone for every sign-in (each phone may ask for only 3 codes in 10 minutes). */
export const nextPhone = () => `0915${String(1_000_000 + ++phoneCounter * 7919).slice(-7)}`;

export type Ctx = Awaited<ReturnType<typeof createTestApp>>;

export async function signIn(ctx: Ctx, role: "parent" | "teacher", phone = nextPhone()) {
  await ctx.http().post("/v1/auth/otp").send({ phone }).expect(204);
  const code = ctx.sms.last.get(phone)!;
  const res = await ctx.http().post("/v1/auth/verify").send({ phone, code, role, device: "test" }).expect(200);
  return { token: res.body.token as string, user: res.body.user as { id: string; role: string; phone: string }, phone };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const childBody = (over: Partial<Record<string, unknown>> = {}) => ({
  id: randomUUID(),
  nickname: "ستاره",
  avatar: 3,
  grade: 5,
  birthYear: 1395,
  dailyLimitMin: 30,
  createdAt: Date.now() - 86_400_000,
  ...over,
});

export function attempt(childId: string, over: Partial<AttemptDto> = {}): AttemptDto {
  return {
    id: randomUUID(),
    childId,
    tool: "clock",
    type: "angle",
    level: 1,
    seed: 5,
    generatorVersion: "clock@1",
    response: 0,
    tag: "right",
    score: 1,
    hintsUsed: 0,
    durationMs: 20_000,
    mode: "practice",
    createdAt: Date.now() - 60_000,
    ...over,
  };
}
