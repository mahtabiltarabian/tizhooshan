"use client";

// Parent lock and consent. The PIN is stored only as a salted hash, on this
// device. Forgetting it means "delete everything" from the setup screen.

import { db } from "./db";

export interface ParentMeta {
  salt: string;
  pinHash: string;
  /** When the parent agreed to what is stored (CONSENT_TEXT). */
  consentAt: number;
}

export const CONSENT_POINTS = [
  "برای هر کودک فقط یک نام مستعار، پایه، سال تولد و یک تصویر نمادین نگه داشته می‌شود؛ نه نام کامل، نه تاریخ تولد دقیق.",
  "پاسخ‌های کودک (درست یا نوع اشتباه، زمان، تعداد راهنمایی) برای انتخاب سؤال مناسب و گزارش شما ثبت می‌شود.",
  "همه این‌ها فقط روی همین دستگاه می‌ماند و به هیچ جا فرستاده نمی‌شود، مگر خودتان دستگاه را به حساب والد وصل کنید.",
  "هر وقت بخواهید، از «بخش والدین» یک کودک یا همه داده‌ها را برای همیشه پاک می‌کنید.",
  "هیچ عدد هوش (IQ) یا درصد قبولی نشان داده نمی‌شود؛ گزارش فقط پیشرفت هر مهارت است.",
];

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hash(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (crypto.subtle) return hex(await crypto.subtle.digest("SHA-256", data));
  // Plain http on a local network has no crypto.subtle; a simple FNV-1a hash
  // still keeps the PIN out of sight (it only guards against children).
  let h = 0x811c9dc5;
  for (const b of data) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return "fnv" + h.toString(16);
}

export const getParent = () => db.getMeta<ParentMeta>("parent");

export async function setParent(pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const meta: ParentMeta = { salt, pinHash: await hash(pin, salt), consentAt: Date.now() };
  await db.setMeta("parent", meta);
  return meta;
}

export async function checkPin(pin: string) {
  const meta = await getParent();
  return !!meta && (await hash(pin, meta.salt)) === meta.pinHash;
}

export const validPin = (pin: string) => /^\d{4,6}$/.test(pin);

/** Persian or Arabic digits typed on a phone keyboard, as Western digits. */
export const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
