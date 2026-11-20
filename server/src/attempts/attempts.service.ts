import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { badRequest } from "../common/errors";
import { uuid } from "../common/validate";
import { PrismaService } from "../prisma/prisma.service";
import { adapterFor, scoreOf, type AttemptBatchResult } from "../shared/practice";
import { replay, toAttempt } from "./replay";

export const MAX_BATCH = 500;
const MAX_RESPONSE_CHARS = 16_000;
const EARLIEST = Date.UTC(2024, 0, 1);

/** One answer as the device sends it (src/practice/api.ts AttemptDto). Unknown keys (`synced`) are dropped. */
const AttemptItem = z.object({
  id: uuid(),
  childId: uuid(),
  tool: z.string().min(1).max(40),
  type: z.string().min(1).max(40),
  level: z.number().int().min(0).max(100),
  seed: z.number().int().min(0).max(2_147_483_647),
  generatorVersion: z.string().min(1).max(40),
  response: z.unknown(),
  tag: z.string().min(1).max(40),
  score: z.number().min(0).max(1),
  hintsUsed: z.number().int().min(0).max(10),
  durationMs: z.number().min(0).max(86_400_000),
  mode: z.enum(["practice", "review", "challenge", "daily", "exam"]),
  createdAt: z.number().int().min(EARLIEST),
});
type Item = z.infer<typeof AttemptItem>;

const Envelope = z.object({ attempts: z.array(z.unknown()) });

const idOf = (raw: unknown) => (raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id.slice(0, 64) : "");

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async batch(parentId: string, body: unknown): Promise<AttemptBatchResult> {
    const env = Envelope.safeParse(body);
    if (!env.success) throw badRequest();
    if (env.data.attempts.length > MAX_BATCH) throw badRequest("too_many");

    const rejected: AttemptBatchResult["rejected"] = [];
    const valid: Item[] = [];
    const latest = Date.now() + 2 * 86_400_000; // a device clock a little ahead is fine
    for (const raw of env.data.attempts) {
      const r = AttemptItem.safeParse(raw);
      if (!r.success || r.data.createdAt > latest) {
        rejected.push({ id: idOf(raw), reason: "malformed" });
        continue;
      }
      const json = JSON.stringify(r.data.response ?? null);
      if (json === undefined || json.length > MAX_RESPONSE_CHARS) {
        rejected.push({ id: r.data.id, reason: "malformed" });
        continue;
      }
      valid.push({ ...r.data, id: r.data.id.toLowerCase(), childId: r.data.childId.toLowerCase(), response: JSON.parse(json) });
    }

    const childIds = [...new Set(valid.map((a) => a.childId))];
    const mine = new Set(
      (await this.prisma.child.findMany({ where: { id: { in: childIds }, parentId }, select: { id: true } })).map((c) => c.id),
    );

    const seen = new Set<string>();
    let duplicates = 0;
    const accepted: Prisma.AttemptCreateManyInput[] = [];
    for (const a of valid) {
      if (!mine.has(a.childId)) {
        rejected.push({ id: a.id, reason: "unknown_child" });
        continue;
      }
      const adapter = adapterFor(a.tool);
      if (!adapter) {
        rejected.push({ id: a.id, reason: "unknown_tool" });
        continue;
      }
      if (!adapter.types.some((t) => t.key === a.type)) {
        rejected.push({ id: a.id, reason: "unknown_type" });
        continue;
      }
      if (!adapter.levels.includes(a.level)) {
        rejected.push({ id: a.id, reason: "unknown_level" });
        continue;
      }
      if (seen.has(a.id)) {
        duplicates++;
        continue;
      }
      seen.add(a.id);
      // Grade again from (tool, type, level, seed) with the same generator the app runs.
      let serverTag: string;
      try {
        serverTag = adapter.grade(a.type, a.level, a.seed, a.response);
      } catch {
        serverTag = "error";
      }
      accepted.push({
        id: a.id,
        childId: a.childId,
        tool: a.tool,
        type: a.type,
        level: a.level,
        seed: a.seed,
        generatorVersion: a.generatorVersion,
        response: a.response === null ? Prisma.JsonNull : (a.response as Prisma.InputJsonValue),
        tag: a.tag,
        score: a.score,
        hintsUsed: a.hintsUsed,
        durationMs: Math.round(a.durationMs),
        mode: a.mode,
        createdAt: new Date(a.createdAt),
        serverTag,
        serverScore: scoreOf(serverTag === "right", a.hintsUsed),
      });
    }

    if (!accepted.length) return { stored: 0, skipped: duplicates, mismatched: 0, rejected };

    return this.prisma.$transaction(
      async (tx) => {
        const children = [...new Set(accepted.map((a) => a.childId))].sort();
        // One batch per child at a time: the rebuild below sees every answer.
        await tx.$queryRaw`SELECT id FROM children WHERE id = ANY(${children}::uuid[]) ORDER BY id FOR UPDATE`;
        const existing = new Set(
          (await tx.attempt.findMany({ where: { id: { in: accepted.map((a) => a.id) } }, select: { id: true } })).map((a) => a.id),
        );
        // Idempotent: an id already stored is skipped, not changed.
        const fresh = accepted.filter((a) => !existing.has(a.id));
        if (fresh.length) await tx.attempt.createMany({ data: fresh, skipDuplicates: true });
        const mismatched = fresh.filter((a) => a.serverTag !== a.tag || a.serverScore !== a.score).length;
        const touched = [...new Set(fresh.map((a) => a.childId))];
        for (const childId of touched) await this.rebuild(tx, childId);
        return { stored: fresh.length, skipped: duplicates + existing.size, mismatched, rejected };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }

  /** skill_states and review_items of one child, from all their answers, replayed in order. */
  async rebuild(tx: Prisma.TransactionClient, childId: string) {
    const rows = await tx.attempt.findMany({ where: { childId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const { skills, reviews } = replay(childId, rows.map(toAttempt));
    await tx.skillState.deleteMany({ where: { childId } });
    await tx.reviewItem.deleteMany({ where: { childId } });
    if (skills.length)
      await tx.skillState.createMany({
        data: skills.map((s) => ({ childId, skill: s.skill, theta: s.theta, n: s.n, updatedAt: new Date(s.updatedAt) })),
      });
    if (reviews.length)
      await tx.reviewItem.createMany({
        data: reviews.map((r) => ({ attemptId: r.attemptId, childId, skill: r.skill, level: r.level, step: r.step, dueAt: new Date(r.dueAt) })),
      });
  }
}
