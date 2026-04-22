#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runtimeRoot = path.join(root, ".tsbuild", "runtime");

function requireRuntime(relPath) {
  return require(path.join(runtimeRoot, relPath));
}

function main() {
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

  console.log("TS runtime emit verification passed.");
}

main();
