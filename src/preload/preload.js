const { contextBridge, ipcRenderer } = require("electron");

// Renderer Sentry — inherits DSN/release/env from the main process client.
// Safe no-op if main process init didn't run (e.g. missing DSN).
try {
  // @sentry/electron v7 exposes `/renderer` for renderer processes; wrapping
  // in try/catch so a broken install can never break the main window.
  require("@sentry/electron/renderer").init({});
} catch (_e) { /* telemetry disabled */ }

// Parse theme config from additionalArguments (synchronous, available on first load)
const themeArg = process.argv.find(a => a.startsWith("--theme-config="));
const themeConfig = themeArg ? JSON.parse(themeArg.slice("--theme-config=".length)) : null;

contextBridge.exposeInMainWorld("themeConfig", themeConfig);

contextBridge.exposeInMainWorld("electronAPI", {
  // Theme config push (for hot-switch; additionalArguments won't update on reload)
  onThemeConfig: (cb) => ipcRenderer.on("theme-config", (_, cfg) => cb(cfg)),
  // State sync from main
  onStateChange: (callback) => ipcRenderer.on("state-change", (_, state, svg) => callback(state, svg)),
  onEyeMove: (callback) => ipcRenderer.on("eye-move", (_, dx, dy) => callback(dx, dy)),
  onWakeFromDoze: (callback) => ipcRenderer.on("wake-from-doze", () => callback()),
  onDndChange: (callback) => ipcRenderer.on("dnd-change", (_, enabled) => callback(enabled)),
  onMiniModeChange: (cb) => ipcRenderer.on("mini-mode-change", (_, enabled, edge) => cb(enabled, edge)),
  // Reaction control (from main, relayed from hit window)
  onStartDragReaction: (cb) => ipcRenderer.on("start-drag-reaction", () => cb()),
  onEndDragReaction: (cb) => ipcRenderer.on("end-drag-reaction", () => cb()),
  onPlayClickReaction: (cb) => ipcRenderer.on("play-click-reaction", (_, svg, duration) => cb(svg, duration)),
  // Sound playback (from main)
  onPlaySound: (cb) => ipcRenderer.on("play-sound", (_, name) => cb(name)),
  // Render window → main (cursor polling control during reactions)
  pauseCursorPolling: () => ipcRenderer.send("pause-cursor-polling"),
  resumeFromReaction: () => ipcRenderer.send("resume-from-reaction"),
  // Debug
  onDebugHitbox: (cb) => ipcRenderer.on("debug-hitbox", (_, enabled) => cb(enabled)),
  // Handshake: renderer signals all IPC listeners are registered
  signalReady: () => ipcRenderer.send("renderer-ready"),
  // Telemetry — renderer can flag conditions that are only observable in the
  // DOM (e.g. SVG swap-to-empty, <img>/<object> load failure). Main process
  // forwards to Sentry. Known kinds: empty-svg, window-error,
  // unhandled-rejection, asset-load-failed.
  reportDiagnostic: (payload) => ipcRenderer.send("renderer-diagnostic", payload),
});
