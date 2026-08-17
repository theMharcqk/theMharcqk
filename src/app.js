import { analyzeVideo } from "./lib/analyze.js";
import { buildSuggestPayload } from "./lib/ai.js";
import { downloadBlob, exportClips } from "./lib/export.js";
import { planClips } from "./lib/plan.js";
import { PROMPT_CHIPS } from "./lib/prompt.js";
import { clipDuration, formatTime, totalDuration } from "./lib/time.js";

const els = {
  dropzone: document.querySelector("#dropzone"),
  studio: document.querySelector("#studio"),
  fileInput: document.querySelector("#file-input"),
  pickBtn: document.querySelector("#pick-btn"),
  player: document.querySelector("#player"),
  playBtn: document.querySelector("#play-btn"),
  clock: document.querySelector("#clock"),
  scrub: document.querySelector("#scrub"),
  form: document.querySelector("#prompt-form"),
  prompt: document.querySelector("#prompt-input"),
  chips: document.querySelector("#chips"),
  status: document.querySelector("#status"),
  clips: document.querySelector("#clips"),
  exportBtn: document.querySelector("#export-btn"),
  trimWrap: document.querySelector("#trim-wrap"),
  inTime: document.querySelector("#in-time"),
  outTime: document.querySelector("#out-time"),
};

const state = {
  file: null,
  url: null,
  analysis: null,
  plan: { clips: [], edits: { captions: false, speed: 1 }, summary: "" },
  selectedId: null,
  busy: false,
};

export function boot() {
  PROMPT_CHIPS.forEach((chip) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = chip.label;
    btn.addEventListener("click", () => {
      els.prompt.value = chip.prompt;
      els.prompt.focus();
    });
    els.chips.append(btn);
  });

  els.pickBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file) void loadFile(file);
  });

  ["dragenter", "dragover"].forEach((type) => {
    els.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropzone.classList.add("over");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    els.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropzone.classList.remove("over");
    });
  });
  els.dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  });

  els.playBtn.addEventListener("click", togglePlay);
  els.player.addEventListener("timeupdate", syncClock);
  els.player.addEventListener("ended", () => {
    els.playBtn.textContent = "Play";
  });
  els.scrub.addEventListener("input", () => {
    els.player.currentTime = Number(els.scrub.value);
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runPrompt();
  });

  els.inTime.addEventListener("change", applyTrim);
  els.outTime.addEventListener("change", applyTrim);
  els.exportBtn.addEventListener("click", () => void runExport());
}

async function loadFile(file) {
  if (!file.type.startsWith("video/")) {
    setStatus("That file is not a video.");
    return;
  }

  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file;
  state.url = URL.createObjectURL(file);
  state.plan = { clips: [], edits: { captions: false, speed: 1 }, summary: "" };
  state.selectedId = null;

  els.dropzone.hidden = true;
  els.studio.hidden = false;
  els.player.src = state.url;
  await waitForMeta(els.player);
  els.scrub.max = String(els.player.duration || 0);
  els.exportBtn.disabled = true;
  setStatus("Reading energy in the take…");
  els.prompt.focus();

  state.analysis = await analyzeVideo(file, els.player);
  const tall = state.analysis.height >= state.analysis.width;
  setStatus(
    tall
      ? `${formatTime(state.analysis.duration)} vertical video ready. Tell me what to clip.`
      : `${formatTime(state.analysis.duration)} loaded. I’ll crop to 9:16 on export.`,
  );
}

function waitForMeta(video) {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("loadedmetadata", resolve, { once: true });
  });
}

async function runPrompt() {
  if (!state.analysis) {
    setStatus("Upload a video first.");
    return;
  }
  if (state.busy) return;
  state.busy = true;
  setStatus("Planning clips…");

  const local = planClips({
    duration: state.analysis.duration,
    promptText: els.prompt.value,
    energySamples: state.analysis.energySamples,
    hopSec: state.analysis.hopSec,
    peaks: state.analysis.peaks,
  });

  try {
    const payload = buildSuggestPayload({
      prompt: els.prompt.value,
      duration: state.analysis.duration,
      talking: state.analysis.talking,
      peaks: state.analysis.peaks,
    });
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      state.plan = await res.json();
      setStatus(`${state.plan.summary} · AI`);
    } else {
      state.plan = local;
      setStatus(`${local.summary} · on-device`);
    }
  } catch {
    state.plan = local;
    setStatus(`${local.summary} · on-device`);
  }

  state.selectedId = state.plan.clips[0]?.id || null;
  renderClips();
  previewSelected();
  state.busy = false;
}

function renderClips() {
  els.clips.innerHTML = "";
  const clips = state.plan.clips || [];
  els.exportBtn.disabled = !clips.some((clip) => clip.keep);
  els.trimWrap.hidden = !state.selectedId;

  clips.forEach((clip) => {
    const item = document.createElement("li");
    item.className = `clip${clip.id === state.selectedId ? " selected" : ""}${clip.keep ? "" : " skipped"}`;
    item.innerHTML = `
      <div>
        <h3>${escapeHtml(clip.title)}</h3>
        <p>${formatTime(clip.start)}–${formatTime(clip.end)} · ${formatTime(clipDuration(clip))} · ${escapeHtml(clip.reason || "Clip")}</p>
      </div>
      <div class="clip-actions">
        <button type="button" data-act="keep" class="${clip.keep ? "keep" : ""}">${clip.keep ? "Keep" : "Skip"}</button>
      </div>
    `;
    item.addEventListener("click", () => {
      state.selectedId = clip.id;
      renderClips();
      previewSelected();
    });
    item.querySelector("[data-act=keep]").addEventListener("click", (event) => {
      event.stopPropagation();
      clip.keep = !clip.keep;
      renderClips();
    });
    els.clips.append(item);
  });

  const selected = clips.find((clip) => clip.id === state.selectedId);
  if (selected) {
    els.inTime.value = String(round1(selected.start));
    els.outTime.value = String(round1(selected.end));
  }
}

function previewSelected() {
  const clip = state.plan.clips.find((item) => item.id === state.selectedId);
  if (!clip) return;
  els.player.currentTime = clip.start;
  els.player.play().catch(() => {});
  els.playBtn.textContent = "Pause";
}

function applyTrim() {
  const clip = state.plan.clips.find((item) => item.id === state.selectedId);
  if (!clip) return;
  const duration = state.analysis?.duration || 0;
  clip.start = Math.max(0, Number(els.inTime.value) || 0);
  clip.end = Math.min(duration, Number(els.outTime.value) || 0);
  if (clip.end <= clip.start) clip.end = Math.min(duration, clip.start + 0.5);
  renderClips();
}

function togglePlay() {
  if (els.player.paused) {
    els.player.play();
    els.playBtn.textContent = "Pause";
  } else {
    els.player.pause();
    els.playBtn.textContent = "Play";
  }
}

function syncClock() {
  els.clock.textContent = formatTime(els.player.currentTime);
  els.scrub.value = String(els.player.currentTime);
}

async function runExport() {
  if (state.busy) return;
  state.busy = true;
  setStatus("Exporting vertical clip…");
  try {
    const blob = await exportClips({
      video: els.player,
      clips: state.plan.clips,
      edits: state.plan.edits,
      onProgress: (pct) => setStatus(`Exporting ${pct}%`),
    });
    downloadBlob(blob, "maclips-vertical.webm");
    setStatus(`Exported ${formatTime(totalDuration(state.plan.clips.filter((c) => c.keep)))} of 9:16 video`);
  } catch (error) {
    setStatus(error.message || "Export failed");
  }
  state.busy = false;
}

function setStatus(text) {
  els.status.textContent = text;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
