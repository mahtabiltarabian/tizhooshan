import { Body, Controller, Delete, Get, HttpCode, Post } from "@nestjs/common";
import { z } from "zod";
import { ApiError } from "../common/errors";
import { parseBody } from "../common/validate";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser, Public, type AuthUser } from "./auth.decorators";
import { AuthService, userDto } from "./auth.service";

const OtpBody = z.object({ phone: z.string().max(40) });
const VerifyBody = z.object({
  phone: z.string().max(40),
  code: z.string().max(20),
  role: z.enum(["parent", "teacher"]),
  device: z.string().max(60).optional(),
});

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("otp")
  @HttpCode(204)
  async otp(@Body() body: unknown) {
    const { phone } = parseBody(OtpBody, body, "bad_phone");
    await this.auth.requestOtp(phone);
  }

  @Public()
  @Post("verify")
  @HttpCode(200)
  verify(@Body() body: unknown) {
    return this.auth.verify(parseBody(VerifyBody, body));
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.tokenHash);
  }
}

@Controller("me")
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthUser) {
    const u = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!u) throw new ApiError(401, "unauthorized");
    return userDto(u);
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.auth.deleteUser(user.id);
  }
}
