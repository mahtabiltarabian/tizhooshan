// Test helpers for circle.test.ts and composite-area.test.ts: measure a
// figure independently of the formulas, by sampling points for its area and
// by short chords for the length of its curves. Not used by the app.

import type { Edge, Figure, Part, XY } from "./circle";

function inPart(p: Part, x: number, y: number): boolean {
  switch (p.kind) {
    case "rect":
      return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
    case "tri": {
      const [a, b, c] = p.pts;
      const s = (u: XY, v: XY) => (v[0] - u[0]) * (y - u[1]) - (v[1] - u[1]) * (x - u[0]);
      const [d1, d2, d3] = [s(a, b), s(b, c), s(c, a)];
      return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
    }
    case "sector": {
      const [dx, dy] = [x - p.c[0], y - p.c[1]];
      if (dx * dx + dy * dy > p.r * p.r) return false;
      if (p.sweep >= 360) return true;
      const ang = (((Math.atan2(dy, dx) * 180) / Math.PI - p.from) % 360 + 360) % 360;
      return ang <= p.sweep;
    }
  }
}

/** Area of the shaded region by sampling, plus how much of it is covered twice (should be none). */
export function sampledArea(f: Figure, step = 0.05): { area: number; clash: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of f.parts) {
    const corners: XY[] =
      p.kind === "rect"
        ? [
            [p.x, p.y],
            [p.x + p.w, p.y + p.h],
          ]
        : p.kind === "tri"
          ? p.pts
          : [
              [p.c[0] - p.r, p.c[1] - p.r],
              [p.c[0] + p.r, p.c[1] + p.r],
            ];
    for (const [x, y] of corners) {
      xs.push(x);
      ys.push(y);
    }
  }
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let n = 0;
  let clash = 0;
  for (let x = x0 + step * 0.4937; x < x1; x += step)
    for (let y = y0 + step * 0.5173; y < y1; y += step) {
      const plus = f.parts.filter((p) => p.sign === 1 && inPart(p, x, y)).length;
      const minus = f.parts.filter((p) => p.sign === -1 && inPart(p, x, y)).length;
      if (plus === 1 && minus === 0) n++;
      if (plus > 1 || minus > 1 || (minus > 0 && plus === 0)) clash++;
    }
  return { area: n * step * step, clash: clash * step * step };
}

/** Length of an edge by 2,000 chords. */
export function chordLength(e: Edge): number {
  if (e.kind === "line") return Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
  let s = 0;
  for (let k = 0; k < 2000; k++) {
    const t0 = ((e.from + (e.sweep * k) / 2000) * Math.PI) / 180;
    const t1 = ((e.from + (e.sweep * (k + 1)) / 2000) * Math.PI) / 180;
    s += Math.hypot(e.r * (Math.cos(t1) - Math.cos(t0)), e.r * (Math.sin(t1) - Math.sin(t0)));
  }
  return s;
}

