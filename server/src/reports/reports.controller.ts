import { Controller, Get, Module, Param, Query } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { toAttempt } from "../attempts/replay";
import { CurrentUser, Roles, type AuthUser } from "../auth/auth.decorators";
import { notFound } from "../common/errors";
import { isUuid } from "../common/validate";
import { ChildrenService } from "../children/children.service";
import { PrismaService } from "../prisma/prisma.service";
import { buildReport, planSession, SKILLS, type ReportData, type SessionItem, type SkillState } from "../shared/practice";

@Controller("children")
@Roles("parent")
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly children: ChildrenService,
  ) {}

  private async skillStates(childId: string): Promise<SkillState[]> {
    const rows = await this.prisma.skillState.findMany({ where: { childId } });
    return rows.map((s) => ({ childId, skill: s.skill, theta: s.theta, n: s.n, updatedAt: s.updatedAt.getTime() }));
  }

  /** The parent report (src/practice/report.ts), from the child's synced answers. */
  @Get(":id/report")
  async report(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<ReportData> {
    const child = await this.children.ownChild(user.id, id);
    const [rows, skills] = await Promise.all([
      this.prisma.attempt.findMany({ where: { childId: child.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      this.skillStates(child.id),
    ]);
    return buildReport(rows.map(toAttempt), skills, Date.now());
  }

  /**
   * The next session from the server's copy of the child's state (same
   * planner as the app). Optional `?assignment=<id>`: draw only from that
   * assignment's skills, when it is one of the child's classrooms'.
   */
  @Get(":id/session")
  async session(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("assignment") assignment?: string): Promise<SessionItem[]> {
    const child = await this.children.ownChild(user.id, id);
    let only: string[] | undefined;
    if (assignment !== undefined) {
      const a = isUuid(assignment)
        ? await this.prisma.assignment.findFirst({ where: { id: assignment, classroom: { memberships: { some: { childId: child.id } } } } })
        : null;
      if (!a) throw notFound();
      only = a.skills;
    }
    const [skills, reviews] = await Promise.all([this.skillStates(child.id), this.prisma.reviewItem.findMany({ where: { childId: child.id } })]);
    return planSession({
      catalog: SKILLS,
      states: new Map(skills.map((s) => [s.skill, s])),
      reviews: reviews.map((r) => ({ childId: r.childId, attemptId: r.attemptId, skill: r.skill, level: r.level, step: r.step as 1 | 3 | 7, dueAt: r.dueAt.getTime() })),
      now: Date.now(),
      seed: randomInt(0, 1_000_000_000),
      only,
    });
  }
}

@Module({ controllers: [ReportsController] })
export class ReportsModule {}
