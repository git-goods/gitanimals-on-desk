"use strict";

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const themeLoader = require("../src/theme-loader");

const REPO_ROOT = path.join(__dirname, "..");

function makeTempUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawd-tloader-remote-"));
}

// Minimal valid theme.json for a cached-remote fixture
const MINIMAL_THEME = {
  schemaVersion: 1,
  name: "Dessert Fox (Remote)",
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

function seedCachedRemoteTheme(userData, themeId, themeJson) {
  const dir = path.join(userData, "theme-cache", themeId);
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(dir, "theme.json"), JSON.stringify(themeJson), "utf8");
  // Seed one SVG so asset dir is usable
  fs.writeFileSync(path.join(dir, "assets", "idle-follow.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>', "utf8");
  return dir;
}

describe("theme-loader: cached-remote theme discovery", () => {
  let tmp;

  beforeEach(() => {
    tmp = makeTempUserData();
    themeLoader.init(REPO_ROOT + "/src", tmp);
  });

  it("discoverThemes includes cached-remote themes with source: 'remote'", () => {
    seedCachedRemoteTheme(tmp, "dessert-fox", MINIMAL_THEME);
    const all = themeLoader.discoverThemes();
    const fox = all.find((t) => t.id === "dessert-fox");
    assert.ok(fox, "dessert-fox should be discovered");
    assert.strictEqual(fox.source, "remote");
    assert.strictEqual(fox.builtin, false);
    assert.strictEqual(fox.name, "Dessert Fox (Remote)");
  });

  it("skips dot-directories at theme-cache root (like .registry.json dir)", () => {
    const dotDir = path.join(tmp, "theme-cache", ".junk");
    fs.mkdirSync(dotDir, { recursive: true });
    fs.writeFileSync(path.join(dotDir, "theme.json"), JSON.stringify(MINIMAL_THEME), "utf8");
    const all = themeLoader.discoverThemes();
    assert.ok(!all.some((t) => t.id === ".junk"));
  });

  it("builtin themes win over cached-remote with same id", () => {
    // Seed remote theme with same id as the builtin "clawd"
    seedCachedRemoteTheme(tmp, "clawd", { ...MINIMAL_THEME, name: "Clawd (Remote Override)" });
    const all = themeLoader.discoverThemes();
    const clawd = all.find((t) => t.id === "clawd");
    assert.ok(clawd);
    assert.strictEqual(clawd.builtin, true, "builtin takes priority");
    assert.notStrictEqual(clawd.name, "Clawd (Remote Override)");
  });
});

describe("theme-loader: loadTheme cached-remote branch", () => {
  let tmp;

  beforeEach(() => {
    tmp = makeTempUserData();
    themeLoader.init(REPO_ROOT + "/src", tmp);
  });

  it("loads cached-remote theme.json + assets dir from theme-cache", () => {
    seedCachedRemoteTheme(tmp, "dessert-fox", MINIMAL_THEME);

    const theme = themeLoader.loadTheme("dessert-fox");
    assert.strictEqual(theme._id, "dessert-fox");
    assert.strictEqual(theme._source, "remote");
    assert.strictEqual(theme._builtin, false);

    // _assetsDir points to cache assets
    const expectedAssetsDir = path.join(tmp, "theme-cache", "dessert-fox", "assets");
    assert.strictEqual(theme._assetsDir, expectedAssetsDir);

    // _assetsFileUrl is a file:// URL
    assert.ok(theme._assetsFileUrl.startsWith("file://"));
    assert.ok(theme._assetsFileUrl.endsWith("/assets"));
  });

  it("falls back to clawd when requested remote theme is not cached", () => {
    const theme = themeLoader.loadTheme("nonexistent-remote");
    assert.strictEqual(theme._id, "clawd");
    assert.strictEqual(theme._builtin, true);
  });

  it("getRendererAssetsPath returns file:// URL for remote theme", () => {
    seedCachedRemoteTheme(tmp, "dessert-fox", MINIMAL_THEME);
    themeLoader.loadTheme("dessert-fox");
    const p = themeLoader.getRendererAssetsPath();
    assert.ok(p.startsWith("file://"));
    assert.ok(p.includes("theme-cache"));
    assert.ok(p.includes("dessert-fox"));
  });
});
