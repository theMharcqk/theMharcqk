export function isVideoFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (type.startsWith("video/")) return true;
  return /\.(mp4|m4v|mov|qt|webm|3gp|3g2)$/i.test(file.name || "");
}

export function pickRecorderMime(isSupported) {
  const types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((type) => isSupported(type)) || "";
}

export function filenameForMime(mime) {
  return /mp4/i.test(mime || "") ? "maclips-vertical.mp4" : "maclips-vertical.webm";
}

export function canShareFiles(file) {
  try {
    const probe =
      file || new File(["x"], "probe.mp4", { type: "video/mp4" });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

export async function saveClip(blob, name) {
  const type = blob.type || "video/webm";
  const file = new File([blob], name, { type });
  if (canShareFiles(file) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: "MaClips clip" });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }
  downloadBlob(blob, name);
  return "downloaded";
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
