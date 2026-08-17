import { parsePrompt } from "./prompt.js";
import { clamp, clipDuration, overlaps, roundMs } from "./time.js";

function clipId(index) {
  return `clip-${index + 1}`;
}

export function segmentsFromEnergy(
  samples,
  hopSec,
  { relativeThreshold = 0.12, minDuration = 0.4, mergeGap = 0.28 } = {},
) {
  if (!samples?.length || hopSec <= 0) return [];
  const peak = Math.max(...samples, 1e-9);
  const threshold = peak * relativeThreshold;
  const raw = [];
  let start = null;

  for (let i = 0; i <= samples.length; i += 1) {
    const active = i < samples.length && samples[i] >= threshold;
    if (active && start === null) start = i;
    if (!active && start !== null) {
      raw.push({ start: start * hopSec, end: i * hopSec });
      start = null;
    }
  }

  const merged = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && seg.start - last.end <= mergeGap) {
      last.end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged
    .filter((seg) => seg.end - seg.start >= minDuration)
    .map((seg) => ({
      start: roundMs(seg.start),
      end: roundMs(seg.end),
      score: avgRange(samples, hopSec, seg.start, seg.end),
    }));
}

function avgRange(samples, hopSec, start, end) {
  const a = Math.max(0, Math.floor(start / hopSec));
  const b = Math.min(samples.length, Math.ceil(end / hopSec));
  if (b <= a) return 0;
  let sum = 0;
  for (let i = a; i < b; i += 1) sum += samples[i];
  return sum / (b - a);
}

export function mergeOverlapping(clips, gap = 0.12) {
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  const out = [];
  for (const clip of sorted) {
    const last = out[out.length - 1];
    if (last && overlaps(last, clip, gap)) {
      last.end = Math.max(last.end, clip.end);
      last.score = Math.max(last.score || 0, clip.score || 0);
      if (clip.title && !last.title) last.title = clip.title;
    } else {
      out.push({ ...clip });
    }
  }
  return out;
}

export function normalizePlan(plan, duration) {
  const max = Math.max(0, duration || 0);
  const clips = (plan.clips || [])
    .map((clip, index) => {
      const start = clamp(roundMs(Number(clip.start) || 0), 0, max);
      const end = clamp(roundMs(Number(clip.end) || 0), 0, max);
      return {
        id: clip.id || clipId(index),
        start: Math.min(start, end),
        end: Math.max(start, end),
        title: String(clip.title || `Clip ${index + 1}`),
        reason: String(clip.reason || ""),
        keep: clip.keep !== false,
        score: Number(clip.score) || 0,
      };
    })
    .filter((clip) => clipDuration(clip) >= 0.4)
    .sort((a, b) => a.start - b.start)
    .map((clip, index) => ({ ...clip, id: clipId(index) }));

  return {
    summary: plan.summary || (clips.length ? `${clips.length} clip${clips.length === 1 ? "" : "s"} ready` : "No clips yet"),
    source: plan.source || "local",
    edits: {
      captions: Boolean(plan.edits?.captions),
      speed: clamp(Number(plan.edits?.speed) || 1, 0.5, 2),
    },
    clips,
  };
}

function windowAt(position, duration, target) {
  const len = Math.min(target || Math.min(15, duration), duration);
  if (position === "end") {
    return { start: roundMs(duration - len), end: roundMs(duration) };
  }
  if (position === "middle") {
    const start = Math.max(0, (duration - len) / 2);
    return { start: roundMs(start), end: roundMs(start + len) };
  }
  return { start: 0, end: roundMs(len) };
}

function highlightClips(peaks, duration, count, windowSec) {
  const size = Math.min(windowSec || 12, duration);
  const ranked = [...peaks].sort((a, b) => (b.score || 0) - (a.score || 0));
  const clips = [];

  for (const peak of ranked) {
    if (clips.length >= count) break;
    const center = peak.time ?? 0;
    let start = clamp(center - size / 2, 0, Math.max(0, duration - size));
    let end = start + size;
    const next = { start, end, score: peak.score || 0 };
    if (clips.some((clip) => overlaps(clip, next, 0.4))) continue;
    clips.push(next);
  }

  if (!clips.length && duration > 0) {
    const step = duration / count;
    for (let i = 0; i < count; i += 1) {
      const start = i * step;
      clips.push({
        start: roundMs(start),
        end: roundMs(Math.min(duration, start + Math.min(size, step))),
        score: 0,
      });
    }
  }

  return clips.sort((a, b) => a.start - b.start);
}

export function planClips({
  duration = 0,
  promptText = "",
  energySamples = [],
  hopSec = 0.05,
  peaks = [],
} = {}) {
  const prompt = parsePrompt(promptText, duration);
  const talking = segmentsFromEnergy(energySamples, hopSec);
  const derivedPeaks =
    peaks.length > 0
      ? peaks
      : talking.map((seg) => ({
          time: (seg.start + seg.end) / 2,
          score: seg.score,
        }));

  let clips = [];
  let summary = "";

  if (!duration) {
    return normalizePlan({ summary: "Upload a video first", clips: [], edits: {} }, 0);
  }

  if (prompt.position === "full") {
    clips = [{ start: 0, end: duration, title: "Full video", reason: "Kept the whole take", score: 1 }];
    summary = "Using the full video";
  } else if (prompt.cutSilence || prompt.keepTalking) {
    clips = talking.length
      ? talking.map((seg, i) => ({
          ...seg,
          title: `Talk ${i + 1}`,
          reason: "Kept speech, dropped quiet gaps",
        }))
      : [windowAt("start", duration, prompt.targetDuration || Math.min(20, duration))];
    if (prompt.targetDuration && clips.length > 1) {
      const merged = mergeOverlapping(clips, 0.2);
      const total = merged.reduce((sum, c) => sum + (c.end - c.start), 0);
      if (total > prompt.targetDuration) {
        clips = highlightClips(derivedPeaks, duration, prompt.clipCount || 3, prompt.targetDuration / (prompt.clipCount || 1));
      } else {
        clips = merged;
      }
    }
    summary = "Cut quiet gaps and kept talking";
  } else if (prompt.position === "best" && (prompt.clipCount > 1 || /highlight|best|moment/i.test(prompt.raw))) {
    const windowSec = prompt.targetDuration
      ? prompt.targetDuration / prompt.clipCount
      : Math.min(12, duration / prompt.clipCount);
    clips = highlightClips(derivedPeaks, duration, prompt.clipCount, windowSec).map((clip, i) => ({
      ...clip,
      title: `Highlight ${i + 1}`,
      reason: "Highest energy moment",
    }));
    summary = `${clips.length} highlight clips`;
  } else {
    const single = windowAt(prompt.position, duration, prompt.targetDuration || Math.min(15, duration));
    clips = [
      {
        ...single,
        title: prompt.position === "end" ? "Outro" : prompt.position === "middle" ? "Mid clip" : "Hook",
        reason: prompt.raw || "Trimmed to a tight vertical clip",
        score: 1,
      },
    ];
    summary = `Clipped ${roundMs(single.end - single.start)}s from the ${prompt.position}`;
  }

  if (prompt.targetDuration && clips.length === 1) {
    const current = clips[0].end - clips[0].start;
    if (current > prompt.targetDuration + 0.05) {
      const centered = windowAt(prompt.position === "best" ? "start" : prompt.position, clips[0].end, prompt.targetDuration);
      clips[0].start = roundMs(clips[0].start + centered.start);
      clips[0].end = roundMs(Math.min(duration, clips[0].start + prompt.targetDuration));
    }
  }

  return normalizePlan(
    {
      summary,
      source: "local",
      edits: { captions: prompt.captions, speed: prompt.speed },
      clips,
    },
    duration,
  );
}
