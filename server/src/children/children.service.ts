import { Injectable } from "@nestjs/common";
import type { Child } from "@prisma/client";
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
  grade: z.union([z.literal(4), z.literal(5), z.literal(6)]),
  // Solar Hijri year, as the app asks for it (e.g. 1393).
  birthYear: z.number().int().min(1370).max(1430),
  dailyLimitMin: z.number().int().min(1).max(600),
  createdAt: z.number().int().min(0).max(8.64e15),
});

export const childDto = (c: Child): ChildDto => ({
  id: c.id,
  nickname: c.nickname,
  avatar: c.avatar,
  grade: c.grade as ChildDto["grade"],
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
    const child = await this.prisma.child.findUnique({ where: { id } });
    if (!child || child.parentId !== parentId) throw notFound();
    return child;
  }

  async list(parentId: string) {
    const rows = await this.prisma.child.findMany({ where: { parentId }, orderBy: { createdAt: "asc" } });
    return rows.map(childDto);
  }

  async put(parentId: string, rawId: string, body: unknown) {
    const id = idParam(rawId);
    const p = parseBody(ChildBody, body);
    if (p.id.toLowerCase() !== id) throw badRequest("id_mismatch");
    const existing = await this.prisma.child.findUnique({ where: { id } });
    if (existing && existing.parentId !== parentId) throw forbidden();
    const data = { nickname: p.nickname, avatar: p.avatar, grade: p.grade, birthYear: p.birthYear, dailyLimitMin: p.dailyLimitMin, createdAt: new Date(p.createdAt) };
    const row = await this.prisma.child.upsert({ where: { id }, create: { id, parentId, ...data }, update: data });
    return childDto(row);
  }

  async remove(parentId: string, rawId: string) {
    const child = await this.ownChild(parentId, rawId);
    await this.prisma.child.delete({ where: { id: child.id } }); // cascades to attempts, skills, reviews, memberships
  }
}
