// The contract between the app and the server (server/), REST under /v1.
// Plan v2, section 9.3, adapted to phase 2 of plan v3. Both sides import
// these types; the server checks every request body at run time too.
//
// Auth: "Authorization: Bearer <token>" on every call except /v1/auth/*.
// Errors: { error: string } with a 4xx/5xx status; `error` is a short
// machine code ("bad_code", "not_found", "forbidden", "rate_limited" …).
// Requests per address are limited (sign-in more tightly): past the limit,
// 429 "rate_limited" with a Retry-After header in seconds.

import type { Attempt, Profile } from "./types";

export type Role = "parent" | "teacher";

// POST /v1/auth/otp → 204. Sends a 6-digit code by SMS (in development the
// server only writes it to its log). At most 3 codes per phone per 10 minutes.
export interface OtpRequest {
  /** Iranian mobile, normalised by the client to 09xxxxxxxxx. */
  phone: string;
}

// POST /v1/auth/verify → VerifyResponse. A code works once, for 5 minutes,
// with at most 5 wrong tries. The first verify of a phone creates the user
// with `role`; later verifies keep the existing role.
export interface VerifyRequest {
  phone: string;
  code: string;
  role: Role;
  /** Shown in the list of signed-in devices: "تبلت خانه". */
  device?: string;
}
export interface VerifyResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  role: Role;
  /** Masked: "0912***4567". */
  phone: string;
}

// GET /v1/me → User. DELETE /v1/me → 204: deletes the user, their children
// and everything recorded about them, and every token (plan v3, section 12).
// POST /v1/auth/logout → 204: revokes the token used.

/** A child as the server keeps it: the device profile, same id. */
/** A profile as the server keeps it: never the photo; grade and birth year may be null. */
export type ChildDto = Omit<Profile, "createdAt" | "photo" | "grade" | "birthYear"> & { grade: 4 | 5 | 6 | null; birthYear: number | null; createdAt: number };

// GET /v1/children → ChildDto[] (parent only).
// PUT /v1/children/:id with ChildDto → ChildDto. Creates or updates; the id
// comes from the device so the same child is one record everywhere.
// DELETE /v1/children/:id → 204: the child and all their data.

/** An answer as the device sends it; `synced` is never sent. */
export type AttemptDto = Omit<Attempt, "synced">;

// POST /v1/attempts/batch with AttemptBatch → AttemptBatchResult (parent).
// Idempotent: an id already stored is skipped, not changed. The server
// rebuilds every question from (tool, type, level, seed) with the same
// generators and grades `response` again; `tag` and `score` from the device
// are kept as sent, the server's own grading is stored next to them and a
// difference is counted in `mismatched` (never an error: devices may run an
// older version). At most 500 attempts per call. A review answer names the
// notebook entry it was for (`reviewOf`), so the server moves that same
// entry; answers from older apps without it are matched by skill and level.
export interface AttemptBatch {
  attempts: AttemptDto[];
}
export interface AttemptBatchResult {
  stored: number;
  skipped: number;
  mismatched: number;
  /** Ids rejected (unknown child, unknown tool, malformed), with the reason. */
  rejected: { id: string; reason: string }[];
}

// GET /v1/children/:id/assignments → AssignmentDto[]: open assignments of
// every classroom the child is in (due today or later).

// POST /v1/classrooms/join with JoinRequest → ClassroomDto (parent): puts a
// child in a classroom by its join code. The teacher sees only the
// nickname, avatar and grade, and the child's answers from then on.
export interface JoinRequest {
  code: string;
  childId: string;
}
// DELETE /v1/classrooms/:id/children/:childId → 204 (the parent of that
// child, or the classroom's teacher).

export interface ClassroomDto {
  id: string;
  name: string;
  /** 6 characters, letters and digits that cannot be confused (no 0/O, 1/I). */
  joinCode: string;
  /** Teacher's view only. */
  children?: { id: string; nickname: string; avatar: number; grade: number | null }[];
}

// Teacher: GET /v1/classrooms → ClassroomDto[] (with children).
// POST /v1/classrooms { name } → ClassroomDto. DELETE /v1/classrooms/:id → 204.
// A teacher sees and changes only their own classrooms.

export interface AssignmentDto {
  id: string;
  classroomId: string;
  title: string;
  /** Skills ("clock:angle"); the practice session draws only from these. */
  skills: string[];
  /** Due date, YYYY-MM-DD (Gregorian, the server's calendar). */
  due: string;
  createdAt: number;
}

// GET /v1/classrooms/:id/assignments → AssignmentDto[].
// POST /v1/classrooms/:id/assignments { title, skills, due } → AssignmentDto.
// DELETE /v1/classrooms/:id/assignments/:aid → 204.

/**
 * GET /v1/classrooms/:id/heatmap → Heatmap: one row per child, one column
 * per skill anyone in the class has practiced; each cell is a stage 0 … 4
 * (never θ) and the number of answers, or null when not practiced.
 */
export interface Heatmap {
  skills: string[];
  rows: { childId: string; nickname: string; cells: ({ stage: number; answers: number } | null)[] }[];
}

// GET /v1/children/:id/report → the parent report (src/practice/report.ts
// ReportData), computed by the server from the child's synced answers.

// GET /v1/daily-challenge/:yyyy-mm-dd → SessionItem[] (src/practice/session.ts):
// the same three puzzles the app builds offline for that date.

// GET /v1/children/:id/session → SessionItem[]: the next session from the
// server's copy of the child's state (same planner as the app).
