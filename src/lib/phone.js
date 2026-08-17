export function isStandalone({ standaloneNav = false, displayMode = "browser" } = {}) {
  if (standaloneNav) return true;
  return displayMode === "standalone" || displayMode === "fullscreen" || displayMode === "minimal-ui";
}

export function isIos(ua = "") {
  return /iPhone|iPad|iPod/i.test(ua);
}

export function isAndroid(ua = "") {
  return /Android/i.test(ua);
}

export function isPhoneClient({ ua = "", coarsePointer = false } = {}) {
  return coarsePointer || isIos(ua) || isAndroid(ua);
}

export function shouldShowInstallHint(env = {}, { dismissed = false } = {}) {
  if (dismissed || isStandalone(env)) return false;
  return isPhoneClient(env);
}

export function installHintMode({ ua = "", canPrompt = false } = {}) {
  if (isIos(ua)) return "ios-steps";
  if (canPrompt) return "prompt";
  if (isAndroid(ua)) return "android-menu";
  return "hidden";
}

export function installHintText(mode) {
  if (mode === "ios-steps") {
    return "Add to Home Screen: tap Share, then Add to Home Screen.";
  }
  if (mode === "prompt") return "Install MaClips as an app on this phone.";
  if (mode === "android-menu") {
    return "Install from the Chrome menu for a full-screen app.";
  }
  return "";
}

export function showInstallAction(mode) {
  return mode === "prompt";
}

export function readPhoneEnv(win = globalThis) {
  const ua = win.navigator?.userAgent || "";
  const standaloneNav = Boolean(win.navigator?.standalone);
  let displayMode = "browser";
  for (const mode of ["standalone", "fullscreen", "minimal-ui"]) {
    if (win.matchMedia?.(`(display-mode: ${mode})`)?.matches) {
      displayMode = mode;
      break;
    }
  }
  const coarsePointer = Boolean(win.matchMedia?.("(pointer: coarse)")?.matches);
  return { ua, standaloneNav, displayMode, coarsePointer };
}

export async function withWakeLock(task, request) {
  const ask =
    request ||
    (typeof navigator !== "undefined" ? navigator.wakeLock?.request?.bind(navigator.wakeLock) : null);
  let lock = null;
  try {
    lock = await ask?.("screen");
  } catch {
    lock = null;
  }
  try {
    return await task();
  } finally {
    try {
      await lock?.release?.();
    } catch {
      /* ignore */
    }
  }
}
