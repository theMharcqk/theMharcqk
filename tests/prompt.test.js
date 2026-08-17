import { describe, expect, it } from "vitest";
import { parsePrompt, PROMPT_CHIPS } from "../src/lib/prompt.js";

describe("milestone 1 — prompt intelligence", () => {
  it("parses a 15s hook from the start", () => {
    const parsed = parsePrompt("15 second hook from the start", 60);
    expect(parsed.targetDuration).toBe(15);
    expect(parsed.position).toBe("start");
    expect(parsed.clipCount).toBe(1);
  });

  it("parses highlight count and captions", () => {
    const parsed = parsePrompt("3 highlight clips with captions", 90);
    expect(parsed.clipCount).toBe(3);
    expect(parsed.captions).toBe(true);
    expect(parsed.position).toBe("best");
  });

  it("defaults a duration-only prompt to one start clip", () => {
    const parsed = parsePrompt("20 seconds with captions", 30);
    expect(parsed.clipCount).toBe(1);
    expect(parsed.position).toBe("start");
    expect(parsed.captions).toBe(true);
  });

  it("parses cut silence and talking", () => {
    const parsed = parsePrompt("cut silence and keep talking", 40);
    expect(parsed.cutSilence).toBe(true);
    expect(parsed.keepTalking).toBe(true);
  });

  it("parses minutes and ending", () => {
    const parsed = parsePrompt("1 minute clip from the end", 180);
    expect(parsed.targetDuration).toBe(60);
    expect(parsed.position).toBe("end");
  });

  it("caps target duration to video length", () => {
    const parsed = parsePrompt("45 second hook", 20);
    expect(parsed.targetDuration).toBe(20);
  });

  it("detects slow mo and faster", () => {
    expect(parsePrompt("slow mo the ending").speed).toBe(0.5);
    expect(parsePrompt("speed up the best moments").speed).toBe(1.5);
  });

  it("exposes starter chips", () => {
    expect(PROMPT_CHIPS.length).toBeGreaterThanOrEqual(4);
    expect(PROMPT_CHIPS.every((chip) => chip.prompt.length > 0)).toBe(true);
  });
});
