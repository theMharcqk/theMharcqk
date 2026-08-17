import { analyzeVideo, primeAudioContext } from "./lib/analyze.js";
import { buildSuggestPayload } from "./lib/ai.js";
import { exportClips } from "./lib/export.js";
import { filenameForMime, isVideoFile, saveClip } from "./lib/files.js";
import {
  installHintMode,
  installHintText,
  readPhoneEnv,
  shouldShowInstallHint,
  showInstallAction,
  withWakeLock,
} from "./lib/phone.js";
import { normalizePlan, planClips } from "./lib/plan.js";
import { PROMPT_CHIPS } from "./lib/prompt.js";
import { clipDuration, formatTime, totalDuration } from "./lib/time.js";

const els = {
  dropzone: document.querySelector("#dropzone"),
  studio: document.querySelector("#studio"),
  fileInput: document.querySelector("#file-input"),
  cameraInput: document.querySelector("#camera-input"),
  pickBtn: document.querySelector("#pick-btn"),
  cameraBtn: document.querySelector("#camera-btn"),
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
  exportDock: document.querySelector("#export-dock"),
  downloadLink: document.querySelector("#download-link"),
  downloadDock: document.querySelector("#download-dock"),
  dock: document.querySelector("#dock"),
  newBtn: document.querySelector("#new-btn"),
  installHint: document.querySelector("#install-hint"),
  installCopy: document.querySelector("#install-copy"),
  installBtn: document.querySelector("#install-btn"),
  installDismiss: document.querySelector("#install-dismiss"),
  pickerStatus: document.querySelector("#picker-status"),
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
  downloadUrl: null,
};

const isPhone = () =>
  window.matchMedia("(max-width: 840px), (hover: none) and (pointer: coarse)").matches;

function syncPhoneChrome() {
  document.documentElement.classList.toggle("is-phone", isPhone());
}

export function boot() {
  PROMPT_CHIPS.forEach((chip) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = chip.label;
    btn.addEventListener("click", () => {
      els.prompt.value = chip.prompt;
    });
    els.chips.append(btn);
  });

  els.pickBtn.addEventListener("click", () => els.fileInput.click());
  els.cameraBtn.addEventListener("click", () => els.cameraInput.click());
  const onPick = (input) => {
    const file = input.files?.[0];
    input.value = "";
    if (file) void loadFile(file);
  };
  els.fileInput.addEventListener("change", () => onPick(els.fileInput));
  els.cameraInput.addEventListener("change", () => onPick(els.cameraInput));

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
    els.prompt.blur();
    void runPrompt();
  });

  els.inTime.addEventListener("change", applyTrim);
  els.outTime.addEventListener("change", applyTrim);
  els.exportBtn.addEventListener("click", () => void runExport());
  els.exportDock.addEventListener("click", () => void runExport());
  els.newBtn.addEventListener("click", resetToPicker);
  els.prompt.addEventListener("focus", () => els.dock.classList.add("tucked"));
  els.prompt.addEventListener("blur", () => els.dock.classList.remove("tucked"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !state.busy) {
      els.player.pause();
      els.playBtn.textContent = "Play";
    }
  });
  watchKeyboard();
  bootInstallHint();
  syncPhoneChrome();
  window.addEventListener("resize", syncPhoneChrome);
  window.addEventListener("orientationchange", syncPhoneChrome);
}

async function loadFile(file) {
  if (!isVideoFile(file)) {
    setPickerStatus("Choose a video from Photos.");
    return;
  }

  const audioUnlock = primeAudioContext();
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file;
  state.url = URL.createObjectURL(file);
  state.plan = { clips: [], edits: { captions: false, speed: 1 }, summary: "" };
  state.selectedId = null;
  state.analysis = null;

  setPickerStatus("");
  els.dropzone.hidden = true;
  els.studio.hidden = false;
  els.dock.hidden = false;
  els.newBtn.hidden = false;
  els.clips.innerHTML = "";
  els.trimWrap.hidden = true;
  els.player.src = state.url;
  els.player.muted = false;
  els.player.playbackRate = 1;
  els.player.setAttribute("playsinline", "");
  els.player.setAttribute("webkit-playsinline", "");
  try {
    await waitForMeta(els.player);
    await audioUnlock;
  } catch (error) {
    setStatus(error.message || "This phone can’t play that file. Try MP4.");
    return;
  }
  els.scrub.max = String(els.player.duration || 0);
  setExportEnabled(false);
  setStatus(
    file.size > 80 * 1024 * 1024
      ? "Large video — analysis may take a bit on phone."
      : "Reading the take…",
  );

  try {
    state.analysis = await analyzeVideo(file, els.player);
  } catch {
    setStatus("Could not analyze that video on this phone.");
    return;
  }
  const tall = state.analysis.height >= state.analysis.width;
  setStatus(
    tall
      ? `${formatTime(state.analysis.duration)} ready. Tell me what to clip.`
      : `${formatTime(state.analysis.duration)} loaded. I’ll crop to 9:16.`,
  );
}

function waitForMeta(video) {
  const ready = () =>
    video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0;
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const fail = setTimeout(() => reject(new Error("Could not read that video.")), 20000);
    const succeed = () => {
      if (!ready()) return;
      clearTimeout(fail);
      video.removeEventListener("loadedmetadata", succeed);
      video.removeEventListener("durationchange", succeed);
      resolve();
    };
    video.addEventListener("loadedmetadata", succeed);
    video.addEventListener("durationchange", succeed);
    video.addEventListener(
      "error",
      () => {
        clearTimeout(fail);
        reject(new Error("This phone can’t play that file. Try MP4."));
      },
      { once: true },
    );
  });
}

async function runPrompt() {
  if (!state.analysis) {
    setStatus("Pick a video first.");
    return;
  }
  if (state.busy) return;
  state.busy = true;
  els.newBtn.disabled = true;
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
      const remote = normalizePlan(await res.json(), state.analysis.duration);
      if (remote.clips.length) {
        state.plan = remote;
        setStatus(`${state.plan.summary} · AI`);
      } else {
        state.plan = local;
        setStatus(`${local.summary} · on-device`);
      }
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
  els.newBtn.disabled = false;
}

function renderClips() {
  els.clips.innerHTML = "";
  const clips = state.plan.clips || [];
  setExportEnabled(clips.some((clip) => clip.keep));
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
  if (!isPhone()) {
    els.player.play().catch(() => {});
    els.playBtn.textContent = "Pause";
  }
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
    els.player
      .play()
      .then(() => {
        els.playBtn.textContent = "Pause";
      })
      .catch(() => {
        els.playBtn.textContent = "Play";
      });
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
  els.newBtn.disabled = true;
  setExportEnabled(false);
  setSaveLabel("Exporting…");
  setStatus("Exporting vertical clip…");
  try {
    const blob = await withWakeLock(() =>
      exportClips({
        video: els.player,
        clips: state.plan.clips,
        edits: state.plan.edits,
        onProgress: (pct) => {
          setStatus(`Exporting ${pct}%`);
          setSaveLabel(`Exporting ${pct}%`);
        },
      }),
    );
    const name = filenameForMime(blob.type);
    offerDownload(blob, name);
    let how = "downloaded";
    try {
      how = await saveClip(blob, name);
    } catch (error) {
      if (error?.name !== "AbortError") throw error;
      how = "canceled";
    }
    const length = formatTime(totalDuration(state.plan.clips.filter((c) => c.keep)));
    const where =
      how === "shared" ? "Share sheet" : how === "canceled" ? "Save canceled" : "File ready";
    setStatus(`${where} · ${length} 9:16. Tap Download if it didn’t appear.`);
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("Save canceled.");
    } else {
      setStatus(error.message || "Export failed");
    }
  }
  state.busy = false;
  els.newBtn.disabled = false;
  setSaveLabel("Save clip");
  setExportEnabled((state.plan.clips || []).some((clip) => clip.keep));
}

function resetToPicker() {
  if (state.busy) return;
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = null;
  state.url = null;
  state.analysis = null;
  state.plan = { clips: [], edits: { captions: false, speed: 1 }, summary: "" };
  state.selectedId = null;
  els.player.removeAttribute("src");
  els.player.load();
  els.dropzone.hidden = false;
  els.studio.hidden = true;
  els.dock.hidden = true;
  els.newBtn.hidden = true;
  els.clips.innerHTML = "";
  els.trimWrap.hidden = true;
  els.prompt.value = "";
  hideDownload();
  setSaveLabel("Save clip");
  setExportEnabled(false);
  setStatus("");
}

function bootInstallHint() {
  const hint = els.installHint;
  if (!hint) return;

  const dismissed = localStorage.getItem("maclips.installHint") === "1";
  const env = readPhoneEnv(window);
  if (!shouldShowInstallHint(env, { dismissed })) return;

  let deferredPrompt = null;
  const paint = (canPrompt) => {
    const mode = installHintMode({ ua: env.ua, canPrompt });
    if (mode === "hidden") {
      hint.hidden = true;
      return;
    }
    els.installCopy.textContent = installHintText(mode);
    els.installBtn.hidden = !showInstallAction(mode);
    hint.hidden = false;
  };

  paint(false);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    paint(true);
  });
  window.addEventListener("appinstalled", () => {
    hint.hidden = true;
    localStorage.setItem("maclips.installHint", "1");
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    hint.hidden = true;
    localStorage.setItem("maclips.installHint", "1");
  });
  els.installDismiss.addEventListener("click", () => {
    hint.hidden = true;
    localStorage.setItem("maclips.installHint", "1");
  });
}

function watchKeyboard() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const sync = () => {
    const covered = window.innerHeight - viewport.height > 120;
    els.dock.classList.toggle("tucked", covered);
    document.body.classList.toggle("keyboard-open", covered);
  };
  viewport.addEventListener("resize", sync);
  viewport.addEventListener("scroll", sync);
}

function setSaveLabel(text) {
  els.exportBtn.textContent = text;
  els.exportDock.textContent = text;
}

function offerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
  state.downloadUrl = url;
  [els.downloadLink, els.downloadDock].forEach((link) => {
    if (!link) return;
    link.href = url;
    link.download = name;
    link.hidden = false;
    link.textContent = "Download";
  });
}

function hideDownload() {
  if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
  state.downloadUrl = null;
  [els.downloadLink, els.downloadDock].forEach((link) => {
    if (!link) return;
    link.hidden = true;
    link.removeAttribute("href");
  });
}

function setExportEnabled(on) {
  els.exportBtn.disabled = !on || state.busy;
  els.exportDock.disabled = !on || state.busy;
}

function setStatus(text) {
  els.status.textContent = text;
}

function setPickerStatus(text) {
  if (els.pickerStatus) els.pickerStatus.textContent = text;
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
