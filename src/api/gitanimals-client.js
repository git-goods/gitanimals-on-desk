"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const GITANIMALS_BASE = (process.env.GITANIMALS_API_BASE_URL || "https://gitanimals.org").replace(/\/$/, "");

// Lazy-load to avoid Electron dep at module load time
let _tokenStore = null;
function _ts() {
  if (!_tokenStore) _tokenStore = require("../auth/token-store");
  return _tokenStore;
}

class UnauthorizedError extends Error {
  constructor() {
    super("401 — session expired, please log in again");
    this.name = "UnauthorizedError";
  }
}

function _request(url, token, { json = true } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error(`Invalid URL: ${url}`)); }

    const isHttps = parsed.protocol === "https:";
    const isHttp  = parsed.protocol === "http:";
    if (!isHttps && !isHttp) return reject(new Error(`Unsupported protocol: ${parsed.protocol}`));
    // Allow plain http only when the base URL is explicitly set to http (dev/mock)
    if (isHttp && !GITANIMALS_BASE.startsWith("http://")) {
      return reject(new Error(`HTTP blocked for GitAnimals API (set GITANIMALS_API_BASE_URL=http://... to opt-in): ${url}`));
    }

    const lib = isHttps ? https : http;
    const req = lib.get({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        "User-Agent": "GitAnimals-on-Desk",
        "Authorization": `Bearer ${token}`,
        "Accept": json ? "application/json" : "*/*",
      },
    }, (res) => {
      if (res.statusCode === 401) { res.resume(); return reject(new UnauthorizedError()); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}: ${url}`)); }

      const chunks = [];
      let total = 0;
      res.on("data", (c) => {
        total += c.length;
        if (total > MAX_BODY_BYTES) { res.destroy(); reject(new Error(`Response exceeds limit: ${url}`)); }
        else chunks.push(c);
      });
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (!json) return resolve(buf);
        try { resolve(JSON.parse(buf.toString("utf8"))); }
        catch { reject(new Error(`Invalid JSON from ${url}`)); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(FETCH_TIMEOUT_MS, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function _token() {
  const t = _ts().get();
  if (!t) throw new Error("Not authenticated — no token in store");
  return t;
}

/**
 * GET /users/me?filter-animation=true
 * Returns { username, personas: [{ type, name, previewUrl }] }
 */
function getMe() {
  return _request(`${GITANIMALS_BASE}/users/me?filter-animation=true`, _token());
}

/**
 * GET /assets?personaType={type}&filter-animation=true
 * Returns theme.json-compatible object with absolute SVG URLs in `states`.
 */
function getAssets(personaType) {
  const url = `${GITANIMALS_BASE}/assets?personaType=${encodeURIComponent(personaType)}&filter-animation=true`;
  return _request(url, _token());
}

/**
 * Download a binary resource (SVG, etc.) from an absolute URL.
 * Returns Buffer.
 */
function downloadBuffer(absoluteUrl) {
  return _request(absoluteUrl, _token(), { json: false });
}

module.exports = { getMe, getAssets, downloadBuffer, UnauthorizedError, GITANIMALS_BASE };
