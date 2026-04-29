"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");

const { bc } = (() => {
  try { return require("../core/telemetry"); } catch { return { bc() {} }; }
})();

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// Identity ("API") server — prod by default, overridable for local Identity dev.
const API_BASE_URL    = (process.env.API_BASE_URL    || "https://api.gitanimals.org").replace(/\/$/, "");

// Render server — prod by default, overridable for local render dev.
const RENDER_BASE_URL = (process.env.RENDER_BASE_URL || "https://render.gitanimals.org").replace(/\/$/, "");

// HTTP is allowed only when at least one base explicitly opted in via http://.
const _ALLOW_HTTP = API_BASE_URL.startsWith("http://") || RENDER_BASE_URL.startsWith("http://");

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

function _request(url, token, opts = {}) {
  const { json = true, redirectsLeft = MAX_REDIRECTS, originHost = null } = opts;
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error(`Invalid URL: ${url}`)); }

    const isHttps = parsed.protocol === "https:";
    const isHttp  = parsed.protocol === "http:";
    if (!isHttps && !isHttp) return reject(new Error(`Unsupported protocol: ${parsed.protocol}`));
    // Allow plain http only when the base URL is explicitly set to http (dev/mock).
    // Also blocks https→http downgrades on redirect.
    if (isHttp && !_ALLOW_HTTP) {
      return reject(new Error(`HTTP blocked for GitAnimals API (set API_BASE_URL=http://... or RENDER_BASE_URL=http://... to opt-in): ${url}`));
    }

    const startHost = originHost || parsed.host;
    const sameOrigin = parsed.host === startHost;

    const headers = {
      "User-Agent": "GitAnimals-on-Desk",
      "Accept": json ? "application/json" : "*/*",
    };
    // Only forward the bearer to the original host. Drop on cross-host
    // redirect (e.g. CDN/S3) so we don't leak credentials.
    if (token && sameOrigin) headers["Authorization"] = `Bearer ${token}`;

    const lib = isHttps ? https : http;
    const req = lib.get({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers,
    }, (res) => {
      const status = res.statusCode;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error(`Too many redirects: ${url}`));
        let nextUrl;
        try { nextUrl = new URL(res.headers.location, url).toString(); }
        catch { return reject(new Error(`Invalid redirect Location from ${url}: ${res.headers.location}`)); }
        return resolve(_request(nextUrl, token, { json, redirectsLeft: redirectsLeft - 1, originHost: startHost }));
      }
      if (status === 401) {
        bc("auth", "api.401", { endpoint: parsed.pathname });
        res.resume(); return reject(new UnauthorizedError());
      }
      if (status !== 200) { res.resume(); return reject(new Error(`HTTP ${status}: ${url}`)); }

      const chunks = [];
      let total = 0;
      res.on("data", (c) => {
        total += c.length;
        if (total > MAX_BODY_BYTES) { res.destroy(); reject(new Error(`Response exceeds limit: ${url}`)); }
        else chunks.push(c);
      });
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (!json) {
          console.log(`[gitanimals-api] ${status} ${url} — ${buf.length} bytes`);
          return resolve(buf);
        }
        const text = buf.toString("utf8");
        let body;
        try { body = JSON.parse(text); }
        catch { return reject(new Error(`Invalid JSON from ${url}`)); }
        console.log(`[gitanimals-api] ${status} ${url}`, body);
        resolve(body);
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
 * GET {API_BASE_URL}/users — Identity server, token-based self lookup.
 * Returns { username, ... } (client only reads `username`).
 */
function getUser() {
  return _request(`${API_BASE_URL}/users`, _token());
}

/**
 * GET {RENDER_BASE_URL}/users/{username}?filter-animation=true
 * Returns { username, personas: [{ type, name, previewUrl }] }
 */
function getUserPersonas(username) {
  if (!username || typeof username !== "string") throw new TypeError("username required");
  const url = `${RENDER_BASE_URL}/users/${encodeURIComponent(username)}?filter-animation=true`;
  return _request(url, _token());
}

/**
 * GET {RENDER_BASE_URL}/assets?personaType={type}&filter-animation=true
 * Returns theme.json-compatible object with absolute SVG URLs in `states`.
 */
function getAssets(personaType) {
  const url = `${RENDER_BASE_URL}/assets?personaType=${encodeURIComponent(personaType)}&filter-animation=true`;
  return _request(url, _token());
}

/**
 * Download a binary resource (SVG, etc.) from an absolute URL.
 * Returns Buffer.
 */
function downloadBuffer(absoluteUrl) {
  return _request(absoluteUrl, _token(), { json: false });
}

module.exports = { getUser, getUserPersonas, getAssets, downloadBuffer, UnauthorizedError, API_BASE_URL, RENDER_BASE_URL };
