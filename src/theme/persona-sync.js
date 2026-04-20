"use strict";

// Persona sync — fetches the authenticated user's personas from GitAnimals API
// and caches them as theme-compatible directories under {userData}/theme-cache/.
//
// Drop-in replacement for remote-sync.js. Same public API:
//   init(userDataDir), syncAll([opts]), loadCachedPersonas(), onSyncComplete(fn)
//
// Additionally emits onUnauthorized(fn) when the token is rejected (→ relogin).

const fs   = require("fs");
const path = require("path");
const { URL } = require("url");

const PERSONA_TTL_MS  = 24 * 60 * 60 * 1000; // 24 h
const PERSONA_ID_RE   = /^[a-z0-9][a-z0-9_-]*$/;

// ── Module state ──

let themeCacheDir = null;
let _syncInFlight = false;
const _syncCompleteListeners  = [];
const _unauthorizedListeners  = [];

// ── Public API ──

function init(userDataDir) {
  if (!userDataDir) throw new Error("persona-sync.init: userDataDir required");
  themeCacheDir = path.join(userDataDir, "theme-cache");
}

function onSyncComplete(fn)  { if (typeof fn === "function") _syncCompleteListeners.push(fn); }
function onUnauthorized(fn)  { if (typeof fn === "function") _unauthorizedListeners.push(fn); }

function _notifySyncComplete() {
  for (const fn of _syncCompleteListeners) {
    try { fn(); } catch (e) { console.warn("[persona-sync] listener error:", e.message); }
  }
}
function _notifyUnauthorized() {
  for (const fn of _unauthorizedListeners) {
    try { fn(); } catch (e) { console.warn("[persona-sync] unauthorized listener error:", e.message); }
  }
}

/**
 * Read cached persona list synchronously.
 * Returns [{ id, name, personaType }] or [].
 */
function loadCachedPersonas() {
  if (!themeCacheDir) return [];
  const p = path.join(themeCacheDir, ".personas.json");
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!raw || !Array.isArray(raw.personas)) return [];
    return raw.personas.filter(_isValidPersonaEntry);
  } catch { return []; }
}

/**
 * Fire-and-forget: sync all personas from the API.
 * Re-entry protected; safe to call without awaiting.
 */
function syncAll(options = {}) {
  if (_syncInFlight) return Promise.resolve();
  _syncInFlight = true;
  return _syncAllInternal(options)
    .catch((e) => console.warn("[persona-sync] syncAll error:", e.message))
    .finally(() => { _syncInFlight = false; });
}

// ── Internal ──

async function _syncAllInternal({ force = false } = {}) {
  if (!themeCacheDir) {
    console.warn("[persona-sync] not initialized; skipping");
    return;
  }

  const { getMe, getAssets, downloadBuffer, UnauthorizedError } = require("../api/gitanimals-client");

  fs.mkdirSync(themeCacheDir, { recursive: true });

  // 1. Fetch user + persona list (or use cache)
  const metaPath = path.join(themeCacheDir, ".personas.json");
  let cachedMeta = { fetchedAt: 0, personas: [] };
  try { cachedMeta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}

  let personas = Array.isArray(cachedMeta.personas) ? cachedMeta.personas : [];

  const shouldFetchList = force || _isStale(cachedMeta.fetchedAt);
  if (shouldFetchList) {
    try {
      const me = await getMe();
      if (!me || !Array.isArray(me.personas)) throw new Error("unexpected /users/me shape");
      personas = me.personas.map(_toPersonaEntry).filter(Boolean);
      fs.writeFileSync(metaPath, JSON.stringify({ fetchedAt: Date.now(), personas }, null, 2), "utf8");
    } catch (e) {
      if (e instanceof UnauthorizedError) { _notifyUnauthorized(); return; }
      console.warn("[persona-sync] /users/me fetch failed:", e.message);
      // Fall through: try syncing with whatever is in cache
    }
  }

  // 2. Sync each persona's theme assets
  let anyUpdated = false;
  for (const p of personas.filter(_isValidPersonaEntry)) {
    try {
      const updated = await _syncPersona(p, { force, getAssets, downloadBuffer, UnauthorizedError });
      if (updated) anyUpdated = true;
    } catch (e) {
      if (e instanceof UnauthorizedError) { _notifyUnauthorized(); return; }
      console.warn(`[persona-sync] persona "${p.personaType}" sync failed:`, e.message);
    }
  }

  if (shouldFetchList || anyUpdated) _notifySyncComplete();
}

/**
 * Sync one persona's assets. Returns true if cache was written.
 */
async function _syncPersona(persona, { force, getAssets, downloadBuffer, UnauthorizedError }) {
  const themeId   = _personaThemeId(persona.personaType);
  const themeDir  = path.join(themeCacheDir, themeId);
  const assetsDir = path.join(themeDir, "assets");
  const metaPath  = path.join(themeDir, ".cache-meta.json");

  let meta = { fetchedAt: 0, files: {} };
  try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}

  if (!force && !_isStale(meta.fetchedAt)) return false;

  // 1. Fetch asset manifest from server
  const raw = await getAssets(persona.personaType);
  if (!raw || typeof raw !== "object") throw new Error("invalid /assets response");
  if (!raw.states || !raw.states.idle) throw new Error("/assets missing states.idle");

  // 2. Extract all SVG URLs
  const urlMap = _extractUrlMap(raw); // { localFilename → absoluteUrl }

  fs.mkdirSync(assetsDir, { recursive: true });

  // 3. Download SVGs (sanitize via loader)
  const { sanitizeSvg } = require("./loader");
  const newFilesMeta = { ...(meta.files || {}) };
  let allOk = true;

  // Eager: idle + sleeping first
  const eagerKeys = ["idle", "sleeping"];
  const ordered = [
    ...eagerKeys.flatMap(k => Object.entries(urlMap).filter(([fn]) => fn.startsWith(k))),
    ...Object.entries(urlMap).filter(([fn]) => !eagerKeys.some(k => fn.startsWith(k))),
  ];

  for (const [filename, svgUrl] of ordered) {
    const destPath = path.join(assetsDir, filename);
    if (!path.resolve(destPath).startsWith(path.resolve(assetsDir) + path.sep)) {
      console.warn("[persona-sync] skip out-of-bounds path:", filename);
      allOk = false;
      continue;
    }
    try {
      const buf = await downloadBuffer(svgUrl);
      fs.writeFileSync(destPath, sanitizeSvg(buf.toString("utf8")), "utf8");
      newFilesMeta[filename] = { size: buf.length };
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;
      console.warn(`[persona-sync] fetch SVG "${filename}" failed:`, e.message);
      allOk = false;
    }
  }

  // 4. Write local theme.json (URLs replaced with local filenames)
  const localTheme = _rewriteToLocal(raw, urlMap, persona);
  fs.writeFileSync(path.join(themeDir, "theme.json"), JSON.stringify(localTheme, null, 2), "utf8");

  if (allOk) {
    fs.writeFileSync(metaPath, JSON.stringify({ fetchedAt: Date.now(), files: newFilesMeta }, null, 2), "utf8");
  }
  return true;
}

/**
 * Extract { localFilename → absoluteUrl } from a theme manifest with URL values.
 * SVG entries in `states` are absolute URLs; we derive local filenames from them.
 */
function _extractUrlMap(theme) {
  const map = {};
  const addUrls = (states) => {
    if (!states) return;
    for (const [state, arr] of Object.entries(states)) {
      if (!Array.isArray(arr)) continue;
      arr.forEach((entry, i) => {
        if (typeof entry === "string" && _isUrl(entry)) {
          map[_urlToFilename(entry, state, i)] = entry;
        }
      });
    }
  };
  addUrls(theme.states);
  if (theme.miniMode) addUrls(theme.miniMode.states);

  const addFile = (r, key) => {
    if (r && typeof r.file === "string" && _isUrl(r.file)) {
      map[_urlToFilename(r.file, key, 0)] = r.file;
    }
  };
  if (theme.reactions) {
    for (const [k, r] of Object.entries(theme.reactions)) addFile(r, `reaction-${k}`);
  }
  if (Array.isArray(theme.workingTiers)) {
    theme.workingTiers.forEach((t, i) => addFile(t, `working-tier-${i}`));
  }
  if (Array.isArray(theme.jugglingTiers)) {
    theme.jugglingTiers.forEach((t, i) => addFile(t, `juggling-tier-${i}`));
  }
  return map;
}

/**
 * Rewrite a theme manifest: replace URL values with local filenames.
 * Adds `name` and `_personaType` fields for the loader / menu.
 */
function _rewriteToLocal(theme, urlMap, persona) {
  // Reverse map: URL → localFilename
  const reverseMap = Object.fromEntries(Object.entries(urlMap).map(([f, u]) => [u, f]));
  const rewrite = (val) => (typeof val === "string" && _isUrl(val)) ? (reverseMap[val] || val) : val;
  const rewriteStates = (states) => {
    if (!states) return states;
    const out = {};
    for (const [k, arr] of Object.entries(states)) {
      out[k] = Array.isArray(arr) ? arr.map(rewrite) : arr;
    }
    return out;
  };

  const out = { ...theme };
  out.name = persona.name || persona.personaType;
  out._personaType = persona.personaType;  // kept for future API calls
  out.states = rewriteStates(theme.states);
  if (theme.miniMode) out.miniMode = { ...theme.miniMode, states: rewriteStates(theme.miniMode.states) };
  if (theme.reactions) {
    out.reactions = {};
    for (const [k, r] of Object.entries(theme.reactions)) {
      out.reactions[k] = r && _isUrl(r.file) ? { ...r, file: reverseMap[r.file] || r.file } : r;
    }
  }
  if (Array.isArray(theme.workingTiers)) {
    out.workingTiers = theme.workingTiers.map((t, i) =>
      t && _isUrl(t.file) ? { ...t, file: reverseMap[t.file] || `working-tier-${i}.svg` } : t
    );
  }
  if (Array.isArray(theme.jugglingTiers)) {
    out.jugglingTiers = theme.jugglingTiers.map((t, i) =>
      t && _isUrl(t.file) ? { ...t, file: reverseMap[t.file] || `juggling-tier-${i}.svg` } : t
    );
  }
  return out;
}

// ── Helpers ──

function _isUrl(s) {
  return typeof s === "string" && (s.startsWith("https://") || s.startsWith("http://"));
}

function _urlToFilename(url, stateName, index) {
  // Prefer `emotion` query param for readable filenames; fall back to state+index
  try {
    const emotion = new URL(url).searchParams.get("emotion");
    if (emotion && /^[a-z0-9_-]+$/i.test(emotion)) {
      return index === 0 ? `${emotion}.svg` : `${emotion}-${index}.svg`;
    }
  } catch {}
  return index === 0 ? `${stateName}.svg` : `${stateName}-${index}.svg`;
}

function _personaThemeId(personaType) {
  // DESSERT_FOX → dessert_fox
  return personaType.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function _toPersonaEntry(p) {
  if (!p || typeof p.type !== "string") return null;
  return { id: _personaThemeId(p.type), name: p.name || p.type, personaType: p.type, previewUrl: p.previewUrl || null };
}

function _isValidPersonaEntry(e) {
  return e && typeof e.id === "string" && PERSONA_ID_RE.test(e.id)
    && typeof e.personaType === "string" && e.personaType.length > 0;
}

function _isStale(fetchedAt, ttlMs = PERSONA_TTL_MS) {
  return (Date.now() - (fetchedAt || 0)) >= ttlMs;
}

module.exports = { init, syncAll, loadCachedPersonas, onSyncComplete, onUnauthorized };
