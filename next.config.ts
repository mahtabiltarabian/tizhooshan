import type { NextConfig } from "next";

// Static export: the same build runs as an offline PWA and inside Tauri.
const nextConfig: NextConfig = {
  output: "export",
  // Each page becomes <route>/index.html, so static hosts never confuse a
  // tool page with the folder holding its worksheet.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
