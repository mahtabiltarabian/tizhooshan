import type { NextConfig } from "next";

// Static export: the same build runs as an offline PWA and inside Tauri.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
