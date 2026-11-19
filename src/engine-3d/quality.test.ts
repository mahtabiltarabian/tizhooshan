import { describe, expect, it } from "vitest";
import { autoQuality } from "./quality";

describe("3D quality by device", () => {
  it("is light on a cheap tablet", () => {
    expect(autoQuality(2, 8)).toBe("low");
    expect(autoQuality(4, 4)).toBe("low");
    expect(autoQuality(1, undefined)).toBe("low");
  });
  it("is normal on a capable device or when the browser does not say", () => {
    expect(autoQuality(8, 8)).toBe("normal");
    expect(autoQuality(4, 6)).toBe("normal");
    expect(autoQuality(undefined, undefined)).toBe("normal");
  });
});
