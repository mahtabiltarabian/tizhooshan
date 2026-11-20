"use client";

// On-device storage (IndexedDB). Nothing here leaves the device unless a
// parent links it to an account (sync.ts). "Delete everything" removes the
// whole database.

import type { Attempt, Profile, ReviewItem, SkillState } from "./types";

const NAME = "tizhooshan";
const VERSION = 1;

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("profiles", { keyPath: "id" });
      db.createObjectStore("attempts", { keyPath: "id" }).createIndex("child", "childId");
      db.createObjectStore("skills", { keyPath: ["childId", "skill"] }).createIndex("child", "childId");
      db.createObjectStore("reviews", { keyPath: "attemptId" }).createIndex("child", "childId");
      db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

type Store = "profiles" | "attempts" | "skills" | "reviews" | "meta";

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return done(fn(db.transaction(store, mode).objectStore(store)));
}

const byChild = async <T>(store: "attempts" | "skills" | "reviews", childId: string) => {
  const db = await open();
  return done(db.transaction(store).objectStore(store).index("child").getAll(childId)) as Promise<T[]>;
};

export const db = {
  profiles: () => tx("profiles", "readonly", (s) => s.getAll()) as Promise<Profile[]>,
  putProfile: (p: Profile) => tx("profiles", "readwrite", (s) => s.put(p)),

  attempts: (childId: string) => byChild<Attempt>("attempts", childId),
  allAttempts: () => tx("attempts", "readonly", (s) => s.getAll()) as Promise<Attempt[]>,
  putAttempt: (a: Attempt) => tx("attempts", "readwrite", (s) => s.put(a)),

  skills: (childId: string) => byChild<SkillState>("skills", childId),
  putSkill: (k: SkillState) => tx("skills", "readwrite", (s) => s.put(k)),

  reviews: (childId: string) => byChild<ReviewItem>("reviews", childId),
  putReview: (r: ReviewItem) => tx("reviews", "readwrite", (s) => s.put(r)),
  deleteReview: (attemptId: string) => tx("reviews", "readwrite", (s) => s.delete(attemptId)),

  getMeta: <T>(key: string) => tx("meta", "readonly", (s) => s.get(key)) as Promise<T | undefined>,
  setMeta: (key: string, value: unknown) => tx("meta", "readwrite", (s) => s.put(value, key)),

  /** Removes one child and everything recorded about them. */
  async deleteChild(childId: string) {
    const d = await open();
    const t = d.transaction(["profiles", "attempts", "skills", "reviews"], "readwrite");
    t.objectStore("profiles").delete(childId);
    for (const store of ["attempts", "skills", "reviews"] as const) {
      const idx = t.objectStore(store).index("child");
      const keys = await done(idx.getAllKeys(childId));
      for (const k of keys) t.objectStore(store).delete(k);
    }
    await new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },

  /** Removes the whole database: every profile, answer and setting. */
  async deleteAll() {
    const d = await open();
    d.close();
    opening = null;
    await done(indexedDB.deleteDatabase(NAME) as unknown as IDBRequest<unknown>);
  },
};

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
