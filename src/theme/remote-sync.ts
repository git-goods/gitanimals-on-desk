"use strict";

// Remote theme system — fetch registry + per-theme config/assets from HTTPS server.
// Mirrors existing theme-cache/ pattern: sanitize SVGs, pathToFileURL, .cache-meta.json.
// Fire-and-forget sync on app start; callers get notified via onSyncComplete.

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

type RegistryEntry = { id: string; name: string; version?: string };
type RegistryMeta = { fetchedAt: number; themes: RegistryEntry[] };
type FetchBuffer = (url: string) => Promise<Buffer>;

// ── Config ──

const REMOTE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB per response
const MAX_REDIRECTS = 1;
const THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

// TODO: set to real CDN URL before production release
const DEFAULT_REGISTRY_BASE_URL = "https://gitanimals-themes.example.com";

// ── Module state ──

let themeCacheDir: string | null = null; // {userData}/theme-cache/
let _syncCompleteListeners: Array<() => void> = [];
let _syncInFlight = false;
let _fetchBufferImpl: FetchBuffer = _httpsGetBuffer;

// ── Public API ──

function init(userDataDir: string): void {
  if (!userDataDir) throw new Error("remote-theme-sync.init: userDataDir required");
  themeCacheDir = path.join(userDataDir, "theme-cache");
}

function getRemoteRegistryBaseUrl() {
  return (process.env.THEME_REGISTRY_URL || DEFAULT_REGISTRY_BASE_URL).replace(/\/$/, "");
}

function onSyncComplete(fn: unknown): void {
  if (typeof fn === "function") _syncCompleteListeners.push(fn as () => void);
}

function _setFetchBufferForTests(fn: unknown): void {
  _fetchBufferImpl = typeof fn === "function" ? (fn as FetchBuffer) : _httpsGetBuffer;
}

function _notifySyncComplete() {
  for (const fn of _syncCompleteListeners) {
    try { fn(); } catch (e) { console.warn("[remote-theme-sync] listener error:", e.message); }
  }
}

/**
 * Read cached registry synchronously. Returns array of { id, name, version }.
 * Returns [] if no cache or parse error.
 */
function loadCachedRegistry(): RegistryEntry[] {
  if (!themeCacheDir) return [];
  const p = path.join(themeCacheDir, ".registry.json");
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!raw || !Array.isArray(raw.themes)) return [];
    return raw.themes.filter(_isValidRegistryEntry);
  } catch { return []; }
}

function _loadRegistryMeta(): RegistryMeta {
  if (!themeCacheDir) return { fetchedAt: 0, themes: [] };
  const p = path.join(themeCacheDir, ".registry.json");
  try { return JSON.parse(fs.readFileSync(p, "utf8")) || { fetchedAt: 0, themes: [] }; }
  catch { return { fetchedAt: 0, themes: [] }; }
}

function _isStale(fetchedAt: number, ttlMs = REMOTE_TTL_MS): boolean {
  return (Date.now() - (fetchedAt || 0)) >= ttlMs;
}

function _isValidRegistryEntry(e: any): e is RegistryEntry {
  return e && typeof e === "object"
    && typeof e.id === "string" && THEME_ID_RE.test(e.id)
    && typeof e.name === "string" && e.name.length > 0
    && e.name.length < 100;
}

/**
 * Fire-and-forget: sync registry, then each theme.
 * Safe to call without awaiting. Re-entry protected.
 */
function syncAll(options = {}): Promise<void> {
  if (_syncInFlight) return Promise.resolve();
  _syncInFlight = true;
  return _syncAllInternal(options)
    .catch((e) => console.warn("[remote-theme-sync] syncAll error:", e.message))
    .finally(() => { _syncInFlight = false; });
}

async function _syncAllInternal({ force = false } = {}): Promise<void> {
  if (!themeCacheDir) {
    console.warn("[remote-theme-sync] not initialized; skipping");
    return;
  }
  fs.mkdirSync(themeCacheDir, { recursive: true });

  // 1. Registry
  const registryMeta = _loadRegistryMeta();
  const shouldFetchRegistry = force || _isStale(registryMeta.fetchedAt);
  let themes = Array.isArray(registryMeta.themes) ? registryMeta.themes : [];

  if (shouldFetchRegistry) {
    const fresh = await _syncRegistry().catch((e) => {
      console.warn("[remote-theme-sync] registry fetch failed:", e.message);
      return null;
    });
    if (Array.isArray(fresh)) themes = fresh;
  }

  // 2. Each theme
  const base = getRemoteRegistryBaseUrl();
  let registryNotified = shouldFetchRegistry && themes.length > 0;
  if (registryNotified) _notifySyncComplete();

  for (const entry of themes.filter(_isValidRegistryEntry)) {
    const updated = await _syncTheme(entry.id, base, { force }).catch((e) => {
      console.warn(`[remote-theme-sync] theme "${entry.id}" sync failed:`, e.message);
      return false;
    });
    if (updated) _notifySyncComplete();
  }
}

/**
 * Fetch /themes/index.json and persist to .registry.json.
 * Returns array of valid entries, or throws.
 */
async function _syncRegistry(): Promise<RegistryEntry[]> {
  const base = getRemoteRegistryBaseUrl();
  const buf = await _fetchBufferImpl(`${base}/themes/index.json`);
  const raw = JSON.parse(buf.toString("utf8"));
  if (!Array.isArray(raw)) throw new Error("registry must be an array");
  const themes = raw.filter(_isValidRegistryEntry);

  const metaPath = path.join(themeCacheDir, ".registry.json");
  fs.writeFileSync(metaPath, JSON.stringify({ fetchedAt: Date.now(), themes }, null, 2), "utf8");
  return themes;
}

/**
 * Fetch /themes/<id>/theme.json + extracted SVGs. Sanitize + cache.
 * Returns true if cache was updated, false if nothing changed.
 */
async function _syncTheme(themeId: string, baseUrl: string, { force = false } = {}): Promise<boolean> {
  if (!THEME_ID_RE.test(themeId)) throw new Error(`Invalid theme id: ${themeId}`);

  const themeDir = path.join(themeCacheDir, themeId);
  const assetsDir = path.join(themeDir, "assets");
  const metaPath = path.join(themeDir, ".cache-meta.json");

  let meta = { fetchedAt: 0, files: {} };
  try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}

  if (!force && !_isStale(meta.fetchedAt)) return false; // fresh

  // 1. Fetch theme.json
  const themeJsonUrl = `${baseUrl}/themes/${themeId}/theme.json`;
  const themeBuf = await _fetchBufferImpl(themeJsonUrl);
  const themeRaw = JSON.parse(themeBuf.toString("utf8"));
  if (!themeRaw || typeof themeRaw !== "object") throw new Error("theme.json not an object");
  if (!themeRaw.states || !themeRaw.states.idle) throw new Error("theme.json missing states.idle");

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(themeDir, "theme.json"), JSON.stringify(themeRaw, null, 2), "utf8");

  // 2. Collect SVG files to fetch
  const requiredFiles = _extractThemeFileList(themeRaw);

  // 3. Fetch SVGs (sanitize via theme-loader's exported helper)
  const { sanitizeSvg } = require("./loader");
  const newFilesMeta = { ...(meta.files || {}) };
  let allOk = true;

  for (const filename of requiredFiles) {
    if (!/^[a-z0-9_.-]+\.svg$/i.test(filename)) {
      console.warn(`[remote-theme-sync] skip suspicious filename: ${filename}`);
      allOk = false;
      continue;
    }
    const destPath = path.join(assetsDir, filename);
    // Path traversal guard
    if (!path.resolve(destPath).startsWith(path.resolve(assetsDir) + path.sep)) {
      console.warn(`[remote-theme-sync] skip out-of-bounds path: ${filename}`);
      allOk = false;
      continue;
    }
    try {
      const svgUrl = `${baseUrl}/themes/${themeId}/${filename}`;
      const buf = await _fetchBufferImpl(svgUrl);
      const sanitized = sanitizeSvg(buf.toString("utf8"));
      fs.writeFileSync(destPath, sanitized, "utf8");
      newFilesMeta[filename] = { size: buf.length };
    } catch (e) {
      console.warn(`[remote-theme-sync] fetch "${themeId}/${filename}" failed:`, e.message);
      allOk = false;
    }
  }

  // 4. Update meta only on full success (→ retry on next run if partial)
  if (allOk) {
    fs.writeFileSync(metaPath, JSON.stringify({ fetchedAt: Date.now(), files: newFilesMeta }, null, 2), "utf8");
  }
  return true; // theme.json was updated even if some SVGs failed
}

// ── Helpers ──

/**
 * Collect every SVG filename referenced by a theme.
 * Searches: states, miniMode.states, reactions, workingTiers, jugglingTiers.
 */
function _extractThemeFileList(theme: Record<string, any>): string[] {
  const files = new Set<string>();
  const addFromStates = (states: Record<string, unknown> | null | undefined) => {
    if (!states) return;
    for (const arr of Object.values(states)) {
      if (Array.isArray(arr)) for (const f of arr) if (typeof f === "string") files.add(f);
    }
  };
  addFromStates(theme.states);
  if (theme.miniMode) addFromStates(theme.miniMode.states);
  if (theme.reactions) {
    for (const r of Object.values(theme.reactions as Record<string, any>)) {
      if (r && typeof r.file === "string") files.add(r.file);
    }
  }
  if (Array.isArray(theme.workingTiers)) {
    for (const t of theme.workingTiers) if (t && typeof t.file === "string") files.add(t.file);
  }
  if (Array.isArray(theme.jugglingTiers)) {
    for (const t of theme.jugglingTiers) if (t && typeof t.file === "string") files.add(t.file);
  }
  return [...files].filter((f) => f.endsWith(".svg"));
}

/**
 * HTTPS/HTTP GET returning Buffer. Promise-based. Body size capped.
 * `http://` is allowed only when THEME_REGISTRY_URL starts with it
 * (dev/mock), but plain absolute URLs passed here must match that scheme.
 */
function _httpsGetBuffer(url: string, timeoutMs = FETCH_TIMEOUT_MS, redirectsLeft = MAX_REDIRECTS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error(`Invalid URL: ${url}`)); }

    const isHttps = parsed.protocol === "https:";
    const isHttp = parsed.protocol === "http:";
    if (!isHttps && !isHttp) return reject(new Error(`Unsupported protocol: ${parsed.protocol}`));

    // Restrict plain http to dev opt-in via env var
    if (isHttp && !String(process.env.THEME_REGISTRY_URL || "").startsWith("http://")) {
      return reject(new Error(`HTTP blocked (set THEME_REGISTRY_URL=http://... to opt in): ${url}`));
    }

    const lib = isHttps ? https : http;
    const req = lib.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: { "User-Agent": "GitAnimals-on-Desk" },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error(`Too many redirects: ${url}`));
          const nextUrl = new URL(res.headers.location, url).toString();
          return resolve(_httpsGetBuffer(nextUrl, timeoutMs, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
        const chunks = [];
        let total = 0;
        res.on("data", (c) => {
          total += c.length;
          if (total > MAX_BODY_BYTES) {
            res.destroy();
            reject(new Error(`Response exceeds ${MAX_BODY_BYTES} bytes: ${url}`));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timed out: ${url}`));
    });
  });
}

// ── Internal (exported for tests) ──

module.exports = {
  init,
  getRemoteRegistryBaseUrl,
  loadCachedRegistry,
  onSyncComplete,
  syncAll,
  // exported for unit tests
  _extractThemeFileList,
  _isStale,
  _httpsGetBuffer,
  _setFetchBufferForTests,
  _syncRegistry,
  _syncTheme,
  _constants: { REMOTE_TTL_MS, THEME_ID_RE, MAX_BODY_BYTES, DEFAULT_REGISTRY_BASE_URL },
};
