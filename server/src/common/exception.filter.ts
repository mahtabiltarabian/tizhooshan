import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { ApiError } from "./errors";

const CODE_BY_STATUS: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  409: "conflict",
  413: "payload_too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
};

/**
 * Every error leaves as `{ error: "<code>" }` (src/practice/api.ts). Unknown
 * errors are logged by name and code only: messages of database errors can
 * quote the data (a child's nickname), so they are never written out.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger("Error");

  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    if (e instanceof ApiError) return res.status(e.getStatus()).json({ error: e.code });
    if (e instanceof HttpException) {
      const status = e.getStatus();
      return res.status(status).json({ error: CODE_BY_STATUS[status] ?? (status >= 500 ? "internal" : "bad_request") });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") return res.status(404).json({ error: "not_found" });
      if (e.code === "P2002") return res.status(409).json({ error: "conflict" });
      this.log.error(`database error ${e.code}`);
    } else {
      const name = e instanceof Error ? e.name : typeof e;
      this.log.error(`unhandled ${name}${e instanceof Error && e.stack ? `\n${e.stack.split("\n").slice(1, 6).join("\n")}` : ""}`);
    }
    return res.status(500).json({ error: "internal" });
  }
}
