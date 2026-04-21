#!/usr/bin/env node
"use strict";

/**
 * Theme Preview Server — local dev tool for previewing all themes in browser.
 * Reuses theme-loader.js for consistent theme discovery + config generation.
 *
 * Usage: node scripts/preview-server.js
 *        npm run preview
 *
 * Opens http://localhost:8080 with all themes rendered identically to desktop.
 * File watcher on theme.json auto-reloads browser on save.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 8080;
const ROOT = path.join(__dirname, "..");
const PREVIEW_DIR = path.join(__dirname, "preview");
const THEMES_DIR = path.join(ROOT, "themes");

// Reuse theme-loader
const themeLoader = require(path.join(ROOT, "src", "theme", "loader"));
themeLoader.init(path.join(ROOT, "src"), null);

// SSE clients for hot-reload
const sseClients = new Set();

// MIME types
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".apng": "image/apng",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, data) {
  const body = JSON.stringify(data);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(body);
}

function send404(res, msg) {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end(msg || "Not found");
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
    res.end(content);
  } catch {
    send404(res, `File not found: ${filePath}`);
  }
}

// ── API routes ──

function handleApi(req, res, urlPath) {
  // GET /api/themes — list all themes
  if (urlPath === "/api/themes") {
    const themes = themeLoader.discoverThemes();
    sendJson(res, themes);
    return true;
  }

  // GET /api/themes/:id/config — load theme and return renderer config
  const configMatch = urlPath.match(/^\/api\/themes\/([^/]+)\/config$/);
  if (configMatch) {
    const themeId = decodeURIComponent(configMatch[1]);
    try {
      const theme = themeLoader.loadTheme(themeId);
      const config = themeLoader.getRendererConfig();
      // Override assetsPath to use our server's asset endpoint
      const themeDirName = path.basename(themeLoader.getActiveTheme()._themeDir);
      config.assetsPath = `/assets/${themeDirName}`;
      config.sourceAssetsPath = `/assets/${themeDirName}`;
      // Add states + miniMode for preview (not in normal renderer config)
      config.states = theme.states;
      config.miniMode = theme.miniMode;
      sendJson(res, config);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/watch — SSE stream for file changes
  if (urlPath === "/api/watch") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("data: connected\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return true;
  }

  return false;
}

// ── Asset serving ──

function handleAssets(res, urlPath) {
  // /assets/:themeDir/:file
  const match = urlPath.match(/^\/assets\/([^/]+)\/(.+)$/);
  if (!match) return false;

  const themeDir = decodeURIComponent(match[1]);
  const file = path.basename(decodeURIComponent(match[2])); // basename for safety

  // Try theme's own assets dir first
  const themeAssetPath = path.join(THEMES_DIR, themeDir, "assets", file);
  if (fs.existsSync(themeAssetPath)) {
    serveStatic(res, themeAssetPath);
    return true;
  }

  // Fallback to shared assets/svg/
  const sharedPath = path.join(ROOT, "assets", "svg", file);
  if (fs.existsSync(sharedPath)) {
    serveStatic(res, sharedPath);
    return true;
  }

  send404(res, `Asset not found: ${themeDir}/${file}`);
  return true;
}

// ── Static file serving (preview UI) ──

function handleStatic(res, urlPath) {
  if (urlPath === "/" || urlPath === "/index.html") {
    serveStatic(res, path.join(PREVIEW_DIR, "index.html"));
    return true;
  }

  // Serve files from preview/ directory
  const safePath = path.basename(urlPath);
  const filePath = path.join(PREVIEW_DIR, safePath);
  if (fs.existsSync(filePath)) {
    serveStatic(res, filePath);
    return true;
  }

  return false;
}

// ── HTTP server ──

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;

  if (handleApi(req, res, urlPath)) return;
  if (handleAssets(res, urlPath)) return;
  if (handleStatic(res, urlPath)) return;
  send404(res);
});

// ── File watcher for hot-reload ──

function broadcastChange(themeDir) {
  const msg = `data: ${JSON.stringify({ type: "theme-changed", theme: themeDir })}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

// Watch all theme directories for theme.json changes
try {
  for (const entry of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const themeJsonPath = path.join(THEMES_DIR, entry.name, "theme.json");
    if (!fs.existsSync(themeJsonPath)) continue;

    // Watch the entire theme directory (catches theme.json + asset changes)
    const watchDir = path.join(THEMES_DIR, entry.name);
    try {
      fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        broadcastChange(entry.name);
      });
    } catch { /* fs.watch not supported on all platforms for recursive */ }
  }
} catch { /* themes dir doesn't exist */ }

// ── Start ──

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Theme Preview: ${url}\n`);
  console.log("  Watching theme directories for changes...\n");

  // Auto-open browser
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} ${url}`);
});
