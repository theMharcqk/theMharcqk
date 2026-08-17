import { describe, expect, it } from "vitest";
import {
  installHintMode,
  installHintText,
  isStandalone,
  shouldShowInstallHint,
  showInstallAction,
  withWakeLock,
} from "../src/lib/phone.js";

describe("phone web app helpers", () => {
  it("treats iOS Home Screen and Android standalone as installed", () => {
    expect(isStandalone({ standaloneNav: true, displayMode: "browser" })).toBe(true);
    expect(isStandalone({ displayMode: "standalone" })).toBe(true);
    expect(isStandalone({ displayMode: "browser" })).toBe(false);
  });

  it("hides the install hint after Home Screen install or dismiss", () => {
    const iphone = { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", coarsePointer: true };
    expect(shouldShowInstallHint(iphone)).toBe(true);
    expect(shouldShowInstallHint({ ...iphone, standaloneNav: true })).toBe(false);
    expect(shouldShowInstallHint(iphone, { dismissed: true })).toBe(false);
    expect(shouldShowInstallHint({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", coarsePointer: false })).toBe(
      false,
    );
  });

  it("uses Share-sheet copy on iOS and a native prompt on Android when available", () => {
    expect(installHintMode({ ua: "iPhone" })).toBe("ios-steps");
    expect(showInstallAction("ios-steps")).toBe(false);
    expect(installHintText("ios-steps")).toMatch(/Share/);

    expect(installHintMode({ ua: "Android", canPrompt: true })).toBe("prompt");
    expect(showInstallAction("prompt")).toBe(true);

    expect(installHintMode({ ua: "Android", canPrompt: false })).toBe("android-menu");
    expect(showInstallAction("android-menu")).toBe(false);
  });

  it("releases a screen wake lock after the task finishes", async () => {
    const calls = [];
    const request = async () => ({
      release: async () => {
        calls.push("release");
      },
    });
    const value = await withWakeLock(async () => "ok", request);
    expect(value).toBe("ok");
    expect(calls).toEqual(["release"]);
  });

  it("still runs the task if wake lock is missing", async () => {
    const value = await withWakeLock(async () => 7, null);
    expect(value).toBe(7);
  });
});
