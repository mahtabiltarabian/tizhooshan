// Cross-check: the 3D animation (three.js transforms) and the question model
// (pure maths) are written independently. If they disagreed, a "correct"
// answer picture would not match the cube the child sees folding.

import { describe, expect, it } from "vitest";
import { Group, Object3D, Vector3 } from "three";
import { CUBE_NETS, foldNet, pickRoot } from "@/generators/cube-nets";
import { cubeFaces, type DecoratedNet } from "@/generators/cube-questions";
import { hinge, labelRotation, NET_TO_WORLD } from "./foldGeometry";

/** Build the same object tree as FoldingNet at t = 1 and read each face's normal and label-up in world space. */
function render3D(net: DecoratedNet) {
  const fold = foldNet(net.cells, pickRoot(net.cells));
  const world = new Group();
  world.rotation.set(...NET_TO_WORLD);
  const faceNode: Object3D[] = [];

  fold.faces.forEach((f, i) => {
    const node = new Group();
    if (!f.dir) {
      world.add(node);
    } else {
      const h = hinge(f.dir, Math.PI / 2);
      const hingeGroup = new Group();
      hingeGroup.position.set(...h.position);
      hingeGroup.rotation.set(...h.rotation);
      node.position.set(...h.offset);
      hingeGroup.add(node);
      faceNode[f.parent].add(hingeGroup);
    }
    faceNode[i] = node;
  });
  world.updateMatrixWorld(true);

  return net.cells.map((c, idx) => {
    const i = fold.faces.findIndex((f) => f.cell[0] === c[0] && f.cell[1] === c[1]);
    const label = new Object3D();
    label.rotation.set(...labelRotation(net.turns[idx]));
    faceNode[i].add(label);
    label.updateMatrixWorld(true);
    const dir = (v: Vector3) => {
      const w = v.transformDirection(label.matrixWorld);
      // World (y up) back to the model's frame (z up): model = (wx, -wz, wy).
      return [w.x, -w.z, w.y].map((n) => Math.round(n) || 0);
    };
    return { normal: dir(new Vector3(0, 0, 1)), up: dir(new Vector3(0, 1, 0)) };
  });
}

describe("3D fold matches the question model", () => {
  it("agrees on every face's position and symbol direction, for every net and turn", () => {
    for (const [n, cells] of CUBE_NETS.entries()) {
      for (let k = 0; k < 4; k++) {
        const turns = [0, 1, 2, 3, 0, 1].map((t) => (t + k) % 4);
        const net: DecoratedNet = { netIndex: n, cells, symbols: ["a", "b", "c", "d", "e", "f"], turns };
        const model = cubeFaces(net);
        const seen = render3D(net);
        model.forEach((m, i) => {
          expect(seen[i].normal, `net ${n + 1}, face ${i}`).toEqual([...m.normal]);
          expect(seen[i].up, `net ${n + 1}, face ${i} label`).toEqual([...m.up]);
        });
      }
    }
  });
});
