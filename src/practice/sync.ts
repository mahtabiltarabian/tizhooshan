"use client";

// Linking this device to a parent account, and keeping the server's copy up
// to date. Optional: with no account nothing is ever sent. What is sent:
// each child's profile (nickname, picture, grade, birth year, daily limit)
// and their answers. Assignments from the child's classrooms come back.

import type { AssignmentDto, AttemptBatchResult, AttemptDto, ChildDto, ClassroomDto, User } from "./api";
import type { Attempt, Profile } from "./types";
import { api, hasServer } from "./apiClient";
import { db } from "./db";

export interface Account {
  token: string;
  user: User;
  linkedAt: number;
  lastSync?: number;
}

export const getAccount = () => db.getMeta<Account>("account");
export const setAccount = (a: Account | null) => db.setMeta("account", a ?? undefined);

export const assignmentsOf = async (childId: string) => (await db.getMeta<AssignmentDto[]>(`assignments:${childId}`)) ?? [];

const BATCH = 500;

const withoutSynced = (a: Attempt): AttemptDto => {
  const copy: Attempt = { ...a };
  delete copy.synced;
  return copy;
};

/** What the server gets of a profile: never the photo. */
export function childBody(p: Profile): ChildDto {
  return { id: p.id, nickname: p.nickname, avatar: p.avatar, grade: p.grade ?? null, birthYear: p.birthYear ?? null, dailyLimitMin: p.dailyLimitMin, createdAt: p.createdAt };
}

/** Sends what the server lacks and fetches assignments. Quietly does nothing offline or unlinked. */
export async function syncNow(): Promise<{ sent: number } | null> {
  if (!hasServer || (typeof navigator !== "undefined" && !navigator.onLine)) return null;
  const account = await getAccount();
  if (!account) return null;
  const token = account.token;
  const profiles = await db.profiles();
  for (const p of profiles) await api<ChildDto>(`/children/${p.id}`, { method: "PUT", token, body: childBody(p) });

  const pending = (await db.allAttempts()).filter((a) => !a.synced && profiles.some((p) => p.id === a.childId));
  let sent = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    const res = await api<AttemptBatchResult>("/attempts/batch", { token, body: { attempts: chunk.map(withoutSynced) } });
    const rejected = new Set(res.rejected.map((r) => r.id));
    for (const a of chunk) if (!rejected.has(a.id)) await db.putAttempt({ ...a, synced: true });
    sent += res.stored;
  }
  for (const p of profiles) {
    const list = await api<AssignmentDto[]>(`/children/${p.id}/assignments`, { token });
    await db.setMeta(`assignments:${p.id}`, list);
  }
  await setAccount({ ...account, lastSync: Date.now() });
  return { sent };
}

export const joinClassroom = async (code: string, childId: string) => {
  const account = await getAccount();
  if (!account) throw new Error("no account");
  await syncNow();
  return api<ClassroomDto>("/classrooms/join", { token: account.token, body: { code: code.trim().toUpperCase(), childId } });
};

/** Removes a child on the server too, when this device is linked. */
export async function deleteChildRemote(childId: string) {
  const account = await getAccount();
  if (account && hasServer) await api<void>(`/children/${childId}`, { method: "DELETE", token: account.token }).catch(() => {});
}

/** Deletes the parent account and everything on the server; the device keeps its own copy. */
export async function deleteAccount() {
  const account = await getAccount();
  if (!account) return;
  await api<void>("/me", { method: "DELETE", token: account.token });
  await setAccount(null);
}
