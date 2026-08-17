import { describe, expect, it } from "vitest";
import { coverCrop, VERTICAL } from "../src/lib/geometry.js";

describe("milestone 3 — vertical 9:16 crop", () => {
  it("exports at 720x1280", () => {
    expect(VERTICAL.width / VERTICAL.height).toBeCloseTo(9 / 16);
  });

  it("center-crops landscape into 9:16", () => {
    const crop = coverCrop(1920, 1080);
    expect(crop.sw / crop.sh).toBeCloseTo(9 / 16);
    expect(crop.isVertical).toBe(false);
    expect(crop.sx).toBeGreaterThan(0);
    expect(crop.sy).toBe(0);
  });

  it("keeps a 9:16 source without extra crop on the long edge", () => {
    const crop = coverCrop(1080, 1920);
    expect(crop.isVertical).toBe(true);
    expect(crop.sx).toBe(0);
    expect(crop.sw).toBe(1080);
    expect(crop.sh).toBe(1920);
  });

  it("handles square footage", () => {
    const crop = coverCrop(1080, 1080);
    expect(crop.sw / crop.sh).toBeCloseTo(9 / 16);
    expect(crop.sx).toBeGreaterThan(0);
    expect(crop.sy).toBe(0);
  });
});
