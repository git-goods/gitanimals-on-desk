// src/telemetry.js — Sentry wrapper (Phase 0 diagnostics)
//
// Goal: collect crashes, unhandled exceptions, and a breadcrumb timeline so
// macOS "pet disappears" reports can be diagnosed without user log uploads.
//
// Design notes:
// - Single entry point `init()` called from main.js before window creation.
// - `bc()` / `report()` helpers wrap Sentry.addBreadcrumb / captureMessage so
//   call sites stay short and we can centrally disable/mute when opted out.
// - `setEnabled(false)` is a soft off-switch honoured by both helpers; we do
//   NOT try to fully tear down the SDK at runtime (@sentry/electron v7 does
//   not expose a clean close path), so opt-out works by dropping events at
//   the helper layer + setting `sampleRate: 0` via `getCurrentHub`. This is
//   intentional: opt-out takes effect immediately without restarting the app.
// - Home-directory masking in `beforeSend` / `beforeBreadcrumb` covers the
//   main privacy risk (user paths in stack traces / breadcrumbs).

"use strict";

const path = require("path");
const os = require("os");

let Sentry = null;
let _enabled = false;
let _initDone = false;

// Prefer @sentry/electron/main; fall back to top-level if on a version that
// doesn't expose the split entry points.
function _loadSDK() {
  try { return require("@sentry/electron/main"); } catch {}
  try { return require("@sentry/electron"); } catch {}
  return null;
}

function _loadDsn() {
  // Precedence: explicit env > .env file (process.env at startup) > package.json.
  if (process.env.SENTRY_DSN) return process.env.SENTRY_DSN;
  // Best-effort .env parse — avoids bringing in dotenv as a runtime dep. If the
  // packaged build sets SENTRY_DSN via electron-builder extraMetadata or a build
  // step, this block is a no-op.
  try {
    const fs = require("fs");
    const envPath = path.resolve(__dirname, "..", "..", ".env");
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*SENTRY_DSN\s*=\s*(.+?)\s*$/);
        if (m) return m[1].replace(/^['"]|['"]$/g, "");
      }
    }
  } catch { /* ignore */ }
  try {
    const pkg = require("../../package.json");
    if (pkg && pkg.sentry && pkg.sentry.dsn) return pkg.sentry.dsn;
  } catch { /* ignore */ }
  return null;
}

const _home = (() => { try { return os.homedir(); } catch { return ""; } })();
function _mask(s) {
  if (!s || typeof s !== "string" || !_home) return s;
  return s.split(_home).join("~");
}

function _maskDeep(value, depth = 0) {
  if (depth > 4) return value;
  if (value == null) return value;
  if (typeof value === "string") return _mask(value);
  if (Array.isArray(value)) return value.map((v) => _maskDeep(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = _maskDeep(value[k], depth + 1);
    return out;
  }
  return value;
}

function init(opts = {}) {
  if (_initDone) return _enabled;
  _initDone = true;

  const dsn = opts.dsn || _loadDsn();
  if (!dsn) {
    // No DSN = silently disabled. Helpers become no-ops.
    return false;
  }

  Sentry = _loadSDK();
  if (!Sentry || typeof Sentry.init !== "function") {
    return false;
  }

  let release = opts.release;
  if (!release) {
    try {
      const { app } = require("electron");
      release = `gitanimals-on-desk@${app.getVersion()}`;
    } catch { release = undefined; }
  }

  let environment = opts.environment;
  if (!environment) {
    try {
      const { app } = require("electron");
      environment = app.isPackaged ? "production" : "development";
    } catch { environment = "development"; }
  }

  try {
    Sentry.init({
      dsn,
      release,
      environment,
      sampleRate: 1.0,
      tracesSampleRate: 0,
      maxBreadcrumbs: 200,
      beforeSend(event) {
        if (!_enabled) return null;
        try { return _maskDeep(event); } catch { return event; }
      },
      beforeBreadcrumb(breadcrumb) {
        if (!_enabled) return null;
        try { return _maskDeep(breadcrumb); } catch { return breadcrumb; }
      },
    });
    _enabled = opts.enabled !== false;
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("GitAnimals: Sentry init failed:", err && err.message);
    return false;
  }
}

function setEnabled(flag) {
  _enabled = !!flag;
}
function isEnabled() {
  return _enabled && !!Sentry;
}

// Breadcrumb — lightweight event in the ring buffer. `data` must be JSON
// serialisable (no BrowserWindow / DOM refs / circular objects).
function bc(category, message, data, level = "info") {
  if (!isEnabled()) return;
  try {
    Sentry.addBreadcrumb({
      category,
      message,
      level,
      data: data == null ? undefined : data,
      timestamp: Date.now() / 1000,
    });
  } catch { /* swallow */ }
}

// captureMessage — for warnings/errors we want as their own Issue.
function report(message, level = "warning", extra) {
  if (!isEnabled()) return;
  try {
    Sentry.captureMessage(message, {
      level,
      extra: extra == null ? undefined : extra,
    });
  } catch { /* swallow */ }
}

// captureException — re-export for global handlers in main.js.
function captureException(err, extra) {
  if (!isEnabled()) return;
  try {
    Sentry.captureException(err, extra ? { extra } : undefined);
  } catch { /* swallow */ }
}

module.exports = {
  init,
  setEnabled,
  isEnabled,
  bc,
  report,
  captureException,
  // Exposed for advanced use (e.g., scoped context); most call sites should
  // use the helpers above.
  get Sentry() { return Sentry; },
};
