import { VERTICAL, drawCover } from "./geometry.js";
import { clipDuration } from "./time.js";

function pickMime() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

export async function exportClips({ video, clips, edits, onProgress }) {
  const kept = clips.filter((clip) => clip.keep !== false && clipDuration(clip) >= 0.4);
  if (!kept.length) throw new Error("Keep at least one clip to export.");

  const canvas = document.createElement("canvas");
  canvas.width = VERTICAL.width;
  canvas.height = VERTICAL.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  const fps = 30;
  const speed = edits?.speed || 1;
  const captions = Boolean(edits?.captions);

  const canvasStream = canvas.captureStream(fps);
  const audio = attachAudio(video);
  const tracks = [...canvasStream.getVideoTracks()];
  if (audio) tracks.push(...audio.stream.getAudioTracks());

  const stream = new MediaStream(tracks);
  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_500_000 });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = () => reject(new Error("Export failed"));
  });

  recorder.start(250);
  video.muted = Boolean(audio);
  video.playbackRate = speed;

  let done = 0;
  const total = kept.reduce((sum, clip) => sum + clipDuration(clip), 0) || 1;

  for (const clip of kept) {
    await playClip(video, clip, speed, (now) => {
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCover(ctx, video, canvas.width, canvas.height);
      if (captions) drawCaption(ctx, clip.title);
      done = Math.min(total, done + (now || 0));
      onProgress?.(Math.min(99, Math.round((done / total) * 100)));
    });
  }

  video.pause();
  recorder.stop();
  audio?.stop();
  await stopped;
  onProgress?.(100);

  canvasStream.getTracks().forEach((track) => track.stop());
  stream.getTracks().forEach((track) => track.stop());

  return new Blob(chunks, { type: mimeType });
}

function attachAudio(video) {
  if (video._maclipsAudio) return video._maclipsAudio;
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(ctx.destination);
    video._maclipsAudio = {
      stream: dest.stream,
      stop() {},
    };
    return video._maclipsAudio;
  } catch {
    return null;
  }
}

function playClip(video, clip, speed, onFrame) {
  return new Promise((resolve, reject) => {
    let raf = 0;
    let last = performance.now();
    const limit = Math.max(800, ((clip.end - clip.start) / Math.max(0.25, speed)) * 1000 + 1500);
    const watchdog = setTimeout(() => {
      cancelAnimationFrame(raf);
      resolve();
    }, limit);

    const finish = () => {
      clearTimeout(watchdog);
      cancelAnimationFrame(raf);
      resolve();
    };

    const tick = (now) => {
      onFrame?.((now - last) / 1000);
      last = now;
      if (video.currentTime >= clip.end - 0.04 || video.ended) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const startPlay = () => {
      video
        .play()
        .then(() => {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        })
        .catch((error) => {
          clearTimeout(watchdog);
          reject(error);
        });
    };

    video.pause();
    video.playbackRate = speed;
    if (Math.abs(video.currentTime - clip.start) < 0.05) {
      startPlay();
      return;
    }
    video.addEventListener("seeked", startPlay, { once: true });
    video.currentTime = clip.start;
  });
}

function drawCaption(ctx, text) {
  const label = String(text || "").trim();
  if (!label) return;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.font = "700 36px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.fillStyle = "#fff";
  wrapText(ctx, label, width / 2, height - 88, width - 80, 42);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.slice(-3).forEach((item, i, all) => {
    const yy = y - (all.length - 1 - i) * lineHeight;
    ctx.strokeText(item, x, yy);
    ctx.fillText(item, x, yy);
  });
}

export function downloadBlob(blob, name = "maclips-clip.webm") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
