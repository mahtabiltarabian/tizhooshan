"use client";

// Shared stage for 2D tools: an SVG drawing that fills the stage, with the
// same toolbar as the 3D stage (pen, text, undo, zoom, first view, save
// image). Zoom scales the view box about its centre. Nothing is loaded from
// the network.

import { useRef, useState, type ReactNode } from "react";
import { AnnotationLayer, paintAnnotations, PEN_COLORS, type Annotation, type DrawTool } from "@/toolkit/AnnotationLayer";
import { Toolbar } from "@/toolkit/Toolbar";
import styles from "@/engine-3d/Stage.module.css";

interface BoardProps {
  /** The drawing's own coordinates: [x, y, width, height]. */
  view: [number, number, number, number];
  children: ReactNode;
  imageName?: string;
  label?: string;
}

const BG = "#efe5d3";

export function Board({ view, children, imageName = "tizhooshan", label }: BoardProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<DrawTool>("none");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [zoom, setZoom] = useState(1);

  // Room on the right for the toolbar, which floats over the stage.
  const [x, y, w0, h] = view;
  const w = w0 * 1.1;
  const zw = w / zoom;
  const zh = h / zoom;
  const viewBox = `${x + (w - zw) / 2} ${y + (h - zh) / 2} ${zw} ${zh}`;

  // The drawing plus whatever was written on top, as one PNG.
  const saveImage = () => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const scale = 2;
    const copy = el.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("width", String(r.width));
    copy.setAttribute("height", String(r.height));
    const src = new XMLSerializer().serializeToString(copy);
    const img = new Image();
    img.onload = () => {
      const out = document.createElement("canvas");
      out.width = r.width * scale;
      out.height = r.height * scale;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, 0, 0, out.width, out.height);
      paintAnnotations(ctx, notes, out.width, out.height, scale);
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
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
  };

  return (
    <div className={styles.stage}>
      <svg
        ref={svg}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", direction: "ltr" }}
        role="img"
        aria-label={label}
      >
        {children}
      </svg>

      <AnnotationLayer tool={tool} color={color} items={notes} onAdd={(a) => setNotes((n) => [...n, a])} />

      <Toolbar
        tool={tool}
        color={color}
        canUndo={notes.length > 0}
        onTool={setTool}
        onColor={setColor}
        onUndo={() => setNotes((n) => n.slice(0, -1))}
        onClear={() => setNotes([])}
        onZoom={(f) => setZoom((z) => Math.min(3, Math.max(0.6, z / f)))}
        onReset={() => setZoom(1)}
        onSave={saveImage}
      />
    </div>
  );
}
