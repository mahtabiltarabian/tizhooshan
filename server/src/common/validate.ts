import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "./errors";

/** Parses a request body with a zod schema, or answers 400 `code`. */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown, code = "bad_request"): z.infer<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw badRequest(code);
  return r.data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);
export const uuid = () => z.string().regex(UUID);

/** A path id that is not a uuid cannot name anything: 404, before the database sees it. */
export function idParam(s: string): string {
  if (!isUuid(s)) throw notFound();
  return s.toLowerCase();
}

/** Persian and Arabic-Indic digits to ASCII. */
export const asciiDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
