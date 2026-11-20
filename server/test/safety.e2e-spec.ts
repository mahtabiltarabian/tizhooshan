// End-to-end: row-level security in the database, the review link
// (Attempt.reviewOf), and the sync that adds new answers onto the saved
// state instead of replaying everything.

import { Prisma } from "@prisma/client";
import { makeClockQuestion } from "@/generators/clock";
import { DAY } from "@/practice/types";
import { AttemptsService } from "../src/attempts/attempts.service";
import { APP_ROLE } from "../src/prisma/prisma.service";
import { attempt, auth, childBody, createTestApp, signIn, wipe, type Ctx } from "./helpers";

let ctx: Ctx;

beforeAll(async () => {
  ctx = await createTestApp();
  await wipe(ctx.prisma);
});

afterAll(async () => {
  await ctx?.app.close();
});

/** An attempts row as Prisma writes it, for inserting straight into the database. */
const row = (childId: string, createdAt = Date.now()): Prisma.AttemptCreateManyInput => {
  const a = attempt(childId, { createdAt });
  return { ...a, response: a.response as Prisma.InputJsonValue, createdAt: new Date(a.createdAt) };
};

const send = (token: string, attempts: unknown[]) => ctx.http().post("/v1/attempts/batch").set(auth(token)).send({ attempts }).expect(200);

/** A child's saved state, in a stable order, for comparing. */
async function savedState(childId: string) {
  const [skills, reviews] = await Promise.all([
    ctx.prisma.skillState.findMany({ where: { childId }, orderBy: { skill: "asc" } }),
    ctx.prisma.reviewItem.findMany({ where: { childId }, orderBy: { attemptId: "asc" } }),
  ]);
  return { skills, reviews };
}

describe("row-level security", () => {
  it("the database itself keeps parents and teachers apart", async () => {
    const a = await signIn(ctx, "parent");
    const b = await signIn(ctx, "parent");
    const t = await signIn(ctx, "teacher");
    const ca = childBody();
    const cb = childBody();
    await ctx.http().put(`/v1/children/${ca.id}`).set(auth(a.token)).send(ca).expect(200);
    await ctx.http().put(`/v1/children/${cb.id}`).set(auth(b.token)).send(cb).expect(200);
    await ctx.prisma.attempt.createMany({ data: [row(ca.id, Date.now() - DAY), row(cb.id, Date.now() - DAY)] });

    // The teacher's class; child A joins, then answers once more.
    const cls = await ctx.http().post("/v1/classrooms").set(auth(t.token)).send({ name: "ششم ب" }).expect(200);
    await ctx.http().post("/v1/classrooms/join").set(auth(a.token)).send({ code: cls.body.joinCode, childId: ca.id }).expect(200);
    const after = row(ca.id, Date.now() + 1_000);
    await ctx.prisma.attempt.createMany({ data: [after] });

    const asA = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => ctx.prisma.asUser(a.user.id, fn);
    const asT = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => ctx.prisma.asUser(t.user.id, fn);

    // Parent A: only their own child, even with plain SQL and no service checks.
    expect((await asA((tx) => tx.child.findMany())).map((c) => c.id)).toEqual([ca.id]);
    expect(await asA((tx) => tx.$queryRaw`SELECT count(*)::int AS n FROM children`)).toEqual([{ n: 1 }]);
    expect(await asA((tx) => tx.attempt.count({ where: { childId: cb.id } }))).toBe(0);
    expect(await asA((tx) => tx.attempt.count())).toBe(2);
    // … cannot write for another parent's child …
    await expect(asA((tx) => tx.attempt.create({ data: row(cb.id) }))).rejects.toThrow(/row-level security/);
    expect(await asA((tx) => tx.$executeRaw`UPDATE children SET nickname = 'x' WHERE id = ${cb.id}::uuid`)).toBe(0);
    expect(await asA((tx) => tx.$executeRaw`DELETE FROM attempts WHERE child_id = ${cb.id}::uuid`)).toBe(0);
    // … nor take another parent's child into a class, nor read sign-in data.
    await expect(asA((tx) => tx.membership.create({ data: { classroomId: cls.body.id, childId: cb.id } }))).rejects.toThrow(/row-level security/);
    await expect(asA((tx) => tx.user.findMany())).rejects.toThrow(/permission denied/);
    await expect(asA((tx) => tx.authToken.findMany())).rejects.toThrow(/permission denied/);
    expect(await ctx.prisma.child.findUniqueOrThrow({ where: { id: cb.id } })).toMatchObject({ nickname: cb.nickname });

    // The teacher: the child in the class, and only the answers from the day they joined.
    expect((await asT((tx) => tx.child.findMany())).map((c) => c.id)).toEqual([ca.id]);
    expect((await asT((tx) => tx.attempt.findMany())).map((x) => x.id)).toEqual([after.id]);
    expect(await asT((tx) => tx.classroom.count())).toBe(1);
    // A teacher cannot add answers or change a child.
    await expect(asT((tx) => tx.attempt.create({ data: row(ca.id) }))).rejects.toThrow(/row-level security/);
    expect(await asT((tx) => tx.$executeRaw`UPDATE children SET nickname = 'x' WHERE id = ${ca.id}::uuid`)).toBe(0);

    // Parent A sees the class their child is in; parent B sees no class.
    expect(await asA((tx) => tx.classroom.count())).toBe(1);
    expect(await ctx.prisma.asUser(b.user.id, (tx) => tx.classroom.count())).toBe(0);

    // The role with no user set sees nothing at all.
    await ctx.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${APP_ROLE}`);
      expect(await tx.child.count()).toBe(0);
      expect(await tx.attempt.count()).toBe(0);
    });

    // Outside a signed-in request the services' handle refuses, rather than fall back.
    expect(() => ctx.prisma.db).toThrow(/No user transaction/);

    // Through the API, as before: B cannot take A's child id.
    await ctx.http().put(`/v1/children/${ca.id}`).set(auth(b.token)).send(ca).expect(403);
  });
});

describe("review link", () => {
  it("a review answer moves the notebook entry it names, not the one the server would guess", async () => {
    const p = await signIn(ctx, "parent");
    const child = childBody();
    await ctx.http().put(`/v1/children/${child.id}`).set(auth(p.token)).send(child).expect(200);
    const t0 = Date.now() - 5 * DAY;
    // Two mistakes in the same skill and level: two notebook entries, the first due first.
    const first = attempt(child.id, { seed: 6, response: -1, tag: "other", score: 0, createdAt: t0 });
    const second = attempt(child.id, { seed: 8, response: -1, tag: "other", score: 0, createdAt: t0 + 60_000 });
    await send(p.token, [first, second]);
    expect((await savedState(child.id)).reviews.map((r) => r.step)).toEqual([1, 1]);

    // The device reviewed the second entry (the planner's choice there), and got it right.
    const q = makeClockQuestion("angle", 1, 41);
    const review = attempt(child.id, { seed: 41, mode: "review", response: q.answer, reviewOf: second.id, createdAt: t0 + 2 * DAY });
    await send(p.token, [review]);
    const steps = Object.fromEntries((await savedState(child.id)).reviews.map((r) => [r.attemptId, r.step]));
    expect(steps).toEqual({ [first.id]: 1, [second.id]: 3 });
    expect((await ctx.prisma.attempt.findUniqueOrThrow({ where: { id: review.id } })).reviewOf).toBe(second.id);

    // An answer from an older app (no reviewOf) still finds an entry the old way: the longest due.
    const old = attempt(child.id, { seed: 42, mode: "review", response: makeClockQuestion("angle", 1, 42).answer, createdAt: t0 + 3 * DAY });
    await send(p.token, [old]);
    const steps2 = Object.fromEntries((await savedState(child.id)).reviews.map((r) => [r.attemptId, r.step]));
    expect(steps2).toEqual({ [first.id]: 3, [second.id]: 3 });

    // reviewOf is kept only on review answers, and must be an id.
    const practice = attempt(child.id, { seed: 43, reviewOf: first.id, createdAt: t0 + 4 * DAY });
    await send(p.token, [practice]);
    expect((await ctx.prisma.attempt.findUniqueOrThrow({ where: { id: practice.id } })).reviewOf).toBeNull();
    const junk = (await send(p.token, [{ ...attempt(child.id), mode: "review", reviewOf: "nope" }])).body;
    expect(junk.rejected[0].reason).toBe("malformed");
  });
});

describe("sync", () => {
  it("adds answers given in order onto the saved state; out of order, replays all; both equal a full replay", async () => {
    const p = await signIn(ctx, "parent");
    const child = childBody();
    await ctx.http().put(`/v1/children/${child.id}`).set(auth(p.token)).send(child).expect(200);
    const service = ctx.app.get(AttemptsService);
    const paths: string[] = [];
    const update = service.update.bind(service);
    const spy = jest.spyOn(service, "update").mockImplementation(async (...args) => {
      const how = await update(...args);
      paths.push(how);
      return how;
    });

    // Six batches of mixed answers over three weeks: right, wrong, with hints, and reviews.
    const t0 = Date.now() - 21 * DAY;
    const all: ReturnType<typeof attempt>[] = [];
    for (let b = 0; b < 6; b++) {
      const batch = Array.from({ length: 8 }, (_, i) => {
        const seed = 100 + b * 8 + i;
        const q = makeClockQuestion("angle", (1 + (i % 3)) as 1 | 2 | 3, seed);
        const wrong = (seed * 7) % 3 === 0;
        return attempt(child.id, {
          seed,
          level: 1 + (i % 3),
          response: wrong ? -1 : q.answer,
          tag: wrong ? "other" : "right",
          score: wrong ? 0 : 1,
          hintsUsed: i % 4 === 0 ? 1 : 0,
          mode: b > 1 && i === 7 ? "review" : "practice",
          createdAt: t0 + b * 3 * DAY + i * 60_000,
        });
      });
      all.push(...batch);
      await send(p.token, batch);
    }
    expect(paths).toEqual(["incremental", "incremental", "incremental", "incremental", "incremental", "incremental"]);
    const incremental = await savedState(child.id);

    // The same answers replayed from scratch give exactly the same state.
    await ctx.prisma.$transaction((tx) => service.rebuild(tx, child.id));
    expect(await savedState(child.id)).toEqual(incremental);
    expect(incremental.skills.map((x) => x.skill)).toEqual(["clock:angle"]);
    expect(incremental.reviews.length).toBeGreaterThan(0);

    // An answer older than the newest stored one (a second device): the whole history is replayed.
    const late = attempt(child.id, { seed: 999, response: -1, tag: "other", score: 0, createdAt: t0 + DAY });
    await send(p.token, [late]);
    expect(paths.at(-1)).toBe("full");
    const afterLate = await savedState(child.id);
    await ctx.prisma.$transaction((tx) => service.rebuild(tx, child.id));
    expect(await savedState(child.id)).toEqual(afterLate);
    expect(afterLate.reviews.some((r) => r.attemptId === late.id)).toBe(true);
    spy.mockRestore();
    expect(all.length).toBe(48);
  });
});

describe("request limits", () => {
  it("answers 429 with Retry-After past the limit per address; sign-in has a smaller one", async () => {
    const saved = [process.env.RATE_LIMIT_PER_MIN, process.env.RATE_LIMIT_AUTH_PER_MIN];
    process.env.RATE_LIMIT_PER_MIN = "5";
    process.env.RATE_LIMIT_AUTH_PER_MIN = "2";
    const small = await createTestApp();
    [process.env.RATE_LIMIT_PER_MIN, process.env.RATE_LIMIT_AUTH_PER_MIN] = saved;
    try {
      // Sign-in: two code requests, then refused before the body is even read.
      await small.http().post("/v1/auth/otp").send({ phone: "09151110001" }).expect(204);
      await small.http().post("/v1/auth/otp").send({ phone: "09151110002" }).expect(204);
      const refused = await small.http().post("/v1/auth/otp").send({ phone: "09151110003" }).expect(429);
      expect(refused.body).toEqual({ error: "rate_limited" });
      expect(Number(refused.headers["retry-after"])).toBeGreaterThanOrEqual(1);
      expect(Number(refused.headers["retry-after"])).toBeLessThanOrEqual(60);
      expect(small.sms.last.has("09151110003")).toBe(false);

      // Everything else: five a minute here; CORS preflights do not count.
      for (let i = 0; i < 3; i++) await small.http().options("/v1/me").set("Origin", "http://localhost:3100").set("Access-Control-Request-Method", "GET");
      for (let i = 0; i < 5; i++) await small.http().get("/v1/daily-challenge/2026-11-20").expect((r) => expect(r.status).not.toBe(429));
      const over = await small.http().get("/v1/daily-challenge/2026-11-20").set("Origin", "http://localhost:3100").expect(429);
      // The app can read the refusal (CORS headers are on it).
      expect(over.headers["access-control-allow-origin"]).toBe("http://localhost:3100");
    } finally {
      await small.app.close();
    }
  });
});
