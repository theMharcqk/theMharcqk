import { describe, expect, it } from "vitest";
import {
  mergeOverlapping,
  normalizePlan,
  planClips,
  segmentsFromEnergy,
} from "../src/lib/plan.js";

describe("milestone 2 — clip planner", () => {
  it("turns energy samples into talking segments", () => {
    const samples = [
      0, 0, 0, 0.8, 0.9, 0.85, 0, 0, 0.7, 0.8, 0, 0, 0, 0, 0,
    ];
    const segs = segmentsFromEnergy(samples, 0.2, {
      relativeThreshold: 0.2,
      minDuration: 0.3,
      mergeGap: 0.25,
    });
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs[0].end).toBeGreaterThan(segs[0].start);
  });

  it("plans a start hook", () => {
    const plan = planClips({
      duration: 60,
      promptText: "15 second hook from the start",
    });
    expect(plan.clips).toHaveLength(1);
    expect(plan.clips[0].start).toBe(0);
    expect(plan.clips[0].end).toBe(15);
    expect(plan.clips[0].keep).toBe(true);
  });

  it("plans an ending clip", () => {
    const plan = planClips({
      duration: 50,
      promptText: "10 second clip from the end",
    });
    expect(plan.clips[0].start).toBe(40);
    expect(plan.clips[0].end).toBe(50);
  });

  it("cuts silence using energy", () => {
    const energySamples = Array.from({ length: 200 }, (_, i) =>
      i > 40 && i < 80 ? 0.9 : i > 140 && i < 170 ? 0.8 : 0.01,
    );
    const plan = planClips({
      duration: 10,
      hopSec: 0.05,
      energySamples,
      promptText: "cut silence and keep talking",
    });
    expect(plan.clips.length).toBeGreaterThanOrEqual(1);
    expect(plan.clips.every((clip) => clip.end - clip.start >= 0.4)).toBe(true);
  });

  it("builds three highlight windows from peaks", () => {
    const plan = planClips({
      duration: 90,
      promptText: "3 highlight clips of the best moments",
      peaks: [
        { time: 10, score: 1 },
        { time: 40, score: 0.8 },
        { time: 70, score: 0.7 },
      ],
    });
    expect(plan.clips).toHaveLength(3);
    expect(plan.clips[0].start).toBeLessThan(plan.clips[1].start);
  });

  it("enables captions from the prompt", () => {
    const plan = planClips({
      duration: 30,
      promptText: "20 seconds with captions",
    });
    expect(plan.edits.captions).toBe(true);
    expect(plan.clips[0].end - plan.clips[0].start).toBeLessThanOrEqual(20.01);
  });

  it("drops tiny and out-of-range clips", () => {
    const plan = normalizePlan(
      {
        clips: [
          { start: -4, end: 0.1, title: "tiny" },
          { start: 2, end: 8, title: "keep" },
          { start: 100, end: 120, title: "past" },
        ],
      },
      20,
    );
    expect(plan.clips.map((c) => c.title)).toEqual(["keep"]);
  });

  it("merges overlapping ranges", () => {
    const merged = mergeOverlapping([
      { start: 1, end: 3, score: 1 },
      { start: 2.9, end: 5, score: 2 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].end).toBe(5);
  });
});
