const { contextBridge, ipcRenderer } = require("electron");

try { require("@sentry/electron/renderer").init({}); } catch (_e) { /* telemetry disabled */ }

contextBridge.exposeInMainWorld("bubbleAPI", {
  onPermissionShow: (cb) => ipcRenderer.on("permission-show", (_, data) => cb(data)),
  decide: (behavior) => ipcRenderer.send("permission-decide", behavior),
  onPermissionHide: (cb) => ipcRenderer.on("permission-hide", () => cb()),
  reportHeight: (h) => ipcRenderer.send("bubble-height", h),
});
