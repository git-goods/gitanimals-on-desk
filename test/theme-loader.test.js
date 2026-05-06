"use strict";

// Phase 1 regression test: a corrupt default theme (little-chick) must crash
// the app at load time rather than booting into a silent "pet disappeared"
// state. Until Phase 1 the validator errors were logged but loadTheme returned
// the bad theme anyway, which propagated all the way to applyState(svg=undefined)
// and a blank SVG.

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const themeLoader = require("../src/theme/loader");

const tempDirs = [];

function scaffoldTempTheme(fakeStateArrays) {
  // Directory layout that satisfies theme-loader.init(appDir):
  //   root/fake-src/          <- appDir (we pass this in)
  //   root/themes/little-chick/theme.json
  //   root/themes/little-chick/assets/idle.svg  (placeholder so asset resolution works)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gitanimals-theme-test-"));
  tempDirs.push(root);
  const fakeSrc = path.join(root, "fake-src");
  const themeDir = path.join(root, "themes", "little-chick");
  const assetsDir = path.join(themeDir, "assets");
  fs.mkdirSync(fakeSrc, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // A placeholder SVG so any later asset lookups that poke the filesystem
  // don't fall over before our throw is evaluated.
  fs.writeFileSync(path.join(assetsDir, "idle.svg"), "<svg/>\n");

  const themeJson = {
    schemaVersion: 1,
    name: "little-chick",
    version: "0.0.1-test",
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    // Caller decides which required-state arrays are valid vs empty.
    states: fakeStateArrays,
  };
  fs.writeFileSync(path.join(themeDir, "theme.json"), JSON.stringify(themeJson));

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

describe("loadTheme — Phase 1 strictness when default theme is corrupt", () => {
  it("throws when the built-in default theme has an empty required state array (idle)", () => {
    const { fakeSrc, userData } = scaffoldTempTheme({
      idle: [],
      working: ["w.svg"],
      thinking: ["t.svg"],
      sleeping: ["s.svg"],
      waking: ["wk.svg"],
    });
    themeLoader.init(fakeSrc, userData);

    assert.throws(
      () => themeLoader.loadTheme("little-chick"),
      /little-chick.*corrupt/i,
      "loadTheme('little-chick') must throw when default theme validation fails — no silent degraded boot"
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

    const theme = themeLoader.loadTheme("little-chick");
    assert.ok(theme && theme.states, "loadTheme must return a theme with states");
    assert.deepStrictEqual(theme.states.idle, ["idle.svg"]);
  });
});
