export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function roundMs(seconds) {
  return Math.round(seconds * 1000) / 1000;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function clipDuration(clip) {
  return Math.max(0, roundMs((clip.end ?? 0) - (clip.start ?? 0)));
}

export function totalDuration(clips) {
  return roundMs(clips.reduce((sum, clip) => sum + clipDuration(clip), 0));
}

export function overlaps(a, b, gap = 0) {
  return a.start < b.end + gap && b.start < a.end + gap;
}
