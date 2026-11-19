import { fa } from "@/tools/registry";

/** Why an n×n×n painted cube has that many small cubes with k painted faces. */
export function paintWhy(n: number, k: number): string {
  const m = n - 2;
  switch (k) {
    case 3:
      return "فقط ۸ گوشه سه وجه رنگی دارند.";
    case 2:
      return `روی هر یال، جز دو گوشه، ${fa(m)} مکعب: ۱۲ یال × ${fa(m)} = ${fa(12 * m)}.`;
    case 1:
      return `وسط هر وجه ${fa(m * m)} مکعب: ۶ وجه × ${fa(m * m)} = ${fa(6 * m * m)}.`;
    default:
      return `درون مکعب: ${fa(m)}×${fa(m)}×${fa(m)} = ${fa(m ** 3)}.`;
  }
}
