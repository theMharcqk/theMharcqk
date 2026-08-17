const DURATION_RE =
  /(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/i;
const COUNT_RE = /(\d+)\s*(clips?|cuts?|highlights?|parts?|takes?)\b/i;

function has(text, re) {
  return re.test(text);
}

function toSeconds(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return /^m/i.test(unit) ? n * 60 : n;
}

export function parsePrompt(text = "", duration = 0) {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();

  const durationMatch = raw.match(DURATION_RE);
  let targetDuration = durationMatch
    ? toSeconds(durationMatch[1], durationMatch[2])
    : null;

  if (has(lower, /\b(short|hook|intro)\b/) && !targetDuration) {
    targetDuration = 15;
  }
  if (has(lower, /\b(full|entire|whole)\b/)) {
    targetDuration = duration || targetDuration;
  }

  const countMatch = raw.match(COUNT_RE);
  let clipCount = countMatch ? Math.min(12, Math.max(1, Number(countMatch[1]))) : null;

  const cutSilence = has(lower, /\b(silence|dead air|quiet|pauses?|uh+s?|ums?)\b/);
  const captions = has(lower, /\b(captions?|subtitles?|text on screen|titles?)\b/);
  const keepTalking = has(lower, /\b(talking|speech|voice|spoken|what i said)\b/);

  let speed = 1;
  if (has(lower, /\b(slow.?mo(?:tion)?|slower)\b/)) speed = 0.5;
  else if (has(lower, /\b(faster|speed up|2x)\b/)) speed = 1.5;
  else if (has(lower, /\b(quick|fast cuts?)\b/)) speed = 1.25;

  const wantsHighlights = has(lower, /\b(highlights?|best|viral|peak|key moments?|funniest)\b/);
  let position = "start";
  if (has(lower, /\b(end|ending|outro|close|last)\b/)) position = "end";
  else if (has(lower, /\b(middle|halfway)\b/)) position = "middle";
  else if (has(lower, /\b(full|entire|whole)\b/)) position = "full";
  else if (wantsHighlights) position = "best";
  else if (has(lower, /\b(start|beginning|intro|open(?:ing)?|hook)\b/)) position = "start";

  if (wantsHighlights) clipCount = clipCount || 3;
  if (cutSilence && !clipCount) clipCount = 1;
  if (!clipCount) clipCount = 1;

  if (targetDuration && duration) {
    targetDuration = Math.min(targetDuration, duration);
  }

  return {
    raw,
    targetDuration,
    clipCount,
    cutSilence,
    captions,
    keepTalking,
    speed,
    position,
    empty: raw.length === 0,
  };
}

export const PROMPT_CHIPS = [
  { label: "15s hook", prompt: "15 second hook from the start" },
  { label: "Cut silence", prompt: "cut silence and keep talking" },
  { label: "Best moments", prompt: "3 highlight clips of the best moments" },
  { label: "Captions", prompt: "best 20 seconds with captions" },
  { label: "Ending", prompt: "12 second clip from the end" },
];
