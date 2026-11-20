// Tool 4 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: the index of the picked option
// (for «قطعه اضافه», of the picked piece), or for «ساختن سایه» one entry per
// piece of the question, in its order: where it lies relative to the shadow
// ({ k: quarter turns, flip, x, y } as a Placement without the kind), or
// null when it lies crooked.

import { areaOf, makePuzzleQuestion, PIECES, placedTris, type BuildQuestion, type Level, type PuzzleQuestion, type PuzzleQuestionType } from "@/generators/puzzle";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { PUZZLE_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makePuzzleQuestion(type as PuzzleQuestionType, level as Level, seed);

/** A piece of a build answer, placed relative to the shadow. */
export interface BuildPiece {
  k: number;
  flip: boolean;
  x: number;
  y: number;
}

const isPiece = (p: unknown): p is BuildPiece => {
  if (!p || typeof p !== "object") return false;
  const { k, flip, x, y } = p as Record<string, unknown>;
  return [k, x, y].every((v) => typeof v === "number" && Number.isInteger(v)) && typeof flip === "boolean";
};

/**
 * A build answer from the board: each piece's pose (degrees `a`, mirror `sx`,
 * lattice point x, y) relative to where the shadow is drawn (`spot`). A piece
 * off the lattice or not at a right angle is crooked (null), as on the board.
 */
export function buildResponse(poses: readonly { a: number; sx: number; x: number; y: number }[], spot: readonly [number, number]): (BuildPiece | null)[] {
  return poses.map((pose) => {
    const a = ((Math.round(pose.a) % 360) + 360) % 360;
    if (a % 90 || Math.abs(pose.x - Math.round(pose.x)) > 1e-6 || Math.abs(pose.y - Math.round(pose.y)) > 1e-6) return null;
    return { k: a / 90, flip: pose.sx < 0, x: Math.round(pose.x) - spot[0], y: Math.round(pose.y) - spot[1] };
  });
}

/** A build, the same tests in the same order as the tool's own check. */
export function buildTag(q: BuildQuestion, pieces: readonly (BuildPiece | null)[]): string {
  const target = new Set(q.target);
  const covered = new Map<number, number>();
  let out = 0;
  let crooked = 0;
  let sticking = 0;
  q.kinds.forEach((kind, i) => {
    const p = pieces[i];
    if (!p) return void crooked++;
    const tris = placedTris({ kind, k: ((p.k % 4) + 4) % 4, flip: p.flip, x: p.x, y: p.y });
    const inside = tris.filter((id) => target.has(id)).length;
    if (!inside) out++;
    else if (inside < tris.length) sticking++;
    for (const id of tris) covered.set(id, (covered.get(id) ?? 0) + 1);
  });
  const overlap = [...covered.values()].some((n) => n > 1);
  const full = q.target.every((id) => covered.has(id));
  if (full && !overlap && !out && !crooked && !sticking) return "right";
  if (crooked) return "crooked";
  if (out) return "outside";
  if (overlap) return "overlap";
  if (sticking) return "sticking";
  return "gap";
}

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  if (q.type === "build") {
    if (!Array.isArray(response) || response.length !== q.kinds.length || !response.every((p) => p === null || isPiece(p))) return "other";
    return buildTag(q, response);
  }
  const n = q.type === "extra" ? q.pieces.length : q.options.length;
  if (typeof response !== "number" || !Number.isInteger(response) || response < 0 || response >= n) return "other";
  if (response === q.answer) return "right";
  switch (q.type) {
    case "overlay":
      // "overlap" is a build slip here; on the sheets it means "only where both are black".
      return q.tags[response] === "overlap" ? "overlapOnly" : (q.tags[response] ?? "other");
    case "combine":
    case "complete":
      return q.tags[response] ?? "other";
    case "split":
      // Every set has the right area (the panel says so); its pieces do not fit.
      return "shape";
    case "extra":
      return "notExtra";
  }
}

const NUDGE: Record<PuzzleQuestionType, string> = {
  build: "با بزرگ‌ترین قطعه شروع کن؛ قطعه‌های کوچک جاهای باریک را پر می‌کنند.",
  overlay: "کاغذها شفاف‌اند؛ خانه به خانه نگاه کن.",
  combine: "قطعه‌ها را در ذهنت کنار هم بگذار و بچرخان؛ لبه‌هایشان باید جور شوند.",
  split: "گوشه‌های تیز شکل را ببین؛ کدام قطعه در آن‌ها جا می‌شود؟",
  extra: "مساحت سایه را با مساحت همه قطعه‌ها مقایسه کن.",
  complete: "شکل جای خالی را دقیق ببین؛ قطعه باید درست همان باشد.",
};

const RULE: Record<PuzzleQuestionType, string> = {
  build: "قطعه‌ها نباید روی هم بیفتند و نباید از سایه بیرون بزنند؛ همه سایه باید پر شود.",
  overlay: "هر خانه‌ای که در یکی از دو کاغذ سیاه است، در جواب هم سیاه است؛ سیاه روی سیاه هم سیاه می‌ماند.",
  combine: "مساحت شکل ساخته‌شده برابر مجموع مساحت دو قطعه است، و شکلش باید از کنار هم گذاشتن آن‌ها درست شود.",
  split: "قطعه‌ها را می‌شود چرخاند و برگرداند، ولی نه برید؛ همه شکل باید بی‌جای خالی پر شود.",
  extra: "مساحت قطعه اضافه = مجموع مساحت قطعه‌ها منهای مساحت سایه؛ ولی بقیه هم باید درست در سایه جا شوند.",
  complete: "قطعه را می‌شود چرخاند ولی برنگرداند؛ اندازه و شکلش باید با جای خالی یکی باشد.",
};

/** Area in small triangles (a grid square is four). */
const tris = (n: number) => `${fa(n)} مثلث کوچک`;

function firstStep(q: PuzzleQuestion): string {
  switch (q.type) {
    case "build": {
      const big = [...q.kinds].sort((a, b) => areaOf(b) - areaOf(a))[0];
      return `گام اول: «${PIECES[big].name}» را بردار و جایی از سایه پیدا کن که فقط همین قطعه در آن جا می‌شود؛ معمولاً یک گوشه.`;
    }
    case "overlay":
      if (q.move === "none") return "گام اول: خانه‌های سیاه کاغذ ۱ را بشمار و در ذهنت نگه دار؛ بعد خانه‌های سیاه کاغذ ۲ را به آن‌ها اضافه کن.";
      if (q.move === "turn") return "گام اول: کاغذ ۲ را در ذهنت یک ربع ساعتگرد بچرخان: سطر بالایش ستون سمت راست می‌شود.";
      return "گام اول: کاغذ ۲ را مثل ورق کتاب برگردان: ستون سمت راستش ستون سمت چپ می‌شود و بالا و پایین همان می‌ماند.";
    case "combine":
      return `گام اول: مساحت دو قطعه را جمع کن: ${tris(areaOf(q.pieces[0]))} و ${tris(areaOf(q.pieces[1]))}؛ شکلی که اندازه‌اش فرق دارد کنار می‌رود.`;
    case "split":
      return "گام اول: تیزترین گوشه شکل را پیدا کن؛ در هر دسته ببین قطعه‌ای هست که در آن گوشه جا شود؟";
    case "extra":
      return `گام اول: سایه ${tris(q.target.length)} دارد. مساحت هر قطعه را بشمار و جمع کن.`;
    case "complete":
      return `گام اول: جای خالی ${tris(q.hole.length)} دارد؛ قطعه‌ای که اندازه‌اش فرق دارد کنار می‌رود.`;
  }
}

export const PUZZLE_ADAPTER: ToolAdapter = {
  ...PUZZLE_PRACTICE,
  version: "puzzle@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as PuzzleQuestionType], RULE[type as PuzzleQuestionType], firstStep(make(type, level, seed))],
};
