"use strict";

function createSettingsRuntime({
  app,
  isLinux,
  loginItemHelpers,
  settingsController,
  getLaunchScriptPath,
  getWin,
  getCurrentSize,
  mini,
} = {}) {
  if (!app) throw new TypeError("createSettingsRuntime: app is required");
  if (!loginItemHelpers) {
    throw new TypeError("createSettingsRuntime: loginItemHelpers is required");
  }
  if (!settingsController) {
    throw new TypeError("createSettingsRuntime: settingsController is required");
  }
  if (typeof getWin !== "function") {
    throw new TypeError("createSettingsRuntime: getWin is required");
  }
  if (typeof getCurrentSize !== "function") {
    throw new TypeError("createSettingsRuntime: getCurrentSize is required");
  }
  if (!mini) throw new TypeError("createSettingsRuntime: mini is required");

  function writeSystemOpenAtLogin(enabled) {
    if (isLinux) {
      const launchScript = getLaunchScriptPath();
      const execCmd = app.isPackaged
        ? `"${process.env.APPIMAGE || app.getPath("exe")}"`
        : `node "${launchScript}"`;
      loginItemHelpers.linuxSetOpenAtLogin(enabled, { execCmd });
      return;
    }
    app.setLoginItemSettings(
      loginItemHelpers.getLoginItemSettings({
        isPackaged: app.isPackaged,
        openAtLogin: enabled,
        execPath: process.execPath,
        appPath: app.getAppPath(),
      })
    );
  }

  function readSystemOpenAtLogin() {
    if (isLinux) return loginItemHelpers.linuxGetOpenAtLogin();
    return app.getLoginItemSettings(
      app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] }
    ).openAtLogin;
  }

  function hydrateSystemBackedSettings() {
    if (settingsController.get("openAtLoginHydrated")) return;
    let systemValue = false;
    try {
      systemValue = !!readSystemOpenAtLogin();
    } catch (err) {
      console.warn(
        "GitAnimals: failed to read system openAtLogin during hydration:",
        err && err.message
      );
    }
    const result = settingsController.hydrate({
      openAtLogin: systemValue,
      openAtLoginHydrated: true,
    });
    if (result && result.status === "error") {
      console.warn("GitAnimals: openAtLogin hydration failed:", result.message);
    }
  }

  function flushRuntimeStateToPrefs() {
    const win = getWin();
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    settingsController.applyBulk({
      x: bounds.x,
      y: bounds.y,
      positionSaved: true,
      size: getCurrentSize(),
      miniMode: mini.getMiniMode(),
      miniEdge: mini.getMiniEdge(),
      preMiniX: mini.getPreMiniX(),
      preMiniY: mini.getPreMiniY(),
    });
  }

  return {
    writeSystemOpenAtLogin,
    readSystemOpenAtLogin,
    hydrateSystemBackedSettings,
    flushRuntimeStateToPrefs,
  };
}

module.exports = { createSettingsRuntime };
