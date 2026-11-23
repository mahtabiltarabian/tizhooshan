import { Injectable } from "@nestjs/common";
import { Prisma, type Child } from "@prisma/client";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../common/errors";
import { idParam, parseBody, uuid } from "../common/validate";
import { PrismaService } from "../prisma/prisma.service";
import type { ChildDto } from "../shared/practice";

/** The device profile (src/practice/types.ts Profile): nickname only, no full name, no birth date. */
export const ChildBody = z.object({
  id: uuid(),
  nickname: z.string().trim().min(1).max(30),
  avatar: z.number().int().min(0).max(99),
  // Both optional: only the nickname is required.
  grade: z.union([z.literal(4), z.literal(5), z.literal(6)]).nullish(),
  // Solar Hijri year, as the app asks for it (e.g. 1393).
  birthYear: z.number().int().min(1370).max(1430).nullish(),
  dailyLimitMin: z.number().int().min(1).max(600),
  createdAt: z.number().int().min(0).max(8.64e15),
});

export const childDto = (c: Child): ChildDto => ({
  id: c.id,
  nickname: c.nickname,
  avatar: c.avatar,
  grade: (c.grade ?? null) as ChildDto["grade"],
  birthYear: c.birthYear,
  dailyLimitMin: c.dailyLimitMin,
  createdAt: c.createdAt.getTime(),
});

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  /** The parent's own child, or 404 (another parent's child is "not found" too). */
  async ownChild(parentId: string, rawId: string): Promise<Child> {
    const id = idParam(rawId);
    const child = await this.prisma.db.child.findUnique({ where: { id } });
    if (!child || child.parentId !== parentId) throw notFound();
    return child;
  }

  async list(parentId: string) {
    const rows = await this.prisma.db.child.findMany({ where: { parentId }, orderBy: { createdAt: "asc" } });
    return rows.map(childDto);
  }

  async put(parentId: string, rawId: string, body: unknown) {
    const id = idParam(rawId);
    const p = parseBody(ChildBody, body);
    if (p.id.toLowerCase() !== id) throw badRequest("id_mismatch");
    // Another parent's child is invisible here (row-level security), so
    // whether the id is taken is asked of the system connection: only a yes
    // or no comes back.
    if (await this.takenByOther(parentId, id)) throw forbidden();
    const data = { nickname: p.nickname, avatar: p.avatar, grade: p.grade ?? null, birthYear: p.birthYear ?? null, dailyLimitMin: p.dailyLimitMin, createdAt: new Date(p.createdAt) };
    try {
      const row = await this.prisma.db.child.upsert({ where: { id }, create: { id, parentId, ...data }, update: data });
      return childDto(row);
    } catch (e) {
      // The same id made by another parent at this very moment.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw forbidden();
      throw e;
    }
  }

  private async takenByOther(parentId: string, id: string) {
    return (await this.prisma.child.count({ where: { id, parentId: { not: parentId } } })) > 0;
  }

  async remove(parentId: string, rawId: string) {
    const child = await this.ownChild(parentId, rawId);
    await this.prisma.db.child.delete({ where: { id: child.id } }); // cascades to attempts, skills, reviews, memberships
  }
}
