import { segmentsFromEnergy } from "./plan.js";

const HOP = 0.05;
export const MAX_ANALYZE_BYTES = 40 * 1024 * 1024;

let sharedCtx = null;

export function primeAudioContext() {
  try {
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AudioContext();
    }
    return sharedCtx.resume();
  } catch {
    return Promise.resolve();
  }
}

export function shouldDecodeAudio(file) {
  const size = Number(file?.size) || 0;
  return size > 0 && size <= MAX_ANALYZE_BYTES;
}

export async function analyzeVideo(file, videoEl) {
  const duration = Number.isFinite(videoEl?.duration) ? videoEl.duration : 0;
  const result = {
    duration,
    width: videoEl?.videoWidth || 0,
    height: videoEl?.videoHeight || 0,
    hopSec: HOP,
    energySamples: [],
    peaks: [],
    talking: [],
  };

  if (!shouldDecodeAudio(file)) {
    result.peaks = evenlySpacedPeaks(duration, 5);
    return result;
  }

  try {
    const buffer = await decodeAudio(file);
    result.energySamples = rmsSamples(buffer, HOP);
    result.talking = segmentsFromEnergy(result.energySamples, HOP);
    result.peaks = topPeaks(result.energySamples, HOP, 8);
  } catch {
    result.peaks = evenlySpacedPeaks(duration, 5);
  }

  return result;
}

async function decodeAudio(file) {
  await primeAudioContext();
  const ctx = sharedCtx || new AudioContext();
  const data = await file.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

function rmsSamples(buffer, hopSec) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const hop = Math.max(1, Math.floor(sampleRate * hopSec));
  const samples = [];
  const mix = new Float32Array(length);

  for (let c = 0; c < channels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) mix[i] += data[i] / channels;
  }

  for (let i = 0; i < length; i += hop) {
    let sum = 0;
    const end = Math.min(length, i + hop);
    for (let j = i; j < end; j += 1) sum += mix[j] * mix[j];
    samples.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  return samples;
}

function topPeaks(samples, hopSec, count) {
  const scored = samples.map((score, i) => ({ time: i * hopSec, score }));
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const peak of scored) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.abs(p.time - peak.time) < 1.2)) continue;
    if (peak.score <= 0) continue;
    picked.push(peak);
  }
  return picked.sort((a, b) => a.time - b.time);
}

function evenlySpacedPeaks(duration, count) {
  if (duration <= 0) return [];
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => ({
    time: ((i + 0.5) / n) * duration,
    score: 1 - i * 0.05,
  }));
}
