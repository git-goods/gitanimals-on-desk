"use strict";

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const remoteThemeSync = require("../../src/theme/remote-sync");

// ── Test fixtures ──

const FOX_THEME_JSON = {
  schemaVersion: 1,
  name: "Dessert Fox",
  version: "1.0.0",
  viewBox: { x: -15, y: -25, width: 45, height: 45 },
  states: {
    idle: ["idle-follow.svg"],
    working: ["typing.svg"],
    thinking: ["thinking.svg"],
    sleeping: ["idle-follow.svg"],
    waking: ["idle-follow.svg"],
  },
};

const MINI_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
const MALICIOUS_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';

// ── Test HTTP server ──

function startServer(routes) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const handler = routes[req.url];
      if (!handler) {
        res.writeHead(404);
        res.end();
        return;
      }
      handler(req, res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function stopServer(s) {
  return new Promise((resolve) => s && s.close(resolve));
}

function makeTempUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "gitanimals-remote-sync-"));
}

// ── Tests ──

describe("remote-theme-sync._extractThemeFileList", () => {
  it("collects SVGs from states, miniMode.states, reactions, tiers", () => {
    const theme = {
      states: { idle: ["idle.svg"], working: ["typing.svg", "building.svg"] },
      miniMode: { states: { "mini-idle": ["mini-idle.svg"] } },
      reactions: { drag: { file: "drag.svg" }, bad: null, noFile: {} },
      workingTiers: [{ file: "tier1.svg" }, null, { file: "tier2.svg" }],
      jugglingTiers: [{ file: "juggle.svg" }],
    };
    const files = remoteThemeSync._extractThemeFileList(theme);
    assert.deepStrictEqual(
      [...files].sort(),
      ["building.svg", "drag.svg", "idle.svg", "juggle.svg", "mini-idle.svg", "tier1.svg", "tier2.svg", "typing.svg"].sort()
    );
  });

  it("filters non-svg entries", () => {
    const theme = { states: { idle: ["foo.png", "bar.svg", null, 42] } };
    const files = remoteThemeSync._extractThemeFileList(theme);
    assert.deepStrictEqual(files, ["bar.svg"]);
  });

  it("returns empty for empty theme", () => {
    assert.deepStrictEqual(remoteThemeSync._extractThemeFileList({}), []);
  });
});

describe("remote-theme-sync._isStale", () => {
  const { REMOTE_TTL_MS } = remoteThemeSync._constants;
  it("treats fetchedAt=0 as stale", () => {
    assert.strictEqual(remoteThemeSync._isStale(0), true);
  });
  it("returns false when within TTL", () => {
    assert.strictEqual(remoteThemeSync._isStale(Date.now() - 1000), false);
  });
  it("returns true when past TTL", () => {
    assert.strictEqual(remoteThemeSync._isStale(Date.now() - REMOTE_TTL_MS - 1000), true);
  });
});

describe("remote-theme-sync syncAll (live localhost)", () => {
  let envSaved;
  let tmp;
  let server;

  before(() => {
    envSaved = process.env.THEME_REGISTRY_URL;
  });
  after(() => {
    process.env.THEME_REGISTRY_URL = envSaved || "";
  });

  beforeEach(() => {
    tmp = makeTempUserData();
  });

  async function runSync(routes) {
    const started = await startServer(routes);
    server = started.server;
    process.env.THEME_REGISTRY_URL = started.url;
    remoteThemeSync.init(tmp);
    await remoteThemeSync.syncAll();
    await stopServer(server);
    server = null;
  }

  it("fetches registry + theme + SVGs, writes to cache", async () => {
    await runSync({
      "/themes/index.json": (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([{ id: "dessert-fox", name: "Dessert Fox", version: "1.0.0" }]));
      },
      "/themes/dessert-fox/theme.json": (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(FOX_THEME_JSON));
      },
      "/themes/dessert-fox/idle-follow.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
      "/themes/dessert-fox/typing.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
      "/themes/dessert-fox/thinking.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
    });

    // Registry
    const registry = remoteThemeSync.loadCachedRegistry();
    assert.strictEqual(registry.length, 1);
    assert.strictEqual(registry[0].id, "dessert-fox");

    // Theme dir layout
    const cacheDir = path.join(tmp, "theme-cache", "dessert-fox");
    assert.ok(fs.existsSync(path.join(cacheDir, "theme.json")));
    assert.ok(fs.existsSync(path.join(cacheDir, "assets", "idle-follow.svg")));
    assert.ok(fs.existsSync(path.join(cacheDir, "assets", "typing.svg")));

    // Meta
    const meta = JSON.parse(fs.readFileSync(path.join(cacheDir, ".cache-meta.json"), "utf8"));
    assert.ok(meta.fetchedAt > 0);
    assert.ok(meta.files["idle-follow.svg"]);
  });

  it("sanitizes malicious SVG content", async () => {
    await runSync({
      "/themes/index.json": (_req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify([{ id: "evil-theme", name: "Evil", version: "1.0.0" }]));
      },
      "/themes/evil-theme/theme.json": (_req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify({ ...FOX_THEME_JSON, states: { idle: ["idle-follow.svg"], working: ["typing.svg"], thinking: ["thinking.svg"], sleeping: ["idle-follow.svg"], waking: ["idle-follow.svg"] } }));
      },
      "/themes/evil-theme/idle-follow.svg": (_req, res) => { res.writeHead(200); res.end(MALICIOUS_SVG); },
      "/themes/evil-theme/typing.svg": (_req, res) => { res.writeHead(200); res.end(MALICIOUS_SVG); },
      "/themes/evil-theme/thinking.svg": (_req, res) => { res.writeHead(200); res.end(MALICIOUS_SVG); },
    });

    const cached = fs.readFileSync(path.join(tmp, "theme-cache", "evil-theme", "assets", "idle-follow.svg"), "utf8");
    assert.ok(!cached.toLowerCase().includes("<script"), "script tag should be stripped");
    assert.ok(cached.includes("<rect"), "rect preserved");
  });

  it("rejects invalid theme ids from registry", async () => {
    await runSync({
      "/themes/index.json": (_req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify([
          { id: "../evil", name: "Evil", version: "1.0" },
          { id: "has spaces", name: "Bad", version: "1.0" },
          { id: "ok-one", name: "OK", version: "1.0" },
        ]));
      },
      "/themes/ok-one/theme.json": (_req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify(FOX_THEME_JSON));
      },
      "/themes/ok-one/idle-follow.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
      "/themes/ok-one/typing.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
      "/themes/ok-one/thinking.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
    });

    const registry = remoteThemeSync.loadCachedRegistry();
    assert.strictEqual(registry.length, 1);
    assert.strictEqual(registry[0].id, "ok-one");
    // No ../ dir created
    assert.strictEqual(fs.existsSync(path.join(tmp, "theme-cache", "..")), true); // normal parent
    assert.strictEqual(fs.existsSync(path.join(tmp, "evil")), false);
  });

  it("skips refetch when cache is fresh (TTL)", async () => {
    let requests = 0;
    const routes = {
      "/themes/index.json": (_req, res) => { requests++; res.writeHead(200); res.end(JSON.stringify([{ id: "dessert-fox", name: "Dessert Fox", version: "1.0.0" }])); },
      "/themes/dessert-fox/theme.json": (_req, res) => { requests++; res.writeHead(200); res.end(JSON.stringify(FOX_THEME_JSON)); },
      "/themes/dessert-fox/idle-follow.svg": (_req, res) => { requests++; res.writeHead(200); res.end(MINI_SVG); },
      "/themes/dessert-fox/typing.svg": (_req, res) => { requests++; res.writeHead(200); res.end(MINI_SVG); },
      "/themes/dessert-fox/thinking.svg": (_req, res) => { requests++; res.writeHead(200); res.end(MINI_SVG); },
    };

    // First sync
    await runSync(routes);
    const firstRequests = requests;
    assert.ok(firstRequests > 0);

    // Second sync — cache fresh → no network
    requests = 0;
    await runSync(routes);
    assert.strictEqual(requests, 0);
  });

  it("preserves cache when server is unreachable (offline scenario)", async () => {
    // First successful sync
    await runSync({
      "/themes/index.json": (_req, res) => { res.writeHead(200); res.end(JSON.stringify([{ id: "dessert-fox", name: "Dessert Fox", version: "1.0.0" }])); },
      "/themes/dessert-fox/theme.json": (_req, res) => { res.writeHead(200); res.end(JSON.stringify(FOX_THEME_JSON)); },
      "/themes/dessert-fox/idle-follow.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
      "/themes/dessert-fox/typing.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
      "/themes/dessert-fox/thinking.svg": (_req, res) => { res.writeHead(200); res.end(MINI_SVG); },
    });

    // Expire TTL + point to unreachable URL
    const regPath = path.join(tmp, "theme-cache", ".registry.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
    reg.fetchedAt = 0;
    fs.writeFileSync(regPath, JSON.stringify(reg));
    const metaPath = path.join(tmp, "theme-cache", "dessert-fox", ".cache-meta.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    meta.fetchedAt = 0;
    fs.writeFileSync(metaPath, JSON.stringify(meta));

    process.env.THEME_REGISTRY_URL = "http://127.0.0.1:1"; // unreachable
    remoteThemeSync.init(tmp);
    await remoteThemeSync.syncAll();

    // Cache still intact
    assert.ok(fs.existsSync(path.join(tmp, "theme-cache", "dessert-fox", "theme.json")));
    assert.ok(fs.existsSync(path.join(tmp, "theme-cache", "dessert-fox", "assets", "idle-follow.svg")));
  });

  it("blocks http:// when THEME_REGISTRY_URL is not http://", async () => {
    process.env.THEME_REGISTRY_URL = ""; // fall back to default https
    await assert.rejects(
      remoteThemeSync._httpsGetBuffer("http://127.0.0.1:1/foo"),
      /HTTP blocked/
    );
  });
});
