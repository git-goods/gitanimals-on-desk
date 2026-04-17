"use strict";

// Phase 1 regression test: a corrupt fox theme must crash the app at load
// time rather than booting into a silent "pet disappeared" state. Until
// Phase 1 the validator errors were logged but loadTheme returned the bad
// theme anyway, which propagated all the way to applyState(svg=undefined)
// and a blank SVG.

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const themeLoader = require("../../src/theme/loader");

const tempDirs = [];

function scaffoldTempTheme(fakeStateArrays) {
  // Directory layout that satisfies theme-loader.init(appDir):
  //   root/fake-src/          <- appDir (we pass this in)
  //   root/themes/fox/theme.json
  //   root/themes/fox/assets/idle.svg  (placeholder so asset resolution works)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gitanimals-theme-test-"));
  tempDirs.push(root);
  const fakeSrc = path.join(root, "fake-src");
  const foxDir = path.join(root, "themes", "fox");
  const assetsDir = path.join(foxDir, "assets");
  fs.mkdirSync(fakeSrc, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // A placeholder SVG so any later asset lookups that poke the filesystem
  // don't fall over before our throw is evaluated.
  fs.writeFileSync(path.join(assetsDir, "idle.svg"), "<svg/>\n");

  const themeJson = {
    schemaVersion: 1,
    name: "fox",
    version: "0.0.1-test",
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    // Caller decides which required-state arrays are valid vs empty.
    states: fakeStateArrays,
  };
  fs.writeFileSync(path.join(foxDir, "theme.json"), JSON.stringify(themeJson));

  // Also scaffold an empty userData so init() has somewhere to point.
  const userData = path.join(root, "userdata");
  fs.mkdirSync(userData, { recursive: true });

  return { fakeSrc, userData };
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("loadTheme — Phase 1 strictness when fox is corrupt", () => {
  it("throws when the built-in fox theme has an empty required state array (idle)", () => {
    const { fakeSrc, userData } = scaffoldTempTheme({
      idle: [],
      working: ["w.svg"],
      thinking: ["t.svg"],
      sleeping: ["s.svg"],
      waking: ["wk.svg"],
    });
    themeLoader.init(fakeSrc, userData);

    assert.throws(
      () => themeLoader.loadTheme("fox"),
      /fox.*corrupt/i,
      "loadTheme('fox') must throw when fox's validation fails — no silent degraded boot"
    );
  });

  it("loads normally when all required state arrays are non-empty", () => {
    const { fakeSrc, userData } = scaffoldTempTheme({
      idle: ["idle.svg"],
      working: ["w.svg"],
      thinking: ["t.svg"],
      sleeping: ["s.svg"],
      waking: ["wk.svg"],
    });
    themeLoader.init(fakeSrc, userData);

    const theme = themeLoader.loadTheme("fox");
    assert.ok(theme && theme.states, "loadTheme must return a theme with states");
    assert.deepStrictEqual(theme.states.idle, ["idle.svg"]);
  });
});
