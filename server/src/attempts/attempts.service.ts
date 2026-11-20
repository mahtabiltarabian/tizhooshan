import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { badRequest } from "../common/errors";
import { uuid } from "../common/validate";
import { PrismaService } from "../prisma/prisma.service";
import { adapterFor, scoreOf, type AttemptBatchResult } from "../shared/practice";
import { replay, toAttempt, type ChildState } from "./replay";

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
  mode: z.enum(["practice", "review", "challenge", "daily", "exam", "placement"]),
  createdAt: z.number().int().min(EARLIEST),
  reviewOf: uuid().optional(),
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
      valid.push({
        ...r.data,
        id: r.data.id.toLowerCase(),
        childId: r.data.childId.toLowerCase(),
        reviewOf: r.data.mode === "review" ? r.data.reviewOf?.toLowerCase() : undefined,
        response: JSON.parse(json),
      });
    }

    const childIds = [...new Set(valid.map((a) => a.childId))];
    const mine = new Set(
      (await this.prisma.db.child.findMany({ where: { id: { in: childIds }, parentId }, select: { id: true } })).map((c) => c.id),
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
        reviewOf: a.reviewOf ?? null,
        createdAt: new Date(a.createdAt),
        serverTag,
        serverScore: scoreOf(serverTag === "right", a.hintsUsed),
      });
    }

    if (!accepted.length) return { stored: 0, skipped: duplicates, mismatched: 0, rejected };

    // The request's own transaction (PrismaService.asUser): the answers and
    // the rebuilt state are stored together, or not at all.
    const tx = this.prisma.db;
    const children = [...new Set(accepted.map((a) => a.childId))].sort();
    // One batch per child at a time: the rebuild below sees every answer.
    await tx.$queryRaw`SELECT id FROM children WHERE id = ANY(${children}::uuid[]) ORDER BY id FOR UPDATE`;
    const existing = new Set(
      (await tx.attempt.findMany({ where: { id: { in: accepted.map((a) => a.id) } }, select: { id: true } })).map((a) => a.id),
    );
    // Idempotent: an id already stored is skipped, not changed.
    const fresh = accepted.filter((a) => !existing.has(a.id));
    const { count: stored } = fresh.length ? await tx.attempt.createMany({ data: fresh, skipDuplicates: true }) : { count: 0 };
    const mismatched = fresh.filter((a) => a.serverTag !== a.tag || a.serverScore !== a.score).length;
    const touched = [...new Set(fresh.map((a) => a.childId))];
    for (const childId of touched) await this.update(tx, childId, fresh.filter((a) => a.childId === childId).map((a) => a.id));
    return { stored, skipped: duplicates + accepted.length - stored, mismatched, rejected };
  }

  /**
   * The child's state after new answers. When every new answer came after
   * all the stored ones (the usual case: one device syncing in order), they
   * are replayed onto the saved state; otherwise (two devices, a clock set
   * back) every answer is replayed from scratch. Both give the same state.
   */
  async update(tx: Prisma.TransactionClient, childId: string, newIds: string[]): Promise<"incremental" | "full"> {
    const [newest, rows] = await Promise.all([
      tx.attempt.aggregate({ where: { childId, id: { notIn: newIds } }, _max: { createdAt: true } }),
      tx.attempt.findMany({ where: { id: { in: newIds } } }),
    ]);
    const last = newest._max.createdAt?.getTime();
    if (last !== undefined && !rows.every((r) => r.createdAt.getTime() > last)) {
      await this.rebuild(tx, childId);
      return "full";
    }
    await this.save(tx, childId, replay(childId, rows.map(toAttempt), await this.load(tx, childId)));
    return "incremental";
  }

  /** The saved state of one child. */
  async load(tx: Prisma.TransactionClient, childId: string): Promise<ChildState> {
    // θ comes out as text for the same reason it goes in as text (save()).
    const [skills, reviews] = await Promise.all([
      tx.$queryRaw<{ skill: string; theta: string; n: number; updated_at: Date }[]>`
        SELECT skill, theta::text AS theta, n, updated_at FROM skill_states WHERE child_id = ${childId}::uuid`,
      tx.reviewItem.findMany({ where: { childId } }),
    ]);
    return {
      skills: skills.map((s) => ({ childId, skill: s.skill, theta: Number(s.theta), n: s.n, updatedAt: s.updated_at.getTime() })),
      reviews: reviews.map((r) => ({ childId, attemptId: r.attemptId, skill: r.skill, level: r.level, step: r.step as 1 | 3 | 7, dueAt: r.dueAt.getTime() })),
    };
  }

  /** skill_states and review_items of one child, from all their answers, replayed in order. */
  async rebuild(tx: Prisma.TransactionClient, childId: string) {
    const rows = await tx.attempt.findMany({ where: { childId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    await this.save(tx, childId, replay(childId, rows.map(toAttempt)));
  }

  private async save(tx: Prisma.TransactionClient, childId: string, { skills, reviews }: ChildState) {
    await tx.skillState.deleteMany({ where: { childId } });
    await tx.reviewItem.deleteMany({ where: { childId } });
    // θ goes in as text: Prisma sends numbers rounded to 15 digits, and the
    // saved θ must be exactly the replayed one, so that adding answers onto
    // it gives the same result as replaying everything.
    if (skills.length)
      await tx.$executeRaw`
        INSERT INTO skill_states (child_id, skill, theta, n, updated_at)
        SELECT ${childId}::uuid, s, t::float8, n, u::timestamp(3)
        FROM unnest(${skills.map((s) => s.skill)}::text[], ${skills.map((s) => String(s.theta))}::text[], ${skills.map((s) => s.n)}::int[], ${skills.map((s) => new Date(s.updatedAt).toISOString())}::text[]) AS x(s, t, n, u)`;
    if (reviews.length)
      await tx.reviewItem.createMany({
        data: reviews.map((r) => ({ attemptId: r.attemptId, childId, skill: r.skill, level: r.level, step: r.step, dueAt: new Date(r.dueAt) })),
      });
  }
}
