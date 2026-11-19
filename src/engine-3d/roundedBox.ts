import { ExtrudeGeometry, Shape, type BufferGeometry } from "three";
import { toCreasedNormals } from "three-stdlib";

// The same rounded box as drei's <RoundedBox>, built once per size and shared
// by every mesh: a tower of twelve cubes used to build (and crease) the shape
// twelve times, which a weak tablet feels on every load.

const EPS = 0.00001;
const cache = new Map<string, BufferGeometry>();

function outline(width: number, height: number, radius0: number): Shape {
  const shape = new Shape();
  const radius = radius0 - EPS;
  shape.absarc(EPS, EPS, EPS, -Math.PI / 2, -Math.PI, true);
  shape.absarc(EPS, height - radius * 2, EPS, Math.PI, Math.PI / 2, true);
  shape.absarc(width - radius * 2, height - radius * 2, EPS, Math.PI / 2, 0, true);
  shape.absarc(width - radius * 2, EPS, EPS, 0, -Math.PI / 2, true);
  return shape;
}

/** A shared rounded-box geometry; drei's defaults for steps, bevel and crease. */
export function roundedBox(width: number, height: number, depth: number, radius: number, smoothness: number): BufferGeometry {
  const key = [width, height, depth, radius, smoothness].join(",");
  let geometry = cache.get(key);
  if (!geometry) {
    const extruded = new ExtrudeGeometry(outline(width, height, radius), {
      depth: depth - radius * 2,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 1,
      bevelSize: radius - EPS,
      bevelThickness: radius,
      curveSegments: smoothness,
    });
    extruded.center();
    geometry = toCreasedNormals(extruded, 0.4);
    cache.set(key, geometry);
  }
  return geometry;
}
