import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { ApiError } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC, ROLES, type AuthUser } from "./auth.decorators";
import { hashToken } from "./tokens";

const TOUCH_EVERY_MS = 5 * 60_000;

/** "Authorization: Bearer <token>" on every route except @Public(); then the @Roles() check. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: unknown = req.headers?.authorization;
    const m = typeof header === "string" ? header.match(/^Bearer ([A-Za-z0-9_-]{20,100})$/) : null;
    if (!m) throw new ApiError(401, "unauthorized");
    const tokenHash = hashToken(m[1]);
    const row = await this.prisma.authToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!row) throw new ApiError(401, "unauthorized");
    if (Date.now() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
      await this.prisma.authToken.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    const user: AuthUser = { id: row.user.id, role: row.user.role, phone: row.user.phone, tokenHash };
    req.user = user;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) throw new ApiError(403, "forbidden");
    return true;
  }
}
