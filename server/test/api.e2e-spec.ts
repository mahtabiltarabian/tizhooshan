// End-to-end: the real Nest app, the real PostgreSQL (tizhooshan_test in the
// Docker container), and the app's shared practice code.

import { Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { makeClockQuestion } from "@/generators/clock";
import { CLOCK_ADAPTER } from "@/tools/08-clock/adapter";
import { answer } from "@/practice/record";
import { stageOf } from "@/practice/adaptive";
import { SKILLS } from "@/practice/catalog";
import { dailyChallenge, dayNumber } from "@/practice/rewards";
import { DAY, type ReviewItem, type SkillState } from "@/practice/types";
import { DevSmsSender } from "../src/auth/sms";
import { JOIN_ALPHABET } from "../src/classrooms/classrooms.service";
import { attempt, auth, childBody, createTestApp, nextPhone, signIn, wipe, type Ctx } from "./helpers";

let ctx: Ctx;

beforeAll(async () => {
  ctx = await createTestApp();
  await wipe(ctx.prisma);
});

afterAll(async () => {
  await ctx?.app.close();
});

/** The device's own replay with the real adapter: what the server's copy must equal. */
function deviceReplay(childId: string, list: ReturnType<typeof attempt>[]) {
  const skills = new Map<string, SkillState>();
  const reviews = new Map<string, ReviewItem>();
  for (const a of [...list].sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id))) {
    const key = `${a.tool}:${a.type}`;
    const review = a.mode === "review" ? [...reviews.values()].find((r) => r.skill === key && r.level === a.level && r.dueAt <= a.createdAt) : undefined;
    const res = answer({
      adapter: CLOCK_ADAPTER,
      item: { tool: a.tool, type: a.type, level: a.level, seed: a.seed, mode: a.mode },
      response: a.response,
      hintsUsed: a.hintsUsed,
      durationMs: a.durationMs,
      childId,
      id: a.id,
      now: a.createdAt,
      skill: skills.get(key),
      review,
    });
    skills.set(key, res.skill);
    if (res.putReview) reviews.set(res.putReview.attemptId, res.putReview);
    if (res.doneReview) reviews.delete(res.doneReview);
  }
  return { skills, reviews };
}

describe("auth: OTP", () => {
  it("rejects a phone that is not an Iranian mobile", async () => {
    for (const phone of ["123", "0812345678", "09123", "abc", ""]) {
      const res = await ctx.http().post("/v1/auth/otp").send({ phone }).expect(400);
      expect(res.body).toEqual({ error: "bad_phone" });
    }
  });

  it("normalises Persian digits and +98 / 0098 forms; stores only a hash", async () => {
    await ctx.http().post("/v1/auth/otp").send({ phone: "۰۹۱۲۳۴۵۶۷۸۹" }).expect(204);
    await ctx.http().post("/v1/auth/otp").send({ phone: "+98 912 345 6789" }).expect(204);
    await ctx.http().post("/v1/auth/otp").send({ phone: "00989123456789" }).expect(204);
    const code = ctx.sms.last.get("09123456789")!;
    expect(code).toMatch(/^\d{6}$/);
    const rows = await ctx.prisma.otpCode.findMany({ where: { phone: "09123456789" } });
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.codeHash).not.toContain(code);
    // A fourth code within 10 minutes: rate limited.
    const res = await ctx.http().post("/v1/auth/otp").send({ phone: "09123456789" }).expect(429);
    expect(res.body).toEqual({ error: "rate_limited" });
  });

  it("wrong code, then the right one (once); the user is created with the role", async () => {
    const phone = nextPhone();
    await ctx.http().post("/v1/auth/otp").send({ phone }).expect(204);
    const code = ctx.sms.last.get(phone)!;
    const wrong = code === "000000" ? "111111" : "000000";
    expect((await ctx.http().post("/v1/auth/verify").send({ phone, code: wrong, role: "parent" }).expect(400)).body).toEqual({ error: "bad_code" });
    const ok = await ctx.http().post("/v1/auth/verify").send({ phone, code, role: "parent", device: "تبلت خانه" }).expect(200);
    expect(ok.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ok.body.user).toEqual({ id: expect.any(String), role: "parent", phone: `${phone.slice(0, 4)}***${phone.slice(-4)}` });
    // The token is stored hashed only.
    const tokens = await ctx.prisma.authToken.findMany({ where: { userId: ok.body.user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(ok.body.token);
    expect(tokens[0].device).toBe("تبلت خانه");
    // A code works once.
    expect((await ctx.http().post("/v1/auth/verify").send({ phone, code, role: "parent" }).expect(400)).body).toEqual({ error: "bad_code" });
    // Later sign-ins keep the role.
    const again = await signIn(ctx, "teacher", phone);
    expect(again.user.role).toBe("parent");
    expect(again.user.id).toBe(ok.body.user.id);
  });

  it("a code expires after 5 minutes", async () => {
    const phone = nextPhone();
    await ctx.http().post("/v1/auth/otp").send({ phone }).expect(204);
    const code = ctx.sms.last.get(phone)!;
    const row = await ctx.prisma.otpCode.findFirstOrThrow({ where: { phone } });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(4.9 * 60_000);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(5 * 60_000 + 1000);
    await ctx.prisma.otpCode.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await ctx.http().post("/v1/auth/verify").send({ phone, code, role: "parent" }).expect(400)).body).toEqual({ error: "expired" });
  });

  it("at most 5 wrong tries", async () => {
    const phone = nextPhone();
    await ctx.http().post("/v1/auth/otp").send({ phone }).expect(204);
    const code = ctx.sms.last.get(phone)!;
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) await ctx.http().post("/v1/auth/verify").send({ phone, code: wrong, role: "parent" }).expect(400);
    const res = await ctx.http().post("/v1/auth/verify").send({ phone, code, role: "parent" }).expect(400);
    expect(res.body).toEqual({ error: "too_many_tries" });
  });

  it("bearer token, /me, logout", async () => {
    const { token, user } = await signIn(ctx, "teacher");
    expect((await ctx.http().get("/v1/me").expect(401)).body).toEqual({ error: "unauthorized" });
    await ctx.http().get("/v1/me").set("Authorization", "Bearer nonsense-token-that-is-long-enough").expect(401);
    expect((await ctx.http().get("/v1/me").set(auth(token)).expect(200)).body).toEqual(user);
    await ctx.http().post("/v1/auth/logout").set(auth(token)).expect(204);
    await ctx.http().get("/v1/me").set(auth(token)).expect(401);
  });

  it("the development sender logs the code with the phone masked", async () => {
    const spy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    await new DevSmsSender().sendOtp("09124564567", "123456");
    expect(spy).toHaveBeenCalledWith("OTP for 0912***4567: 123456");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("09124564567");
    spy.mockRestore();
  });
});

describe("children", () => {
  it("parent CRUD; another parent cannot see or take the child; teachers cannot use it", async () => {
    const a = await signIn(ctx, "parent");
    const b = await signIn(ctx, "parent");
    const t = await signIn(ctx, "teacher");
    const child = childBody();
    const put = await ctx.http().put(`/v1/children/${child.id}`).set(auth(a.token)).send(child).expect(200);
    expect(put.body).toEqual(child);
    expect((await ctx.http().get("/v1/children").set(auth(a.token)).expect(200)).body).toEqual([child]);
    const renamed = { ...child, nickname: "ماه", dailyLimitMin: 45 };
    expect((await ctx.http().put(`/v1/children/${child.id}`).set(auth(a.token)).send(renamed).expect(200)).body).toEqual(renamed);

    expect((await ctx.http().put(`/v1/children/${randomUUID()}`).set(auth(a.token)).send(child).expect(400)).body).toEqual({ error: "id_mismatch" });
    await ctx.http().put(`/v1/children/${child.id}`).set(auth(a.token)).send({ ...child, grade: 9 }).expect(400);
    await ctx.http().put(`/v1/children/${child.id}`).set(auth(a.token)).send({ ...child, nickname: "" }).expect(400);

    // Parent B: not visible, not writable, not deletable, no report.
    expect((await ctx.http().get("/v1/children").set(auth(b.token)).expect(200)).body).toEqual([]);
    expect((await ctx.http().put(`/v1/children/${child.id}`).set(auth(b.token)).send(child).expect(403)).body).toEqual({ error: "forbidden" });
    expect((await ctx.http().get(`/v1/children/${child.id}/report`).set(auth(b.token)).expect(404)).body).toEqual({ error: "not_found" });
    await ctx.http().get(`/v1/children/${child.id}/session`).set(auth(b.token)).expect(404);
    await ctx.http().get(`/v1/children/${child.id}/assignments`).set(auth(b.token)).expect(404);
    await ctx.http().delete(`/v1/children/${child.id}`).set(auth(b.token)).expect(404);
    await ctx.http().get("/v1/children/not-a-uuid/report").set(auth(b.token)).expect(404);

    // Teacher: parent endpoints are forbidden.
    expect((await ctx.http().get("/v1/children").set(auth(t.token)).expect(403)).body).toEqual({ error: "forbidden" });

    await ctx.http().delete(`/v1/children/${child.id}`).set(auth(a.token)).expect(204);
    expect((await ctx.http().get("/v1/children").set(auth(a.token)).expect(200)).body).toEqual([]);
  });
});

describe("attempts batch", () => {
  it("stores, is idempotent, re-grades with the shared adapter, counts mismatches and rebuilds the state", async () => {
    const p = await signIn(ctx, "parent");
    const other = await signIn(ctx, "parent");
    const child = childBody();
    const foreign = childBody();
    await ctx.http().put(`/v1/children/${child.id}`).set(auth(p.token)).send(child).expect(200);
    await ctx.http().put(`/v1/children/${foreign.id}`).set(auth(other.token)).send(foreign).expect(200);

    const q = makeClockQuestion("angle", 1, 5);
    const t0 = Date.now() - 3 * DAY;
    const right = attempt(child.id, { response: q.answer, tag: "right", score: 1, createdAt: t0 });
    // The device claims right, but the answer is not: the server's grading differs.
    const cheat = attempt(child.id, { response: q.answer + 1, tag: "right", score: 1, createdAt: t0 + 60_000 });
    const honestWrong = attempt(child.id, { seed: 6, response: -1, tag: "other", score: 0, createdAt: t0 + 120_000 });
    expect(CLOCK_ADAPTER.grade("angle", 1, 6, -1)).toBe("other");

    const bad = [
      attempt(foreign.id),
      attempt(randomUUID()),
      attempt(child.id, { tool: "nope" }),
      attempt(child.id, { type: "nope" }),
      attempt(child.id, { level: 9 }),
      { ...attempt(child.id), seed: "x" },
      { id: "junk" },
      42,
    ];
    const res = await ctx.http().post("/v1/attempts/batch").set(auth(p.token)).send({ attempts: [right, cheat, honestWrong, right, ...bad] }).expect(200);
    expect(res.body.stored).toBe(3);
    expect(res.body.skipped).toBe(1); // `right` twice in the same batch
    expect(res.body.mismatched).toBe(1);
    expect(res.body.rejected).toEqual([
      { id: bad[5] && (bad[5] as { id: string }).id, reason: "malformed" },
      { id: "junk", reason: "malformed" },
      { id: "", reason: "malformed" },
      { id: (bad[0] as { id: string }).id, reason: "unknown_child" },
      { id: (bad[1] as { id: string }).id, reason: "unknown_child" },
      { id: (bad[2] as { id: string }).id, reason: "unknown_tool" },
      { id: (bad[3] as { id: string }).id, reason: "unknown_type" },
      { id: (bad[4] as { id: string }).id, reason: "unknown_level" },
    ]);

    const stored = await ctx.prisma.attempt.findUniqueOrThrow({ where: { id: cheat.id } });
    expect(stored.tag).toBe("right"); // kept as sent
    expect(stored.score).toBe(1);
    expect(stored.serverTag).toBe(CLOCK_ADAPTER.grade("angle", 1, 5, q.answer + 1));
    expect(stored.serverTag).not.toBe("right");
    expect(stored.serverScore).toBe(0);
    expect((await ctx.prisma.attempt.findUniqueOrThrow({ where: { id: right.id } })).serverTag).toBe("right");

    // Sending again changes nothing.
    const again = await ctx.http().post("/v1/attempts/batch").set(auth(p.token)).send({ attempts: [right, cheat, honestWrong] }).expect(200);
    expect(again.body).toEqual({ stored: 0, skipped: 3, mismatched: 0, rejected: [] });
    expect(await ctx.prisma.attempt.count({ where: { childId: child.id } })).toBe(3);

    // An earlier answer arriving later, and a review of the first mistake one day on.
    const early = attempt(child.id, { seed: 7, response: makeClockQuestion("angle", 1, 7).answer, createdAt: t0 - DAY });
    const reviewQ = makeClockQuestion("angle", 1, 99);
    const review = attempt(child.id, { seed: 99, mode: "review", response: reviewQ.answer, createdAt: t0 + DAY + 5 * 60_000 });
    await ctx.http().post("/v1/attempts/batch").set(auth(p.token)).send({ attempts: [review, early] }).expect(200);

    // The server's state is the device's replay of every answer, with the real grading.
    const expected = deviceReplay(child.id, [right, cheat, honestWrong, early, review]);
    const skills = await ctx.prisma.skillState.findMany({ where: { childId: child.id } });
    expect(skills).toHaveLength(1);
    const want = expected.skills.get("clock:angle")!;
    expect(skills[0].n).toBe(5);
    expect(skills[0].n).toBe(want.n);
    expect(skills[0].theta).toBeCloseTo(want.theta, 12);
    expect(skills[0].updatedAt.getTime()).toBe(want.updatedAt);

    const reviews = await ctx.prisma.reviewItem.findMany({ where: { childId: child.id }, orderBy: { dueAt: "asc" } });
    const wantReviews = [...expected.reviews.values()].sort((a, b) => a.dueAt - b.dueAt);
    expect(reviews.map((r) => ({ attemptId: r.attemptId, skill: r.skill, level: r.level, step: r.step, dueAt: r.dueAt.getTime() }))).toEqual(
      wantReviews.map((r) => ({ attemptId: r.attemptId, skill: r.skill, level: r.level, step: r.step, dueAt: r.dueAt })),
    );
    // The cheat (first mistake) was reviewed right: step 3. The honest mistake waits at step 1.
    expect(reviews.find((r) => r.attemptId === cheat.id)?.step).toBe(3);
    expect(reviews.find((r) => r.attemptId === honestWrong.id)).toMatchObject({ step: 1, dueAt: new Date(honestWrong.createdAt + DAY) });

    // Report and session come from the server's copy.
    const report = await ctx.http().get(`/v1/children/${child.id}/report`).set(auth(p.token)).expect(200);
    const row = report.body.areas.flatMap((a: { skills: { skill: string }[] }) => a.skills).find((s: { skill: string }) => s.skill === "clock:angle");
    expect(row).toMatchObject({ skill: "clock:angle", tool: "clock", stage: stageOf(want.theta, want.n), answers: 5 });
    expect(JSON.stringify(report.body)).not.toMatch(/theta/);
    const session = await ctx.http().get(`/v1/children/${child.id}/session`).set(auth(p.token)).expect(200);
    expect(session.body.length).toBeGreaterThan(0);
    expect(session.body.some((i: { mode: string; reviewOf?: string }) => i.mode === "review" && i.reviewOf === honestWrong.id)).toBe(true);
  });

  it("refuses more than 500 at once, a body over 1 MB, and teachers", async () => {
    const p = await signIn(ctx, "parent");
    const t = await signIn(ctx, "teacher");
    const many = Array.from({ length: 501 }, () => attempt(randomUUID()));
    expect((await ctx.http().post("/v1/attempts/batch").set(auth(p.token)).send({ attempts: many }).expect(400)).body).toEqual({ error: "too_many" });
    const huge = { attempts: [attempt(randomUUID(), { response: "x".repeat(1_100_000) })] };
    expect((await ctx.http().post("/v1/attempts/batch").set(auth(p.token)).send(huge).expect(413)).body).toEqual({ error: "payload_too_large" });
    await ctx.http().post("/v1/attempts/batch").set(auth(p.token)).send({ nope: 1 }).expect(400);
    await ctx.http().post("/v1/attempts/batch").set(auth(t.token)).send({ attempts: [] }).expect(403);
  });
});

describe("classrooms", () => {
  it("join by code, teacher list, heatmap with stages and no θ, assignments, isolation between teachers", async () => {
    const teacher = await signIn(ctx, "teacher");
    const teacher2 = await signIn(ctx, "teacher");
    const parent = await signIn(ctx, "parent");
    const parent2 = await signIn(ctx, "parent");
    const child = childBody({ nickname: "پویا" });
    const child2 = childBody({ nickname: "نیلو" });
    await ctx.http().put(`/v1/children/${child.id}`).set(auth(parent.token)).send(child).expect(200);
    await ctx.http().put(`/v1/children/${child2.id}`).set(auth(parent2.token)).send(child2).expect(200);

    // An answer from before the child joined: the teacher never sees it.
    const before = attempt(child.id, { type: "mirror", seed: 3, response: 0, tag: "other", score: 0, createdAt: Date.now() - 2 * DAY });
    await ctx.http().post("/v1/attempts/batch").set(auth(parent.token)).send({ attempts: [before] }).expect(200);

    const created = await ctx.http().post("/v1/classrooms").set(auth(teacher.token)).send({ name: "پنجم ب" }).expect(200);
    expect(created.body).toEqual({ id: expect.any(String), name: "پنجم ب", joinCode: expect.stringMatching(new RegExp(`^[${JOIN_ALPHABET}]{6}$`)), children: [] });
    expect(created.body.joinCode).not.toMatch(/[01OIL]/);
    const classId = created.body.id as string;
    await ctx.http().post("/v1/classrooms").set(auth(parent.token)).send({ name: "x" }).expect(403);
    await ctx.http().get("/v1/classrooms").set(auth(parent.token)).expect(403);

    // Join (parent, own child only), lower case and spaces accepted.
    const code = created.body.joinCode as string;
    const joined = await ctx.http().post("/v1/classrooms/join").set(auth(parent.token)).send({ code: ` ${code.toLowerCase()} `, childId: child.id }).expect(200);
    expect(joined.body).toEqual({ id: classId, name: "پنجم ب", joinCode: code });
    await ctx.http().post("/v1/classrooms/join").set(auth(parent.token)).send({ code, childId: child.id }).expect(200); // again: no-op
    await ctx.http().post("/v1/classrooms/join").set(auth(parent.token)).send({ code, childId: child2.id }).expect(404);
    expect((await ctx.http().post("/v1/classrooms/join").set(auth(parent.token)).send({ code: "ZZZZZZ", childId: child.id }).expect(404)).body).toEqual({ error: "bad_join_code" });
    expect((await ctx.http().post("/v1/classrooms/join").set(auth(parent.token)).send({ code: "AB0", childId: child.id }).expect(400)).body).toEqual({ error: "bad_join_code" });
    await ctx.http().post("/v1/classrooms/join").set(auth(teacher.token)).send({ code, childId: child.id }).expect(403);
    await ctx.http().post("/v1/classrooms/join").set(auth(parent2.token)).send({ code, childId: child2.id }).expect(200);

    // The teacher sees only nickname, picture and grade.
    const list = await ctx.http().get("/v1/classrooms").set(auth(teacher.token)).expect(200);
    expect(list.body).toEqual([
      {
        id: classId,
        name: "پنجم ب",
        joinCode: code,
        children: [
          { id: child.id, nickname: "پویا", avatar: 3, grade: 5 },
          { id: child2.id, nickname: "نیلو", avatar: 3, grade: 5 },
        ],
      },
    ]);

    // Answers after joining.
    const q = makeClockQuestion("angle", 1, 5);
    const after = Array.from({ length: 4 }, (_, i) => attempt(child.id, { response: q.answer, createdAt: Date.now() + i }));
    await ctx.http().post("/v1/attempts/batch").set(auth(parent.token)).send({ attempts: after }).expect(200);

    const heat = await ctx.http().get(`/v1/classrooms/${classId}/heatmap`).set(auth(teacher.token)).expect(200);
    const state = await ctx.prisma.skillState.findUniqueOrThrow({ where: { childId_skill: { childId: child.id, skill: "clock:angle" } } });
    expect(heat.body).toEqual({
      skills: ["clock:angle"],
      rows: [
        { childId: child.id, nickname: "پویا", cells: [{ stage: stageOf(state.theta, state.n), answers: 4 }] },
        { childId: child2.id, nickname: "نیلو", cells: [null] },
      ],
    });
    expect(JSON.stringify(heat.body)).not.toMatch(/theta/);

    // Another teacher: nothing of this classroom.
    expect((await ctx.http().get("/v1/classrooms").set(auth(teacher2.token)).expect(200)).body).toEqual([]);
    expect((await ctx.http().get(`/v1/classrooms/${classId}/heatmap`).set(auth(teacher2.token)).expect(404)).body).toEqual({ error: "not_found" });
    await ctx.http().get(`/v1/classrooms/${classId}/assignments`).set(auth(teacher2.token)).expect(404);
    await ctx.http().post(`/v1/classrooms/${classId}/assignments`).set(auth(teacher2.token)).send({ title: "x", skills: ["clock:angle"], due: "2099-01-01" }).expect(404);
    await ctx.http().delete(`/v1/classrooms/${classId}`).set(auth(teacher2.token)).expect(404);
    await ctx.http().delete(`/v1/classrooms/${classId}/children/${child.id}`).set(auth(teacher2.token)).expect(404);
    await ctx.http().get(`/v1/classrooms/${classId}/heatmap`).set(auth(parent.token)).expect(403);

    // Assignments.
    const today = new Date();
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const tomorrow = ymd(new Date(today.getTime() + DAY));
    const past = ymd(new Date(today.getTime() - 3 * DAY));
    const a1 = await ctx.http().post(`/v1/classrooms/${classId}/assignments`).set(auth(teacher.token)).send({ title: "ساعت", skills: ["clock:angle", "clock:mirror"], due: tomorrow }).expect(200);
    expect(a1.body).toEqual({ id: expect.any(String), classroomId: classId, title: "ساعت", skills: ["clock:angle", "clock:mirror"], due: tomorrow, createdAt: expect.any(Number) });
    await ctx.http().post(`/v1/classrooms/${classId}/assignments`).set(auth(teacher.token)).send({ title: "old", skills: ["clock:angle"], due: past }).expect(200);
    expect((await ctx.http().post(`/v1/classrooms/${classId}/assignments`).set(auth(teacher.token)).send({ title: "x", skills: ["nope:x"], due: tomorrow }).expect(400)).body).toEqual({ error: "unknown_skill" });
    expect((await ctx.http().post(`/v1/classrooms/${classId}/assignments`).set(auth(teacher.token)).send({ title: "x", skills: ["clock:angle"], due: "2026-02-30" }).expect(400)).body).toEqual({ error: "bad_date" });
    expect((await ctx.http().get(`/v1/classrooms/${classId}/assignments`).set(auth(teacher.token)).expect(200)).body).toHaveLength(2);

    // The parent sees open assignments only, and the session can draw from one.
    const open = await ctx.http().get(`/v1/children/${child.id}/assignments`).set(auth(parent.token)).expect(200);
    expect(open.body).toEqual([a1.body]);
    const session = await ctx.http().get(`/v1/children/${child.id}/session?assignment=${a1.body.id}`).set(auth(parent.token)).expect(200);
    for (const item of session.body as { tool: string; type: string; mode: string }[]) if (item.mode !== "review") expect(["clock:angle", "clock:mirror"]).toContain(`${item.tool}:${item.type}`);
    await ctx.http().get(`/v1/children/${child2.id}/assignments`).set(auth(parent.token)).expect(404);

    await ctx.http().delete(`/v1/classrooms/${classId}/assignments/${a1.body.id}`).set(auth(teacher.token)).expect(204);
    expect((await ctx.http().get(`/v1/children/${child.id}/assignments`).set(auth(parent.token)).expect(200)).body).toEqual([]);

    // Leaving: the parent for their child, the teacher for anyone in the class.
    await ctx.http().delete(`/v1/classrooms/${classId}/children/${child2.id}`).set(auth(parent.token)).expect(404);
    await ctx.http().delete(`/v1/classrooms/${classId}/children/${child.id}`).set(auth(parent.token)).expect(204);
    await ctx.http().delete(`/v1/classrooms/${classId}/children/${child2.id}`).set(auth(teacher.token)).expect(204);
    expect((await ctx.http().get("/v1/classrooms").set(auth(teacher.token)).expect(200)).body[0].children).toEqual([]);

    await ctx.http().delete(`/v1/classrooms/${classId}`).set(auth(teacher.token)).expect(204);
    expect(await ctx.prisma.assignment.count({ where: { classroomId: classId } })).toBe(0);
  });
});

describe("daily challenge", () => {
  it("is the shared dailyChallenge() of that date", async () => {
    const { token } = await signIn(ctx, "parent");
    const res = await ctx.http().get("/v1/daily-challenge/2026-11-20").set(auth(token)).expect(200);
    const day = Date.UTC(2026, 10, 20) / 86_400_000;
    expect(day).toBe(dayNumber(new Date(2026, 10, 20, 15, 30).getTime()));
    expect(res.body).toEqual(dailyChallenge(SKILLS, day));
    expect(res.body).toHaveLength(Math.min(3, SKILLS.length));
    const other = await ctx.http().get("/v1/daily-challenge/2026-11-21").set(auth(token)).expect(200);
    expect(other.body).toEqual(dailyChallenge(SKILLS, day + 1));
    expect((await ctx.http().get("/v1/daily-challenge/2026-13-01").set(auth(token)).expect(400)).body).toEqual({ error: "bad_date" });
    await ctx.http().get("/v1/daily-challenge/2026-11-20").expect(401);
  });
});

describe("DELETE /v1/me", () => {
  it("removes the parent, their children and everything about them", async () => {
    const p = await signIn(ctx, "parent");
    const t = await signIn(ctx, "teacher");
    const child = childBody();
    await ctx.http().put(`/v1/children/${child.id}`).set(auth(p.token)).send(child).expect(200);
    const cls = await ctx.http().post("/v1/classrooms").set(auth(t.token)).send({ name: "ششم" }).expect(200);
    await ctx.http().post("/v1/classrooms/join").set(auth(p.token)).send({ code: cls.body.joinCode, childId: child.id }).expect(200);
    await ctx.http().post(`/v1/classrooms/${cls.body.id}/assignments`).set(auth(t.token)).send({ title: "x", skills: ["clock:angle"], due: "2099-01-01" }).expect(200);
    const wrong = attempt(child.id, { response: -5, tag: "other", score: 0 });
    await ctx.http().post("/v1/attempts/batch").set(auth(p.token)).send({ attempts: [wrong, attempt(child.id, { seed: 8, response: makeClockQuestion("angle", 1, 8).answer })] }).expect(200);
    expect(await ctx.prisma.reviewItem.count({ where: { childId: child.id } })).toBe(1);
    expect(await ctx.prisma.skillState.count({ where: { childId: child.id } })).toBe(1);

    await ctx.http().delete("/v1/me").set(auth(p.token)).expect(204);
    await ctx.http().get("/v1/me").set(auth(p.token)).expect(401);
    const counts = await Promise.all([
      ctx.prisma.user.count({ where: { id: p.user.id } }),
      ctx.prisma.authToken.count({ where: { userId: p.user.id } }),
      ctx.prisma.otpCode.count({ where: { phone: p.phone } }),
      ctx.prisma.child.count({ where: { id: child.id } }),
      ctx.prisma.attempt.count({ where: { childId: child.id } }),
      ctx.prisma.skillState.count({ where: { childId: child.id } }),
      ctx.prisma.reviewItem.count({ where: { childId: child.id } }),
      ctx.prisma.membership.count({ where: { childId: child.id } }),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    // The teacher's classroom stays, now empty; the teacher's own deletion takes it and its assignments.
    expect((await ctx.http().get("/v1/classrooms").set(auth(t.token)).expect(200)).body[0].children).toEqual([]);
    await ctx.http().delete("/v1/me").set(auth(t.token)).expect(204);
    expect(await ctx.prisma.classroom.count({ where: { id: cls.body.id } })).toBe(0);
    expect(await ctx.prisma.assignment.count({ where: { classroomId: cls.body.id } })).toBe(0);
  });
});

describe("http", () => {
  it("CORS allows only the app origins; security headers; errors as { error }", async () => {
    const ok = await ctx.http().options("/v1/me").set("Origin", "http://localhost:3217").set("Access-Control-Request-Method", "GET");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:3217");
    const bad = await ctx.http().options("/v1/me").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "GET");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
    const res = await ctx.http().get("/v1/nothing-here").expect(404);
    expect(res.body).toEqual({ error: "not_found" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect((await ctx.http().post("/v1/auth/otp").set("Content-Type", "application/json").send("{oops").expect(400)).body).toEqual({ error: "bad_json" });
  });
});
