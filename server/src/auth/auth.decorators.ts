import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Role } from "@prisma/client";

export const IS_PUBLIC = "isPublic";
export const ROLES = "roles";

/** No token needed (only /v1/auth/otp and /v1/auth/verify). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Only users with one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  role: Role;
  phone: string;
  tokenHash: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
