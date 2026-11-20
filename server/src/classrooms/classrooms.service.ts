import { Injectable } from "@nestjs/common";
import { Prisma, type Assignment, type Classroom } from "@prisma/client";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { ApiError, badRequest, notFound } from "../common/errors";
import { parseYmd, todayDate, ymd } from "../common/dates";
import { asciiDigits, idParam, parseBody, uuid } from "../common/validate";
import type { AuthUser } from "../auth/auth.decorators";
import { ChildrenService } from "../children/children.service";
import { PrismaService } from "../prisma/prisma.service";
import { SKILLS, skillKey, stageOf, type AssignmentDto, type ClassroomDto, type Heatmap } from "../shared/practice";

/** No 0/O, 1/I/L: a code read aloud or copied from a board cannot be misread. */
export const JOIN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const newJoinCode = () => Array.from({ length: 6 }, () => JOIN_ALPHABET[randomInt(0, JOIN_ALPHABET.length)]).join("");
const JOIN_CODE = new RegExp(`^[${JOIN_ALPHABET}]{6}$`);

const CreateClassroom = z.object({ name: z.string().trim().min(1).max(60) });
const JoinBody = z.object({ code: z.string().max(20), childId: uuid() });
const CreateAssignment = z.object({
  title: z.string().trim().min(1).max(100),
  skills: z.array(z.string().max(80)).min(1).max(100),
  due: z.string().max(10),
});

const classroomDto = (c: Classroom): ClassroomDto => ({ id: c.id, name: c.name, joinCode: c.joinCode });
export const assignmentDto = (a: Assignment): AssignmentDto => ({
  id: a.id,
  classroomId: a.classroomId,
  title: a.title,
  skills: a.skills,
  due: ymd(a.due),
  createdAt: a.createdAt.getTime(),
});

@Injectable()
export class ClassroomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly children: ChildrenService,
  ) {}

  /** The teacher's own classroom, or 404: another teacher's classroom is "not found" too. */
  async ownClassroom(teacherId: string, rawId: string): Promise<Classroom> {
    const id = idParam(rawId);
    const c = await this.prisma.classroom.findUnique({ where: { id } });
    if (!c || c.teacherId !== teacherId) throw notFound();
    return c;
  }

  async list(teacherId: string): Promise<ClassroomDto[]> {
    const rows = await this.prisma.classroom.findMany({
      where: { teacherId },
      orderBy: { createdAt: "asc" },
      include: { memberships: { orderBy: { joinedAt: "asc" }, include: { child: { select: { id: true, nickname: true, avatar: true, grade: true } } } } },
    });
    // The teacher sees only nickname, picture and grade.
    return rows.map((c) => ({ ...classroomDto(c), children: c.memberships.map((m) => m.child) }));
  }

  async create(teacherId: string, body: unknown): Promise<ClassroomDto> {
    const { name } = parseBody(CreateClassroom, body);
    for (let i = 0; i < 8; i++) {
      try {
        const c = await this.prisma.classroom.create({ data: { teacherId, name, joinCode: newJoinCode() } });
        return { ...classroomDto(c), children: [] };
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
    throw new ApiError(503, "try_again");
  }

  async remove(teacherId: string, id: string) {
    const c = await this.ownClassroom(teacherId, id);
    await this.prisma.classroom.delete({ where: { id: c.id } });
  }

  async join(parentId: string, body: unknown): Promise<ClassroomDto> {
    const p = parseBody(JoinBody, body, "bad_join_code");
    const code = asciiDigits(p.code).replace(/[\s-]/g, "").toUpperCase();
    if (!JOIN_CODE.test(code)) throw badRequest("bad_join_code");
    const child = await this.children.ownChild(parentId, p.childId);
    const c = await this.prisma.classroom.findUnique({ where: { joinCode: code } });
    if (!c) throw new ApiError(404, "bad_join_code");
    await this.prisma.membership.createMany({ data: [{ classroomId: c.id, childId: child.id, joinedAt: new Date() }], skipDuplicates: true });
    return classroomDto(c);
  }

  /** The child's parent, or the classroom's teacher. */
  async leave(user: AuthUser, rawClassroomId: string, rawChildId: string) {
    const classroomId = idParam(rawClassroomId);
    const childId = idParam(rawChildId);
    const m = await this.prisma.membership.findUnique({
      where: { classroomId_childId: { classroomId, childId } },
      include: { child: { select: { parentId: true } }, classroom: { select: { teacherId: true } } },
    });
    const allowed = m && (user.role === "parent" ? m.child.parentId === user.id : m.classroom.teacherId === user.id);
    if (!m || !allowed) throw notFound();
    await this.prisma.membership.delete({ where: { classroomId_childId: { classroomId, childId } } });
  }

  async assignments(teacherId: string, id: string): Promise<AssignmentDto[]> {
    const c = await this.ownClassroom(teacherId, id);
    const rows = await this.prisma.assignment.findMany({ where: { classroomId: c.id }, orderBy: [{ due: "asc" }, { createdAt: "asc" }] });
    return rows.map(assignmentDto);
  }

  async createAssignment(teacherId: string, id: string, body: unknown): Promise<AssignmentDto> {
    const c = await this.ownClassroom(teacherId, id);
    const p = parseBody(CreateAssignment, body);
    const due = parseYmd(p.due);
    if (!due) throw badRequest("bad_date");
    const known = new Set(SKILLS.map((s) => s.key));
    const skills = [...new Set(p.skills)];
    if (skills.some((s) => !known.has(s))) throw badRequest("unknown_skill");
    const a = await this.prisma.assignment.create({ data: { classroomId: c.id, title: p.title, skills, due } });
    return assignmentDto(a);
  }

  async removeAssignment(teacherId: string, id: string, rawAid: string) {
    const c = await this.ownClassroom(teacherId, id);
    const aid = idParam(rawAid);
    const { count } = await this.prisma.assignment.deleteMany({ where: { id: aid, classroomId: c.id } });
    if (!count) throw notFound();
  }

  /** Open assignments (due today or later, server calendar) of every classroom the child is in. */
  async childAssignments(parentId: string, rawChildId: string): Promise<AssignmentDto[]> {
    const child = await this.children.ownChild(parentId, rawChildId);
    const rows = await this.prisma.assignment.findMany({
      where: { classroom: { memberships: { some: { childId: child.id } } }, due: { gte: todayDate() } },
      orderBy: [{ due: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(assignmentDto);
  }

  /**
   * One row per child, one column per skill practiced in the class. A cell
   * is the stage (stageOf, never θ) and the number of answers given since
   * the child joined this classroom; null when none.
   */
  async heatmap(teacherId: string, id: string): Promise<Heatmap> {
    const c = await this.ownClassroom(teacherId, id);
    const members = await this.prisma.membership.findMany({
      where: { classroomId: c.id },
      orderBy: { joinedAt: "asc" },
      include: { child: { select: { id: true, nickname: true } } },
    });
    const counts = await this.prisma.$queryRaw<{ child_id: string; tool: string; type: string; n: number }[]>`
      SELECT a.child_id::text AS child_id, a.tool, a.type, count(*)::int AS n
      FROM attempts a
      JOIN memberships m ON m.child_id = a.child_id AND m.classroom_id = ${c.id}::uuid
      WHERE a.created_at >= m.joined_at
      GROUP BY a.child_id, a.tool, a.type`;
    const states = await this.prisma.skillState.findMany({ where: { childId: { in: members.map((m) => m.childId) } } });
    const state = new Map(states.map((s) => [`${s.childId}|${s.skill}`, s]));
    const answers = new Map(counts.map((r) => [`${r.child_id}|${skillKey(r.tool, r.type)}`, r.n]));
    const order = new Map(SKILLS.map((s, i) => [s.key, i]));
    const skills = [...new Set(counts.map((r) => skillKey(r.tool, r.type)))].sort(
      (a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || a.localeCompare(b),
    );
    return {
      skills,
      rows: members.map((m) => ({
        childId: m.child.id,
        nickname: m.child.nickname,
        cells: skills.map((skill) => {
          const n = answers.get(`${m.childId}|${skill}`) ?? 0;
          if (!n) return null;
          const s = state.get(`${m.childId}|${skill}`);
          return { stage: s ? stageOf(s.theta, s.n) : 0, answers: n };
        }),
      })),
    };
  }
}
