import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, Role, User } from "@prisma/client";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ApiError } from "../common/errors";
import { maskPhone, normalizePhone } from "../common/phone";
import { asciiDigits } from "../common/validate";
import { PrismaService } from "../prisma/prisma.service";
import type { UserDto, VerifyResponse } from "../shared/practice";
import { SMS_SENDER, type SmsSender } from "./sms";
import { hashToken, newToken } from "./tokens";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_TRIES = 5;
export const OTP_WINDOW_MS = 10 * 60_000;
export const OTP_PER_WINDOW = 3;

export const userDto = (u: Pick<User, "id" | "role" | "phone">): UserDto => ({ id: u.id, role: u.role, phone: maskPhone(u.phone) });

@Injectable()
export class AuthService {
  private readonly secret = process.env.OTP_SECRET || "dev-otp-secret";

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  /** Keyed hash, so a copy of the table alone does not give the codes away. */
  private hashCode(phone: string, code: string) {
    return createHmac("sha256", this.secret).update(`${phone}:${code}`).digest("hex");
  }

  /** One request per phone at a time, so the count and the insert cannot race. */
  private lockPhone(tx: Prisma.TransactionClient, phone: string) {
    const key = `otp:${phone}`;
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  async requestOtp(rawPhone: unknown) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new ApiError(400, "bad_phone");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.$transaction(async (tx) => {
      await this.lockPhone(tx, phone);
      const recent = await tx.otpCode.count({ where: { phone, createdAt: { gt: new Date(Date.now() - OTP_WINDOW_MS) } } });
      if (recent >= OTP_PER_WINDOW) throw new ApiError(429, "rate_limited");
      await tx.otpCode.create({ data: { phone, codeHash: this.hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    });
    await this.sms.sendOtp(phone, code);
  }

  async verify(input: { phone: unknown; code: unknown; role: Role; device?: string }): Promise<VerifyResponse> {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new ApiError(400, "bad_phone");
    const code = typeof input.code === "string" ? asciiDigits(input.code.trim()) : "";
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockPhone(tx, phone);
      // Only the newest unused code of the phone counts.
      const otp = await tx.otpCode.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: "desc" } });
      if (!otp) return "bad_code" as const;
      if (otp.expiresAt <= now) return "expired" as const;
      if (otp.tries >= OTP_MAX_TRIES) return "too_many_tries" as const;
      const expected = Buffer.from(otp.codeHash, "hex");
      const given = Buffer.from(this.hashCode(phone, /^\d{6}$/.test(code) ? code : "-"), "hex");
      if (!timingSafeEqual(expected, given)) {
        await tx.otpCode.update({ where: { id: otp.id }, data: { tries: { increment: 1 } } });
        return "bad_code" as const;
      }
      // A code works once; older codes of this phone die with it.
      await tx.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: now } });
      return "ok" as const;
    });
    if (result !== "ok") throw new ApiError(400, result);

    // The first verify creates the user with `role`; later verifies keep the existing role.
    const user = await this.prisma.user.upsert({ where: { phone }, create: { phone, role: input.role }, update: {} });
    const token = newToken();
    await this.prisma.authToken.create({ data: { tokenHash: hashToken(token), userId: user.id, device: input.device?.trim() || null } });
    return { token, user: userDto(user) };
  }

  async logout(tokenHash: string) {
    await this.prisma.authToken.deleteMany({ where: { tokenHash } });
  }

  /** The user, their children and everything about them, their classrooms, tokens and codes. */
  async deleteUser(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return;
      await tx.otpCode.deleteMany({ where: { phone: user.phone } });
      await tx.user.delete({ where: { id: userId } }); // cascades (schema.prisma)
    });
  }
}
