import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * Transparent texture with one big centred label (Persian digit or symbol).
 * `warn` adds dark diagonal hatching, so a marked face is visible without colour.
 */
export function labelTexture(label: string, warn = false, ink: "light" | "dark" = "light"): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (warn) {
    ctx.strokeStyle = "rgba(31, 36, 48, 0.55)";
    ctx.lineWidth = size * 0.05;
    for (let d = -size; d < size * 2; d += size * 0.16) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d - size, size);
      ctx.stroke();
    }
  }

  ctx.font = `700 ${size * 0.55}px Vazirmatn, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (ink === "dark") {
    // Dark symbol on a pale face, as printed on an exam sheet.
    ctx.fillStyle = "#0f172a";
  } else {
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.06;
    ctx.strokeStyle = "rgba(31, 36, 48, 0.85)";
    ctx.strokeText(label, size / 2, size * 0.54);
    ctx.fillStyle = "#ffffff";
  }
  ctx.fillText(label, size / 2, size * 0.54);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
