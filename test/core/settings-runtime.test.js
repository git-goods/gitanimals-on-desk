"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { createSettingsRuntime } = require("../../src/core/settings-runtime");

function createHarness(overrides = {}) {
  const calls = {
    linuxSetOpenAtLogin: [],
    setLoginItemSettings: [],
    getLoginItemSettings: [],
    hydrate: [],
    applyBulk: [],
  };

  const app = overrides.app || {
    isPackaged: false,
    getPath(name) {
      if (name === "exe") return "/Applications/GitAnimals.app";
      throw new Error(`unexpected getPath(${name})`);
    },
    getAppPath() {
      return "/workspace/clawd-on-desk";
    },
    setLoginItemSettings(value) {
      calls.setLoginItemSettings.push(value);
    },
    getLoginItemSettings(arg) {
      calls.getLoginItemSettings.push(arg);
      return { openAtLogin: true };
    },
  };

  let hydrated = false;
  const settingsController = overrides.settingsController || {
    get(key) {
      if (key === "openAtLoginHydrated") return hydrated;
      return undefined;
    },
    hydrate(value) {
      calls.hydrate.push(value);
      hydrated = Boolean(value && value.openAtLoginHydrated);
      return { status: "ok" };
    },
    applyBulk(value) {
      calls.applyBulk.push(value);
      return { status: "ok" };
    },
  };

  const loginItemHelpers = overrides.loginItemHelpers || {
    linuxSetOpenAtLogin(enabled, options) {
      calls.linuxSetOpenAtLogin.push({ enabled, options });
    },
    linuxGetOpenAtLogin() {
      return false;
    },
    getLoginItemSettings(options) {
      return { wrapped: options };
    },
  };

  const win = overrides.win || {
    isDestroyed() {
      return false;
    },
    getBounds() {
      return { x: 11, y: 22, width: 333, height: 444 };
    },
  };

  const mini = overrides.mini || {
    getMiniMode() {
      return true;
    },
    getMiniEdge() {
      return "left";
    },
    getPreMiniX() {
      return 101;
    },
    getPreMiniY() {
      return 202;
    },
  };

  const runtime = createSettingsRuntime({
    app,
    isLinux: overrides.isLinux || false,
    loginItemHelpers,
    settingsController,
    getLaunchScriptPath: overrides.getLaunchScriptPath || (() => "/workspace/clawd-on-desk/launch.js"),
    getWin: overrides.getWin || (() => win),
    getCurrentSize: overrides.getCurrentSize || (() => "P:10"),
    mini,
  });

  return { runtime, calls };
}

describe("createSettingsRuntime", () => {
  it("writes Linux open-at-login via the launch script in development", () => {
    const { runtime, calls } = createHarness({ isLinux: true });

    runtime.writeSystemOpenAtLogin(true);

    assert.deepStrictEqual(calls.linuxSetOpenAtLogin, [
      {
        enabled: true,
        options: { execCmd: 'node "/workspace/clawd-on-desk/launch.js"' },
      },
    ]);
    assert.strictEqual(calls.setLoginItemSettings.length, 0);
  });

  it("reads non-Linux open-at-login from Electron login item settings", () => {
    const { runtime, calls } = createHarness();

    const enabled = runtime.readSystemOpenAtLogin();

    assert.strictEqual(enabled, true);
    assert.deepStrictEqual(calls.getLoginItemSettings, [
      { path: process.execPath, args: ["/workspace/clawd-on-desk"] },
    ]);
  });

  it("hydrates open-at-login only once", () => {
    const { runtime, calls } = createHarness();

    runtime.hydrateSystemBackedSettings();
    runtime.hydrateSystemBackedSettings();

    assert.strictEqual(calls.hydrate.length, 1);
    assert.deepStrictEqual(calls.hydrate[0], {
      openAtLogin: true,
      openAtLoginHydrated: true,
    });
  });

  it("logs hydration failures returned by the settings controller", () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      const { runtime } = createHarness({
        settingsController: {
          get(key) {
            return key === "openAtLoginHydrated" ? false : undefined;
          },
          hydrate() {
            return { status: "error", message: "persist failed" };
          },
          applyBulk() {
            return { status: "ok" };
          },
        },
      });

      runtime.hydrateSystemBackedSettings();
    } finally {
      console.warn = originalWarn;
    }

    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /openAtLogin hydration failed/);
    assert.match(warnings[0], /persist failed/);
  });

  it("skips runtime flush when the window is missing or destroyed", () => {
    const { runtime, calls } = createHarness({
      getWin: () => null,
    });

    runtime.flushRuntimeStateToPrefs();

    assert.strictEqual(calls.applyBulk.length, 0);
  });

  it("flushes runtime bounds and mini-mode metadata to settings", () => {
    const { runtime, calls } = createHarness();

    runtime.flushRuntimeStateToPrefs();

    assert.deepStrictEqual(calls.applyBulk, [
      {
        x: 11,
        y: 22,
        positionSaved: true,
        size: "P:10",
        miniMode: true,
        miniEdge: "left",
        preMiniX: 101,
        preMiniY: 202,
      },
    ]);
  });
});
