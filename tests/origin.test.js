import { describe, expect, it } from "vitest";
import { isSameOrigin, MAX_SUGGEST_BODY } from "../src/lib/origin.js";

describe("suggest origin guard", () => {
  it("allows same-origin browser calls and non-browser calls without Origin", () => {
    expect(isSameOrigin("https://maclips.netlify.app/api/suggest", "https://maclips.netlify.app")).toBe(true);
    expect(isSameOrigin("https://maclips.netlify.app/api/suggest", "")).toBe(true);
    expect(isSameOrigin("https://maclips.netlify.app/api/suggest", null)).toBe(true);
  });

  it("rejects cross-site Origin headers", () => {
    expect(isSameOrigin("https://maclips.netlify.app/api/suggest", "https://evil.example")).toBe(false);
    expect(isSameOrigin("https://maclips.netlify.app/api/suggest", "not a url")).toBe(false);
  });

  it("caps the suggest payload size", () => {
    expect(MAX_SUGGEST_BODY).toBe(20_000);
  });
});
