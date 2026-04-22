"use strict";

try { require("@sentry/electron/renderer").init({}); } catch (_e) { /* telemetry disabled */ }

const { contextBridge, ipcRenderer } = require("electron");
const { createSettingsBridge } = require("./settings-bridge");

const settingsAPI = createSettingsBridge({
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  subscribe: (channel, handler) => {
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});

contextBridge.exposeInMainWorld("settingsAPI", settingsAPI);
