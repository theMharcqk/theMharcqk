import { pickRecorderMime } from "./files.js";
import { VERTICAL, drawCover } from "./geometry.js";
import { clipDuration } from "./time.js";

function pickMime() {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser can’t export video. Use Safari 18+ or Chrome on your phone.");
  }
  const mime = pickRecorderMime((type) => MediaRecorder.isTypeSupported(type));
  if (!mime) throw new Error("No supported recorder format on this phone.");
  return mime;
}

export async function exportClips({ video, clips, edits, onProgress }) {
  const kept = clips.filter((clip) => clip.keep !== false && clipDuration(clip) >= 0.4);
  if (!kept.length) throw new Error("Keep at least one clip to export.");

  const canvas = document.createElement("canvas");
  canvas.width = VERTICAL.width;
  canvas.height = VERTICAL.height;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    left: "-9999px",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: false });
  const fps = 30;
  const speed = edits?.speed || 1;
  const captions = Boolean(edits?.captions);
  const prevMuted = video.muted;
  const prevRate = video.playbackRate;
  const audio = attachAudio(video);

  try {
    const canvasStream = canvas.captureStream(fps);
    const tracks = [...canvasStream.getVideoTracks()];
    if (audio) tracks.push(...audio.stream.getAudioTracks());

    const stream = new MediaStream(tracks);
    const mimeType = pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error("Export failed"));
    });

    audio?.silenceOutput?.();
    video.muted = false;
    video.playbackRate = speed;
    recorder.start(250);

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
    await stopped;
    onProgress?.(100);

    canvasStream.getTracks().forEach((track) => track.stop());
    stream.getTracks().forEach((track) => track.stop());

    if (!chunks.length) {
      throw new Error("Export produced an empty file. Try Chrome or Safari 18+.");
    }

    return new Blob(chunks, { type: recorder.mimeType || mimeType });
  } finally {
    canvas.remove();
    audio?.restoreOutput?.();
    video.muted = prevMuted;
    video.playbackRate = prevRate;
  }
}

function attachAudio(video) {
  if (video._maclipsAudio) {
    video._maclipsAudio.ctx?.resume?.();
    return video._maclipsAudio;
  }
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(dest);
    source.connect(gain);
    gain.connect(ctx.destination);
    void ctx.resume();
    video._maclipsAudio = {
      ctx,
      stream: dest.stream,
      silenceOutput() {
        gain.gain.value = 0;
      },
      restoreOutput() {
        gain.gain.value = 1;
      },
    };
    return video._maclipsAudio;
  } catch {
    return null;
  }
}

function playClip(video, clip, speed, onFrame) {
  return new Promise((resolve, reject) => {
    let raf = 0;
    let started = false;
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
      if (started) return;
      started = true;
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
    video.addEventListener("seeked", startPlay, { once: true });
    video.currentTime = clip.start;
    if (Math.abs(video.currentTime - clip.start) < 0.05 && video.readyState >= 2) {
      startPlay();
    }
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

export { filenameForMime } from "./files.js";
