"use client";

// Shared 3D stage for every 3D tool: soft toy lighting, a table, contact
// shadow, touch/mouse orbit, and the shared toolbar (pen, text, undo, zoom,
// first view, save image). Nothing is loaded from the network.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Vector3, type WebGLRenderer } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnnotationLayer, paintAnnotations, PEN_COLORS, type Annotation, type DrawTool } from "@/toolkit/AnnotationLayer";
import { Toolbar } from "@/toolkit/Toolbar";
import styles from "./Stage.module.css";

export type Quality = "low" | "normal" | "high";

/** Named views a tool can fly the camera to. Model "front" (-y) is world +z. */
export type Look = "front" | "side" | "top" | "corner";

interface StageProps {
  children: ReactNode;
  target?: [number, number, number];
  quality?: Quality;
  /** File name stem for "save image". */
  imageName?: string;
  /** Starting camera position (the "first view"). */
  camera?: [number, number, number];
  /** When set, the camera glides to this view; null leaves it where the user put it. */
  look?: Look | null;
  /** Change to glide to `look` again (e.g. the same view button pressed twice). */
  lookNonce?: number;
}

/** Glides the camera to a named view, then hands control back to the user. */
function CameraRig({
  look,
  nonce,
  controls,
  home,
}: {
  look: Look | null;
  nonce: number;
  controls: React.RefObject<OrbitControlsImpl | null>;
  home: [number, number, number];
}) {
  const { camera } = useThree();
  const goal = useRef<Vector3 | null>(null);
  useEffect(() => {
    if (!look) return;
    const dist = new Vector3(...home).length();
    const p: Record<Look, [number, number, number]> = {
      front: [0, 1.4, dist],
      side: [dist, 1.4, 0],
      top: [0, dist, 0.01],
      corner: home,
    };
    goal.current = new Vector3(...p[look]);
  }, [look, nonce, home]);
  useFrame((_, dt) => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, Math.min(1, dt * 4));
    controls.current?.update();
    if (camera.position.distanceTo(goal.current) < 0.02) goal.current = null;
  });
  return null;
}

const DPR: Record<Quality, [number, number]> = { low: [1, 1], normal: [1, 1.5], high: [1, 2] };
const TABLE = "#efe5d3";
const MIN_DISTANCE = 3;
const MAX_DISTANCE = 12;

const HOME: [number, number, number] = [3.4, 4.2, 4.6];

export function Stage({
  children,
  target = [0, 0.5, 0],
  quality = "normal",
  imageName = "tizhooshan",
  camera = HOME,
  look = null,
  lookNonce = 0,
}: StageProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const gl = useRef<WebGLRenderer | null>(null);
  const [tool, setTool] = useState<DrawTool>("none");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [notes, setNotes] = useState<Annotation[]>([]);

  const zoom = (factor: number) => {
    const c = controls.current;
    if (!c) return;
    const offset = c.object.position.clone().sub(c.target);
    offset.setLength(Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, offset.length() * factor)));
    c.object.position.copy(c.target).add(offset);
    c.update();
  };

  // The 3D picture plus whatever was drawn on top, as one PNG.
  const saveImage = () => {
    const src = gl.current?.domElement;
    if (!src) return;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(src, 0, 0);
    paintAnnotations(ctx, notes, out.width, out.height, out.width / src.clientWidth);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${imageName}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  return (
    <div className={styles.stage}>
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        shadows={quality !== "low"}
        dpr={DPR[quality]}
        camera={{ position: camera, fov: 38 }}
        // Keeps the last frame readable for "save image".
        gl={{ preserveDrawingBuffer: true }}
        onCreated={(state) => (gl.current = state.gl)}
      >
        {/* Background and fog match the table so its edge melts away. */}
        <color attach="background" args={[TABLE]} />
        <fog attach="fog" args={[TABLE, 9, 22]} />
        <hemisphereLight args={["#ffffff", "#e8dcc6", 1.1]} />
        <directionalLight position={[4, 8, 5]} intensity={1.5} castShadow={quality !== "low"} shadow-mapSize={[1024, 1024]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshBasicMaterial color={TABLE} />
        </mesh>

        {children}

        {quality !== "low" && <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={10} blur={2.4} far={3} />}
        <OrbitControls
          ref={controls}
          makeDefault
          // While drawing, the pen owns the pointer and the scene stays still.
          enabled={tool === "none"}
          target={target}
          enablePan={false}
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
          maxPolarAngle={Math.PI * 0.47}
        />
        <CameraRig look={look} nonce={lookNonce} controls={controls} home={camera} />
      </Canvas>

      <AnnotationLayer tool={tool} color={color} items={notes} onAdd={(a) => setNotes((n) => [...n, a])} />

      <Toolbar
        tool={tool}
        color={color}
        canUndo={notes.length > 0}
        onTool={setTool}
        onColor={setColor}
        onUndo={() => setNotes((n) => n.slice(0, -1))}
        onClear={() => setNotes([])}
        onZoom={zoom}
        onReset={() => controls.current?.reset()}
        onSave={saveImage}
      />
    </div>
  );
}
