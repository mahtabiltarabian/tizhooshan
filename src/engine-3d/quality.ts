export type Quality = "low" | "normal" | "high";

/**
 * Light quality (no shadows, 1× pixels) for weak devices: ≤ 2 GB memory
 * (Chrome rounds a 3 GB tablet down to 2) or ≤ 4 processor cores. Unknown
 * values (Safari reports neither) count as a capable device.
 */
export function autoQuality(memory: number | undefined, cores: number | undefined): Quality {
  if ((memory !== undefined && memory <= 2) || (cores !== undefined && cores <= 4)) return "low";
  return "normal";
}
