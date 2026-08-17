import { describe, expect, it } from "vitest";
import {
  buildSuggestMessages,
  buildSuggestPayload,
  parseSuggestResponse,
} from "../src/lib/ai.js";
import { normalizePlan } from "../src/lib/plan.js";

describe("milestone 5 — AI suggest contract", () => {
  it("keeps the payload small and numeric", () => {
    const payload = buildSuggestPayload({
      prompt: "x".repeat(800),
      duration: 42,
      talking: Array.from({ length: 40 }, (_, i) => ({
        start: i,
        end: i + 0.5,
        score: 1,
      })),
      peaks: [{ time: 3, score: 2 }],
    });
    expect(payload.prompt.length).toBe(500);
    expect(payload.talking).toHaveLength(24);
    expect(payload.duration).toBe(42);
  });

  it("builds chat messages for the gateway", () => {
    const messages = buildSuggestMessages({ prompt: "hook", duration: 20, talking: [], peaks: [] });
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("hook");
    expect(messages[0].content).toContain("9:16");
  });

  it("parses JSON even when wrapped in text", () => {
    const parsed = parseSuggestResponse(
      'Sure.\n{"summary":"ok","clips":[{"start":1,"end":8,"title":"Hook"}]}\n',
    );
    const plan = normalizePlan({ ...parsed, source: "ai" }, 30);
    expect(plan.source).toBe("ai");
    expect(plan.clips[0].title).toBe("Hook");
    expect(plan.clips[0].start).toBe(1);
  });

  it("rejects empty AI output", () => {
    expect(() => parseSuggestResponse("no json here")).toThrow();
  });
});
