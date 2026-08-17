import { describe, expect, it } from "vitest";
import { analyzeVideo, MAX_ANALYZE_BYTES, shouldDecodeAudio } from "../src/lib/analyze.js";

describe("phone analysis limits", () => {
  it("skips whole-file decode for oversized camera-roll videos", () => {
    expect(shouldDecodeAudio({ size: 12 * 1024 * 1024 })).toBe(true);
    expect(shouldDecodeAudio({ size: MAX_ANALYZE_BYTES + 1 })).toBe(false);
    expect(shouldDecodeAudio({ size: 0 })).toBe(false);
  });

  it("treats non-finite duration as empty instead of Infinity", async () => {
    const result = await analyzeVideo({ size: MAX_ANALYZE_BYTES + 8 }, { duration: Infinity, videoWidth: 720, videoHeight: 1280 });
    expect(result.duration).toBe(0);
    expect(result.peaks).toEqual([]);
  });
});
