import { describe, expect, it, vi } from "vitest";
import { filenameForMime, isVideoFile, pickRecorderMime, saveClip } from "../src/lib/files.js";

describe("mobile file helpers", () => {
  it("accepts camera-roll files with empty MIME but a video extension", () => {
    expect(isVideoFile({ type: "", name: "IMG_0123.MOV" })).toBe(true);
    expect(isVideoFile({ type: "", name: "clip.mp4" })).toBe(true);
    expect(isVideoFile({ type: "video/mp4", name: "x" })).toBe(true);
    expect(isVideoFile({ type: "image/jpeg", name: "photo.jpg" })).toBe(false);
  });

  it("prefers mp4 when the browser can record it", () => {
    const mime = pickRecorderMime((type) => type.startsWith("video/mp4"));
    expect(mime).toContain("mp4");
    expect(filenameForMime(mime)).toBe("maclips-vertical.mp4");
  });

  it("falls back to webm", () => {
    const mime = pickRecorderMime((type) => type.includes("webm"));
    expect(mime).toContain("webm");
    expect(filenameForMime(mime)).toBe("maclips-vertical.webm");
  });

  it("rethrows when the user cancels the share sheet", async () => {
    const blob = new Blob(["x"], { type: "video/webm" });
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: async () => {
        const error = new Error("canceled");
        error.name = "AbortError";
        throw error;
      },
    });
    await expect(saveClip(blob, "maclips-vertical.webm")).rejects.toMatchObject({ name: "AbortError" });
    vi.unstubAllGlobals();
  });
});
