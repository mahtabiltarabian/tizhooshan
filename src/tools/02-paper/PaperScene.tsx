"use client";

// Folding paper in 3D. The paper is split into panels that move together
// (facets); each fold turns the moving panels 180° about the fold line. The
// turning axis sits a little above everything already folded, so a flap
// always lands on top, in the right layer order. Front of the paper is cream,
// back is light blue, so folds are easy to follow.

import { useEffect, useMemo } from "react";
import { BackSide, BufferGeometry, DoubleSide, Matrix4, Shape, ShapeGeometry, Vector3 } from "three";
import {
  facets as makeFacets,
  intersect,
  lineNormal,
  type Fold,
  type Poly,
  type Pt,
} from "@/generators/paper-folding";

const FRONT = "#fffaf0";
const BACK = "#cfe0ff";
const TABLE = "#efe5d3";
const INK = "#1f2430";
const CUT = "#e5484d";
const LIFT = 0.03;

interface PaperSceneProps {
  S: number;
  folds: Fold[];
  /** 0 = flat and open, 1 = every fold made. */
  f: number;
  /** Hole centres in unfolded paper coordinates. */
  holes?: Pt[];
  /** Cut-away pieces in unfolded paper coordinates. */
  removed?: Poly[];
  /** Straight cuts in unfolded paper coordinates. */
  cutLines?: [Pt, Pt][];
  grid?: boolean;
}

const ccw = (poly: Poly): Poly => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return s < 0 ? [...poly].reverse() : poly;
};

const shapeGeometry = (poly: Poly) => {
  const p = ccw(poly);
  const shape = new Shape();
  shape.moveTo(p[0][0], p[0][1]);
  for (const q of p.slice(1)) shape.lineTo(q[0], q[1]);
  shape.closePath();
  return new ShapeGeometry(shape);
};

/** Part of segment ab inside convex polygon (Cyrus–Beck), or null. */
function clipSegment([a, b]: [Pt, Pt], poly: Poly): [Pt, Pt] | null {
  const p = ccw(poly);
  let t0 = 0;
  let t1 = 1;
  const d: Pt = [b[0] - a[0], b[1] - a[1]];
  for (let i = 0; i < p.length; i++) {
    const e0 = p[i];
    const e1 = p[(i + 1) % p.length];
    const n: Pt = [-(e1[1] - e0[1]), e1[0] - e0[0]]; // inward for CCW
    const num = n[0] * (a[0] - e0[0]) + n[1] * (a[1] - e0[1]);
    const den = n[0] * d[0] + n[1] * d[1];
    if (Math.abs(den) < 1e-12) {
      if (num < -1e-9) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1 + 1e-9) return null;
  }
  if (t1 - t0 < 1e-6) return null;
  return [
    [a[0] + d[0] * t0, a[1] + d[1] * t0],
    [a[0] + d[0] * t1, a[1] + d[1] * t1],
  ];
}

/** Point strictly or on the edge of a convex polygon. */
function contains(poly: Poly, [x, y]: Pt): boolean {
  const p = ccw(poly);
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    if ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1) < -1e-9) return false;
  }
  return true;
}

/** Edges of a panel that are the sheet's own edge (fold lines inside the paper are not drawn: they would give folds away). */
function outerEdges(poly: Poly, S: number): BufferGeometry {
  const on = (v: number, c: number) => Math.abs(v - c) < 1e-6;
  const pts: Vector3[] = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    if ([0, S].some((c) => (on(a[0], c) && on(b[0], c)) || (on(a[1], c) && on(b[1], c)))) pts.push(new Vector3(a[0], a[1], 0), new Vector3(b[0], b[1], 0));
  });
  return new BufferGeometry().setFromPoints(pts);
}

/** A thin flat strip along a segment, drawn on both faces. */
function Strip({ seg, width, color, z }: { seg: [Pt, Pt]; width: number; color: string; z: number }) {
  const [a, b] = seg;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <>
      {[z, -z].map((zz) => (
        <mesh key={zz} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, zz]} rotation={[0, 0, angle]}>
          <planeGeometry args={[len, width]} />
          <meshBasicMaterial color={color} side={DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

export function PaperScene({ S, folds, f, holes = [], removed = [], cutLines = [], grid = true }: PaperSceneProps) {
  const k = folds.length;

  // Panels, their geometry, and the height of each fold's turning axis.
  const model = useMemo(() => {
    const list = makeFacets(S, folds);
    const axisHeights: number[] = [];
    const heights = list.map(() => 0);
    let top = 0;
    folds.forEach((_, i) => {
      const a = top + LIFT;
      axisHeights.push(a);
      list.forEach((fa, j) => {
        if (fa.moved[i]) heights[j] = 2 * a - heights[j];
      });
      top = Math.max(top, ...heights);
    });
    return {
      axisHeights,
      panels: list.map((fa) => {
        const geometry = shapeGeometry(fa.poly);
        return {
          ...fa,
          geometry,
          edges: outerEdges(fa.poly, S),
          holes: holes.filter((h) => contains(fa.poly, h)),
          removed: removed.map((r) => intersect(r, fa.poly)).filter((r) => r.length > 2).map(shapeGeometry),
          cuts: cutLines.map((s) => clipSegment(s, fa.poly)).filter((s): s is [Pt, Pt] => !!s),
          grid: grid
            ? [
                ...Array.from({ length: S - 1 }, (_, i): [Pt, Pt] => [[i + 1, 0], [i + 1, S]]),
                ...Array.from({ length: S - 1 }, (_, i): [Pt, Pt] => [[0, i + 1], [S, i + 1]]),
              ]
                .map((s) => clipSegment(s, fa.poly))
                .filter((s): s is [Pt, Pt] => !!s)
            : [],
        };
      }),
    };
  }, [S, folds, holes, removed, cutLines, grid]);

  useEffect(
    () => () =>
      model.panels.forEach((p) => {
        p.geometry.dispose();
        p.edges.dispose();
        p.removed.forEach((g) => g.dispose());
      }),
    [model],
  );

  // Turn about each fold line, in order, by however far that fold has got.
  const matrixFor = (moved: boolean[]) => {
    const m = new Matrix4();
    folds.forEach((fold, i) => {
      if (!moved[i]) return;
      const theta = Math.min(1, Math.max(0, f * k - i)) * Math.PI;
      if (!theta) return;
      const { n, o } = lineNormal(fold.line);
      // A point on the line, lifted to the axis height; turning direction lifts the moving side up first.
      const point = new Vector3(n[0] * o, n[1] * o, model.axisHeights[i]);
      const axis = new Vector3(n[1], -n[0], 0).multiplyScalar(fold.moving);
      const r = new Matrix4()
        .makeTranslation(point.x, point.y, point.z)
        .multiply(new Matrix4().makeRotationAxis(axis, theta))
        .multiply(new Matrix4().makeTranslation(-point.x, -point.y, -point.z));
      m.premultiply(r);
    });
    return m;
  };

  const scale = 4 / S;
  const holeR = 0.3;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={scale}>
      <group position={[-S / 2, -S / 2, 0]}>
        {model.panels.map((p, i) => (
          <group key={i} matrixAutoUpdate={false} matrix={matrixFor(p.moved)}>
            <mesh geometry={p.geometry} castShadow>
              <meshStandardMaterial color={FRONT} emissive={FRONT} emissiveIntensity={0.35} roughness={0.85} toneMapped={false} />
            </mesh>
            <mesh geometry={p.geometry}>
              <meshStandardMaterial color={BACK} emissive={BACK} emissiveIntensity={0.35} roughness={0.85} side={BackSide} toneMapped={false} />
            </mesh>
            <lineSegments geometry={p.edges}>
              <lineBasicMaterial color="#9a8f7c" />
            </lineSegments>
            {p.grid.map((s, j) => (
              <Strip key={`g${j}`} seg={s} width={0.02} color="#d8cdb8" z={0.001} />
            ))}
            {p.holes.map(([x, y], j) =>
              [0.003, -0.003].map((z) => (
                <mesh key={`h${j}${z}`} position={[x, y, z]}>
                  <circleGeometry args={[holeR, 24]} />
                  <meshBasicMaterial color={INK} side={DoubleSide} />
                </mesh>
              )),
            )}
            {p.removed.map((g, j) =>
              [0.003, -0.003].map((z) => (
                <mesh key={`r${j}${z}`} geometry={g} position={[0, 0, z]}>
                  <meshBasicMaterial color={TABLE} side={DoubleSide} />
                </mesh>
              )),
            )}
            {p.cuts.map((s, j) => (
              <Strip key={`c${j}`} seg={s} width={0.09} color={CUT} z={0.004} />
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
