import { describe, expect, it } from "vitest";
import { clipDuration, formatTime, totalDuration } from "../src/lib/time.js";

describe("milestone 4 — time helpers", () => {
  it("formats minutes and hours", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("sums kept clip durations", () => {
    const clips = [
      { start: 0, end: 5 },
      { start: 10, end: 12.5 },
    ];
    expect(clipDuration(clips[0])).toBe(5);
    expect(totalDuration(clips)).toBe(7.5);
  });
});
