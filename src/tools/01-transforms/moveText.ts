// Moves and slides in words. Plain code (no React): the try panel, the
// worksheet and the adapter (which the server imports too) all use it.

import type { MoveName, Pt } from "@/generators/transforms";
import { fa } from "@/tools/registry";

export const MOVE_NAME: Record<MoveName, string> = {
  mirror: "قرینه در آینه",
  water: "تصویر در آب",
  cw90: "۹۰ درجه ساعتگرد ↻",
  r180: "۱۸۰ درجه (نیم‌دور)",
  ccw90: "۹۰ درجه پادساعتگرد ↺",
};

/** The move as a step in a sentence ("first … then …"). */
export const MOVE_STEP: Record<MoveName, string> = {
  mirror: "در آینه برود",
  water: "در آب برود",
  cw90: "۹۰ درجه ساعتگرد بچرخد",
  r180: "۱۸۰ درجه بچرخد",
  ccw90: "۹۰ درجه پادساعتگرد بچرخد",
};

export const MOVE_WHY: Record<MoveName, string> = {
  mirror: "در آینه، چپ و راست جابه‌جا می‌شود و بالا و پایین همان می‌ماند.",
  water: "در آب، بالا و پایین جابه‌جا می‌شود و چپ و راست همان می‌ماند.",
  cw90: "در چرخش ۹۰ درجه ساعتگرد، بالای شکل به سمت راست می‌رود و شکل برعکس نمی‌شود.",
  r180: "در نیم‌دور، شکل سر و ته می‌شود ولی برعکس نمی‌شود.",
  ccw90: "در چرخش ۹۰ درجه پادساعتگرد، بالای شکل به سمت چپ می‌رود و شکل برعکس نمی‌شود.",
};

export const SHIFT_WHY = "در انتقال هر خانه شکل به یک اندازه و یک جهت می‌رود؛ شکل نه می‌چرخد و نه برعکس می‌شود.";

/** A slide in words, with arrows: «۳ خانه به راست → و ۲ خانه به بالا ↑». */
export function vecText([dx, dy]: Pt, arrows = true): string {
  const parts: string[] = [];
  if (dx) parts.push(`${fa(Math.abs(dx))} خانه به ${dx > 0 ? "راست" : "چپ"}${arrows ? (dx > 0 ? " →" : " ←") : ""}`);
  if (dy) parts.push(`${fa(Math.abs(dy))} خانه به ${dy > 0 ? "بالا" : "پایین"}${arrows ? (dy > 0 ? " ↑" : " ↓") : ""}`);
  return parts.join(" و ");
}
