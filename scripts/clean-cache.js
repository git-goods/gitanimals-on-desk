#!/usr/bin/env node
// Delete the Electron userData theme-cache directory for a clean sync test.
// Cross-platform: resolves per-OS userData path manually (Electron not available here).

const fs = require("fs");
const path = require("path");
const os = require("os");

const APP_NAME = "gitanimals-on-desk";

function userDataDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), APP_NAME);
}

const target = path.join(userDataDir(), "theme-cache");
try {
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`[clean-cache] removed ${target}`);
} catch (e) {
  console.log(`[clean-cache] skip (${e.message})`);
}
