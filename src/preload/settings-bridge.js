"use strict";

/** @typedef {import("../types/settings-ui").SettingsAPI} SettingsAPI */
/** @typedef {import("../types/settings-ui").SettingsChangedPayload} SettingsChangedPayload */
/** @typedef {import("../types/settings-ui").SettingsTabId} SettingsTabId */

/**
 * @param {{
 *   invoke: (channel: string, payload?: unknown) => Promise<unknown>,
 *   subscribe: (channel: string, handler: (...args: unknown[]) => void) => () => void
 * }} deps
 * @returns {SettingsAPI}
 */
function createSettingsBridge({ invoke, subscribe }) {
  if (typeof invoke !== "function") {
    throw new TypeError("createSettingsBridge: invoke is required");
  }
  if (typeof subscribe !== "function") {
    throw new TypeError("createSettingsBridge: subscribe is required");
  }

  const changedListeners = new Set();
  const tabListeners = new Set();
  const sessionExpiredListeners = new Set();

  function addListener(set, cb) {
    if (typeof cb !== "function") return () => {};
    set.add(cb);
    return () => set.delete(cb);
  }

  function emitTo(set, value) {
    for (const cb of set) {
      try { cb(value); } catch (err) { console.warn("settings bridge listener threw:", err); }
    }
  }

  subscribe("settings-changed", (_event, payload) => {
    emitTo(changedListeners, /** @type {SettingsChangedPayload} */ (payload));
  });
  subscribe("settings:set-tab", (_event, tab) => {
    emitTo(tabListeners, /** @type {SettingsTabId | string} */ (tab));
  });
  subscribe("auth:session-expired", () => {
    emitTo(sessionExpiredListeners, undefined);
  });

  return {
    getSnapshot: () => /** @type {Promise<any>} */ (invoke("settings:get-snapshot")),
    update: (key, value) => /** @type {Promise<any>} */ (invoke("settings:update", { key, value })),
    command: (action, payload) => /** @type {Promise<any>} */ (invoke("settings:command", { action, payload })),
    listAgents: () => /** @type {Promise<any>} */ (invoke("settings:list-agents")),
    listThemes: () => /** @type {Promise<any>} */ (invoke("settings:list-themes")),
    getUser: () => /** @type {Promise<any>} */ (invoke("settings:get-user")),
    onChanged: (cb) => addListener(changedListeners, cb),
    onSetTab: (cb) => addListener(tabListeners, cb),
    onSessionExpired: (cb) => addListener(sessionExpiredListeners, cb),
  };
}

module.exports = { createSettingsBridge };
