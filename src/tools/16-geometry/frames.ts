// "Show me" for tool 16: the steps of counting a shape's area (whole and
// half squares, or the bounding rectangle minus its corner triangles) and of
// adding up a perimeter. Each step says what to draw and what to say.

import { areaMethod, areaOf, boxOf, boxPieces, edgesOf, perimeterOf, squareCount, type Pt } from "@/generators/geometry";
import { fa } from "@/tools/registry";

/** Keeps an equation left to right inside a Persian sentence, and on one line. */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

/** A number with Persian digits and the Persian decimal sign: 7.5 → ۷٫۵. */
export const num = (v: number) => fa(String(Math.round(v * 100) / 100).replace(".", "٫"));
export const degFa = (v: number) => `${num(v)}°`;
/** An angle that may not be whole: "۹۰°" or "≈۶۳°". */
export const approxDeg = (d: number) => (Math.abs(d - Math.round(d)) < 1e-6 ? degFa(Math.round(d)) : `≈${degFa(Math.round(d))}`);

export interface Overlay {
  /** Grid squares: whole ones only, or whole and half. */
  cells?: "whole" | "all";
  /** The bounding rectangle. */
  box?: boolean;
  /** How many corner pieces are shown. */
  pieces?: number;
  /** Side lengths along the band. */
  edges?: boolean;
  // Circle and composite figures (MeasurePictures.tsx):
  /** Parts outlined, with their label. */
  parts?: Record<number, string>;
  /** Edges drawn heavy (a curve, a straight edge). */
  lines?: number[];
  /** Hidden lengths now worked out and written. */
  reveal?: string[];
}

export interface Frame {
  show: Overlay;
  note: string;
}

const sideLengths = (poly: Pt[]) => edgesOf(poly).map(([a, b]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]));

/** Area in one line, the way "show me" counts it. */
export function areaHow(poly: Pt[]): string {
  const A = areaOf(poly);
  if (areaMethod(poly) === "box") {
    const b = boxOf(poly);
    const parts = boxPieces(poly)!.map((p) => (p.a * p.b) / 2);
    return `مستطیل دور شکل ${ltr(`${fa(b.w)} × ${fa(b.h)} = ${fa(b.w * b.h)}`)}؛ منهای مثلث‌های گوشه: ${ltr(`${fa(b.w * b.h)} − ${parts.map(num).join(" − ")} = ${num(A)}`)}.`;
  }
  const { whole, half } = squareCount(poly);
  const b = boxOf(poly);
  if (!half.length && poly.length === 4) return `${fa(b.w)} ستون و ${fa(b.h)} ردیف مربع: ${ltr(`${fa(b.w)} × ${fa(b.h)} = ${num(A)}`)}.`;
  if (!half.length) return `${fa(whole.length)} مربع کامل: مساحت ${num(A)}.`;
  return `${fa(whole.length)} مربع کامل و ${fa(half.length)} نیم‌مربع (هر دو نیمه یک مربع): ${ltr(`${fa(whole.length)} + ${fa(half.length)} ÷ ۲ = ${num(A)}`)}.`;
}

/** Perimeter in one line (sides along the grid only). */
export function perimeterHow(poly: Pt[]): string {
  const P = perimeterOf(poly);
  if (P === null) return "";
  const b = boxOf(poly);
  const box = 2 * (b.w + b.h);
  const sum = ltr(`${sideLengths(poly).map(fa).join(" + ")} = ${fa(P)}`);
  if (poly.length === 4) return `ضلع‌ها را دور تا دور جمع کن: ${sum}؛ یا ${ltr(`(${fa(b.w)} + ${fa(b.h)}) × ۲ = ${fa(P)}`)}.`;
  const trick =
    P === box
      ? ` همان محیط مستطیل دور شکل است: ${ltr(`(${fa(b.w)} + ${fa(b.h)}) × ۲ = ${fa(box)}`)}؛ پله‌ها و گوشه‌های بریده محیط را عوض نمی‌کنند.`
      : ` یعنی محیط مستطیل دور شکل به‌علاوه دو ضلع داخل فرورفتگی: ${ltr(`${fa(box)} + ${fa(P - box)} = ${fa(P)}`)}.`;
  return `ضلع‌ها را دور تا دور جمع کن: ${sum}.${trick}`;
}

export function areaFrames(poly: Pt[]): Frame[] {
  const A = areaOf(poly);
  const start: Frame = { show: {}, note: "مساحت یعنی چند مربع واحد (مربع کوچک بین چهار میخ) درون کش جا می‌شود." };
  const method = areaMethod(poly);
  if (method === "box") {
    const b = boxOf(poly);
    const pieces = boxPieces(poly)!;
    const frames: Frame[] = [
      { ...start, note: `${start.note} ضلع‌های کج مربع‌ها را تکه‌تکه می‌کنند؛ پس راه دیگری می‌رویم.` },
      { show: { box: true }, note: `یک مستطیل دور شکل می‌کشیم (خط‌چین): ${ltr(`${fa(b.w)} × ${fa(b.h)} = ${fa(b.w * b.h)}`)} واحد مربع.` },
    ];
    pieces.forEach((p, i) =>
      frames.push({
        show: { box: true, pieces: i + 1 },
        note: `تکه ${fa(i + 1)} (هاشورخورده) مثلث قائم‌الزاویه است، نصف یک مستطیل ${ltr(`${fa(p.a)} × ${fa(p.b)}`)}: ${ltr(`${fa(p.a)} × ${fa(p.b)} ÷ ۲ = ${num((p.a * p.b) / 2)}`)}.`,
      }),
    );
    frames.push({ show: { box: true, pieces: pieces.length }, note: `مساحت شکل = مستطیل منهای تکه‌ها: ${ltr(`${fa(b.w * b.h)} − ${pieces.map((p) => num((p.a * p.b) / 2)).join(" − ")} = ${num(A)}`)} واحد مربع.` });
    return frames;
  }
  const { whole, half } = squareCount(poly);
  const frames: Frame[] = [start, { show: { cells: "whole" }, note: `مربع‌های کامل را می‌شماریم (شماره‌دار، هاشور مورب): ${fa(whole.length)} تا.` }];
  if (half.length)
    frames.push({ show: { cells: "all" }, note: `نیم‌مربع‌ها (نقطه‌دار، با «½»): ${fa(half.length)} تا. هر دو نیمه یک مربع کامل می‌سازند: ${ltr(`${fa(half.length)} ÷ ۲ = ${num(half.length / 2)}`)}.` });
  frames.push({ show: { cells: "all" }, note: `مساحت: ${areaHow(poly)}` });
  return frames;
}

export function perimeterFrames(poly: Pt[]): Frame[] {
  return [
    { show: {}, note: "محیط یعنی طول دور شکل: فاصله دو میخ کنار هم یک واحد است. فاصله‌ها را بشمار، نه میخ‌ها را." },
    { show: { edges: true }, note: `محیط: ${perimeterHow(poly)}` },
  ];
}
