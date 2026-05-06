#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runtimeRoot = path.join(root, ".tsbuild", "runtime");

function requireRuntime(relPath) {
  return require(path.join(runtimeRoot, relPath));
}

function verifySettingsBridge(createSettingsBridge) {
  const subscriptions = new Map();
  const invoked = [];
  const bridge = createSettingsBridge({
    invoke(channel, payload) {
      invoked.push({ channel, payload });
      if (channel === "settings:get-snapshot") {
        return Promise.resolve({ lang: "en" });
      }
      return Promise.resolve({ status: "ok" });
    },
    subscribe(channel, handler) {
      subscriptions.set(channel, handler);
      return () => subscriptions.delete(channel);
    },
  });

  let changedPayload = null;
  let selectedTab = null;
  let sessionExpired = 0;
  const offChanged = bridge.onChanged((payload) => { changedPayload = payload; });
  const offTab = bridge.onSetTab((tab) => { selectedTab = tab; });
  const offExpired = bridge.onSessionExpired(() => { sessionExpired += 1; });

  subscriptions.get("settings-changed")(null, { changes: { lang: "ko" } });
  subscriptions.get("settings:set-tab")(null, "themes");
  subscriptions.get("auth:session-expired")();

  assert.deepStrictEqual(changedPayload, { changes: { lang: "ko" } });
  assert.strictEqual(selectedTab, "themes");
  assert.strictEqual(sessionExpired, 1);

  offChanged();
  offTab();
  offExpired();

  subscriptions.get("settings-changed")(null, { changes: { lang: "zh" } });
  subscriptions.get("settings:set-tab")(null, "agents");
  subscriptions.get("auth:session-expired")();

  assert.deepStrictEqual(changedPayload, { changes: { lang: "ko" } });
  assert.strictEqual(selectedTab, "themes");
  assert.strictEqual(sessionExpired, 1);

  return bridge.getSnapshot().then((snapshot) => {
    assert.deepStrictEqual(snapshot, { lang: "en" });
    assert.deepStrictEqual(invoked[0], { channel: "settings:get-snapshot", payload: undefined });
  });
}

function verifySettingsController({ settingsPrefs, createSettingsController }) {
  const defaults = settingsPrefs.getDefaults();
  const writes = [];
  const loginItems = [];
  const telemetry = [];

  const controller = createSettingsController({
    loadResult: {
      snapshot: defaults,
      locked: false,
    },
    prefsPath: path.join(root, ".tmp-shadow-prefs.json"),
    injectedDeps: {
      setOpenAtLogin(value) {
        loginItems.push(value);
      },
      setTelemetryEnabled(value) {
        telemetry.push(value);
      },
    },
    prefs: {
      ...settingsPrefs,
      save(filePath, snapshot) {
        writes.push({ filePath, snapshot });
      },
    },
  });

  const langResult = controller.applyUpdate("lang", "ko");
  assert.deepStrictEqual(langResult, { status: "ok" });
  assert.strictEqual(controller.get("lang"), "ko");

  const telemetryResult = controller.applyUpdate("sendDiagnostics", false);
  assert.deepStrictEqual(telemetryResult, { status: "ok" });
  assert.deepStrictEqual(telemetry, [false]);

  const loginResult = controller.applyUpdate("openAtLogin", true);
  assert.deepStrictEqual(loginResult, { status: "ok" });
  assert.deepStrictEqual(loginItems, [true]);

  const bulkResult = controller.applyBulk({
    x: 12,
    y: 24,
    positionSaved: true,
  });
  assert.deepStrictEqual(bulkResult, { status: "ok" });
  assert.strictEqual(controller.get("x"), 12);
  assert.strictEqual(controller.get("y"), 24);
  assert.strictEqual(controller.get("positionSaved"), true);
  assert.ok(writes.length >= 3);
}

function verifyStateSelectors(selectors) {
  const state = selectors.resolveDisplayStateFromSessions({
    sessions: new Map([
      ["a", { state: "working", headless: false }],
      ["b", { state: "error", headless: false }],
    ]),
    statePriority: { sleeping: 0, idle: 1, working: 3, error: 8 },
  });
  assert.strictEqual(state, "error");

  const displayHint = selectors.pickDisplayHint({
    state: "working",
    existingDisplayHint: "typing",
    incomingDisplayHint: "building",
    displayHintMap: { typing: "typing.svg", building: "building.svg" },
  });
  assert.strictEqual(displayHint, "building");
}

function verifySettingsRuntime({ createSettingsRuntime, createSettingsController, settingsPrefs }) {
  const appliedBulk = [];
  const app = {
    isPackaged: false,
    setLoginItemSettings() {},
    getLoginItemSettings() {
      return { openAtLogin: true };
    },
    getAppPath() {
      return root;
    },
  };
  const controller = createSettingsController({
    loadResult: {
      snapshot: settingsPrefs.getDefaults(),
      locked: false,
    },
    prefs: {
      ...settingsPrefs,
      save() {},
    },
  });
  const originalApplyBulk = controller.applyBulk.bind(controller);
  controller.applyBulk = (partial) => {
    appliedBulk.push(partial);
    return originalApplyBulk(partial);
  };

  const runtime = createSettingsRuntime({
    app,
    isLinux: false,
    loginItemHelpers: {
      getLoginItemSettings(options) {
        return options;
      },
      linuxSetOpenAtLogin() {},
      linuxGetOpenAtLogin() {
        return false;
      },
    },
    settingsController: controller,
    getLaunchScriptPath() {
      return path.join(root, "launch.js");
    },
    getWin() {
      return {
        isDestroyed() {
          return false;
        },
        getBounds() {
          return { x: 50, y: 80 };
        },
      };
    },
    getCurrentSize() {
      return "P:12";
    },
    mini: {
      getMiniMode() {
        return true;
      },
      getMiniEdge() {
        return "left";
      },
      getPreMiniX() {
        return 20;
      },
      getPreMiniY() {
        return 30;
      },
    },
  });

  runtime.hydrateSystemBackedSettings();
  assert.strictEqual(controller.get("openAtLogin"), true);
  assert.strictEqual(controller.get("openAtLoginHydrated"), true);

  runtime.flushRuntimeStateToPrefs();
  assert.strictEqual(appliedBulk.length, 1);
  assert.deepStrictEqual(appliedBulk[0], {
    x: 50,
    y: 80,
    positionSaved: true,
    size: "P:12",
    miniMode: true,
    miniEdge: "left",
    preMiniX: 20,
    preMiniY: 30,
  });
}

function verifyThemeLoader(themeLoader) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gitanimals-theme-shadow-"));
  const fakeSrc = path.join(tmpRoot, "fake-src");
  const themeDir = path.join(tmpRoot, "themes", "little-chick");
  const assetsDir = path.join(themeDir, "assets");
  const userData = path.join(tmpRoot, "userData");

  fs.mkdirSync(fakeSrc, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, "idle.svg"), "<svg/>\n");
  fs.writeFileSync(
    path.join(themeDir, "theme.json"),
    JSON.stringify({
      schemaVersion: 1,
      name: "little-chick",
      version: "shadow-test",
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      states: {
        idle: ["idle.svg"],
        working: ["working.svg"],
        thinking: ["thinking.svg"],
        sleeping: ["sleeping.svg"],
        waking: ["waking.svg"],
      },
    }),
    "utf8"
  );

  themeLoader.init(fakeSrc, userData);
  const theme = themeLoader.loadTheme("little-chick");
  assert.strictEqual(theme.name, "little-chick");
  assert.deepStrictEqual(theme.states.idle, ["idle.svg"]);
  assert.ok(themeLoader.sanitizeSvg('<svg><script>alert(1)</script><rect/></svg>').includes("<rect"));

  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function verifyRemoteSync(remoteSync) {
  const files = remoteSync._extractThemeFileList({
    states: { idle: ["idle.svg"], working: ["working.svg", "ignore.png"] },
    reactions: { drag: { file: "drag.svg" } },
  });
  assert.deepStrictEqual(files.sort(), ["drag.svg", "idle.svg", "working.svg"].sort());
  assert.strictEqual(remoteSync._isStale(0), true);
}

async function main() {
  const settingsBridge = requireRuntime("src/preload/settings-bridge.js");
  assert.strictEqual(typeof settingsBridge.createSettingsBridge, "function");

  const settingsPrefs = requireRuntime("src/settings/prefs.js");
  assert.strictEqual(typeof settingsPrefs.load, "function");
  assert.strictEqual(typeof settingsPrefs.save, "function");
  assert.strictEqual(typeof settingsPrefs.getDefaults, "function");

  const settingsStore = requireRuntime("src/settings/store.js");
  assert.strictEqual(typeof settingsStore.createStore, "function");

  const settingsActions = requireRuntime("src/settings/actions.js");
  assert.strictEqual(typeof settingsActions.updateRegistry, "object");
  assert.strictEqual(typeof settingsActions.commandRegistry, "object");

  const settingsController = requireRuntime("src/settings/controller.js");
  assert.strictEqual(typeof settingsController.createSettingsController, "function");

  const selectors = requireRuntime("src/core/state-selectors.js");
  assert.strictEqual(typeof selectors.resolveDisplayStateFromSessions, "function");
  assert.strictEqual(typeof selectors.pickDisplayHint, "function");

  const settingsRuntime = requireRuntime("src/core/settings-runtime.js");
  assert.strictEqual(typeof settingsRuntime.createSettingsRuntime, "function");

  const themeLoader = requireRuntime("src/theme/loader.js");
  assert.strictEqual(typeof themeLoader.init, "function");
  assert.strictEqual(typeof themeLoader.loadTheme, "function");

  const remoteSync = requireRuntime("src/theme/remote-sync.js");
  assert.strictEqual(typeof remoteSync.syncAll, "function");
  assert.strictEqual(typeof remoteSync._httpsGetBuffer, "function");

  const registry = requireRuntime("agents/registry.js");
  assert.strictEqual(typeof registry.getAllAgents, "function");
  assert.ok(Array.isArray(registry.getAllAgents()));

  const jsonUtils = requireRuntime("hooks/json-utils.js");
  assert.strictEqual(typeof jsonUtils.writeJsonAtomic, "function");

  const sharedProcess = requireRuntime("hooks/shared-process.js");
  assert.strictEqual(typeof sharedProcess.createPidResolver, "function");

  verifySettingsController({
    settingsPrefs,
    createSettingsController: settingsController.createSettingsController,
  });
  verifyStateSelectors(selectors);
  verifySettingsRuntime({
    createSettingsRuntime: settingsRuntime.createSettingsRuntime,
    createSettingsController: settingsController.createSettingsController,
    settingsPrefs,
  });
  verifyThemeLoader(themeLoader);
  verifyRemoteSync(remoteSync);

  await verifySettingsBridge(settingsBridge.createSettingsBridge);
  console.log("TS runtime emit verification passed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
