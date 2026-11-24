"use client";

// A prism or pyramid in 3D with its faces, edges and vertices that can be
// highlighted and numbered. Model coordinates (x right, y away, z up) map to
// world coordinates (x, z, -y). Numbers are sprites drawn through the solid,
// so hidden parts are counted too. The three parts differ by shape, not only
// colour: faces get square badges, edges round outlined badges, vertices
// solid dark discs.

import { useEffect, useMemo, useState } from "react";
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { solidModel, type Part, type Solid, type Vec3 } from "@/generators/solids";
import { textTexture } from "@/engine-3d/textTexture";
import { fa } from "@/tools/registry";

export const SOLID_FACE_COLORS = ["#ff8787", "#ffd43b", "#69db7c", "#74c0fc", "#d0a2ff", "#ffa94d", "#63e6be", "#f783ac"];
const EDGE_STRONG = "#c2410c";
const INK = "#0f172a";

type BadgeKind = Part;

/** Badges are cached for the page's lifetime: a few dozen small canvases. */
const badges = new Map<string, CanvasTexture>();
function badge(kind: BadgeKind, label: string): CanvasTexture {
  const key = `${kind}:${label}`;
  const hit = badges.get(key);
  if (hit) return hit;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.lineWidth = 9;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  if (kind === "faces") ctx.roundRect(10, 10, size - 20, size - 20, 18);
  else ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fillStyle = kind === "vertices" ? INK : "#ffffff";
  ctx.fill();
  ctx.stroke();
  ctx.font = `700 ${size * 0.5}px Vazirmatn, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = kind === "vertices" ? "#ffffff" : INK;
  ctx.fillText(label, size / 2, size * 0.56);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  badges.set(key, tex);
  return tex;
}

const world = ([x, y, z]: Vec3): [number, number, number] => [x, z, -y];

interface SolidSceneProps {
  solid: Solid;
  /** Number the first k items of each part (Infinity = all). */
  labels?: Partial<Record<Part, number>>;
  /** Draw a part strongly: coloured faces, thick edges, corner balls. */
  highlight?: Partial<Record<Part, boolean>>;
  position?: [number, number, number];
  scale?: number;
  /** Name written on the table in front of the solid. */
  caption?: string;
}

export function SolidScene({ solid, labels = {}, highlight = {}, position = [0, 0, 0], scale = 1.5, caption }: SolidSceneProps) {
  const model = useMemo(() => solidModel(solid), [solid]);

  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts.load("700 60px Vazirmatn").finally(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const captionTex = useMemo(() => (fontReady && caption ? textTexture(caption) : null), [fontReady, caption]);
  useEffect(() => () => captionTex?.dispose(), [captionTex]);

  const centre = useMemo(() => {
    const c = [0, 1, 2].map((k) => model.vertices.reduce((a, v) => a + v[k], 0) / model.vertices.length);
    return new Vector3(...world(c as Vec3));
  }, [model]);

  const faceGeoms = useMemo(
    () =>
      model.faces.map((f) => {
        const g = new BufferGeometry();
        const pts: number[] = [];
        for (let i = 1; i < f.length - 1; i++) for (const v of [f[0], f[i], f[i + 1]]) pts.push(...world(model.vertices[v]));
        g.setAttribute("position", new Float32BufferAttribute(pts, 3));
        g.computeVertexNormals();
        return g;
      }),
    [model],
  );
  useEffect(() => () => faceGeoms.forEach((g) => g.dispose()), [faceGeoms]);

  const edgeRods = useMemo(
    () =>
      model.edges.map(([a, b]) => {
        const pa = new Vector3(...world(model.vertices[a]));
        const pb = new Vector3(...world(model.vertices[b]));
        const dir = pb.clone().sub(pa);
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
        return { mid: pa.clone().add(pb).multiplyScalar(0.5), length: dir.length(), q };
      }),
    [model],
  );

  // Labels sit just outside the solid, pushed away from its centre.
  const out = (p: Vector3, by: number) => p.clone().add(p.clone().sub(centre).normalize().multiplyScalar(by)).toArray();
  const faceCentre = (f: number[]) => {
    const c = new Vector3();
    for (const v of f) c.add(new Vector3(...world(model.vertices[v])));
    return c.multiplyScalar(1 / f.length);
  };

  const see = (part: Part) => labels[part] ?? 0;
  const ghostly = !!(highlight.edges || highlight.vertices || see("edges") || see("vertices"));
  const opacity = ghostly ? 0.38 : 0.9;
  const label = 0.3 / Math.sqrt(scale);

  return (
    <group position={position} scale={scale}>
      {faceGeoms.map((g, i) => (
        <mesh key={`f${i}`} geometry={g} castShadow={!ghostly}>
          <meshStandardMaterial
            color={highlight.faces ? SOLID_FACE_COLORS[i % SOLID_FACE_COLORS.length] : "#f3e6cc"}
            side={DoubleSide}
            transparent
            opacity={opacity}
            depthWrite={!ghostly}
            roughness={0.55}
          />
        </mesh>
      ))}

      {edgeRods.map((e, i) => (
        <mesh key={`e${i}`} position={e.mid} quaternion={e.q}>
          <cylinderGeometry args={[highlight.edges ? 0.04 : 0.02, highlight.edges ? 0.04 : 0.02, e.length, 8]} />
          <meshStandardMaterial color={highlight.edges ? EDGE_STRONG : INK} roughness={0.5} />
        </mesh>
      ))}

      {highlight.vertices &&
        model.vertices.map((v, i) => (
          <mesh key={`v${i}`} position={world(v)}>
            <sphereGeometry args={[0.085, 16, 12]} />
            <meshStandardMaterial color={INK} roughness={0.4} />
          </mesh>
        ))}

      {fontReady && (
        <>
          {model.faces.slice(0, see("faces")).map((f, i) => {
            const c = faceCentre(f);
            const n = new Vector3(...world(model.normals[i]));
            return (
              <sprite key={`lf${i}`} position={c.add(n.multiplyScalar(0.06)).toArray()} scale={[label, label, 1]} renderOrder={10}>
                <spriteMaterial map={badge("faces", fa(i + 1))} depthTest={false} transparent />
              </sprite>
            );
          })}
          {edgeRods.slice(0, see("edges")).map((e, i) => (
            <sprite key={`le${i}`} position={out(e.mid, 0.16)} scale={[label * 0.85, label * 0.85, 1]} renderOrder={11}>
              <spriteMaterial map={badge("edges", fa(i + 1))} depthTest={false} transparent />
            </sprite>
          ))}
          {model.vertices.slice(0, see("vertices")).map((v, i) => (
            <sprite key={`lv${i}`} position={out(new Vector3(...world(v)), 0.24)} scale={[label * 0.85, label * 0.85, 1]} renderOrder={12}>
              <spriteMaterial map={badge("vertices", fa(i + 1))} depthTest={false} transparent />
            </sprite>
          ))}
        </>
      )}

      {captionTex && (
        <mesh position={[0, 0.01, 1.35]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.2, 0.55]} />
          <meshBasicMaterial map={captionTex} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
