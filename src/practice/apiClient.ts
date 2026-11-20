"use client";

// Talking to the server (src/practice/api.ts is the contract). The address
// is fixed at build time (NEXT_PUBLIC_API_URL); without it the app never
// makes a network request, exactly as in phase 1.

import type { Role, User, VerifyResponse } from "./api";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const hasServer = API_URL !== "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** Persian words for the server's error codes. */
export const ERROR_TEXT: Record<string, string> = {
  bad_code: "کد درست نیست.",
  expired: "کد منقضی شده است؛ کد تازه بگیرید.",
  too_many_tries: "دفعه‌های امتحان تمام شد؛ کد تازه بگیرید.",
  rate_limited: "چند بار پشت سر هم کد خواستید؛ چند دقیقه بعد دوباره امتحان کنید.",
  bad_phone: "شماره همراه درست نیست (مثل ۰۹۱۲۳۴۵۶۷۸۹).",
  not_found: "پیدا نشد.",
  forbidden: "اجازه این کار را ندارید.",
  unauthorized: "دوباره وارد شوید.",
  bad_join_code: "کد کلاس درست نیست.",
  network: "به سرور وصل نشد. اینترنت را بررسی کنید.",
};
export const errorText = (e: unknown) => (e instanceof ApiError ? (ERROR_TEXT[e.code] ?? `خطا (${e.code})`) : ERROR_TEXT.network);

export async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  if (!hasServer) throw new ApiError(0, "network");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1${path}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `http_${res.status}`);
  return data as T;
}

/** Iranian mobile as 09xxxxxxxxx, from Persian or Arabic digits and +98 forms; null if it is not one. */
export function normalizePhone(raw: string): string | null {
  const d = raw
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[\s\-()]/g, "");
  const m = d.match(/^(?:\+98|0098|98|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : null;
}

export const requestOtp = (phone: string) => api<void>("/auth/otp", { body: { phone } });
export const verifyOtp = (phone: string, code: string, role: Role, device?: string) => api<VerifyResponse>("/auth/verify", { body: { phone, code, role, device } });
export const getMe = (token: string) => api<User>("/me", { token });
export const logout = (token: string) => api<void>("/auth/logout", { method: "POST", token });
