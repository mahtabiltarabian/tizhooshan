import { asciiDigits } from "./validate";

/**
 * Iranian mobile as 09xxxxxxxxx, from Persian or Arabic digits and the
 * +98 / 0098 / 98 forms (same rule as the app's normalizePhone); null if it
 * is not one.
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const d = asciiDigits(raw).replace(/[\s\-()‌‏‎]/g, "");
  const m = d.match(/^(?:\+98|0098|98|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : null;
}

/** "0912***4567": safe for logs and for the client. */
export const maskPhone = (phone: string) => `${phone.slice(0, 4)}***${phone.slice(-4)}`;
