"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gitAnimals", {
  openBrowser: () => ipcRenderer.send("auth:open-browser"),
  onError: (fn) => ipcRenderer.on("auth:error", (_e, code) => fn(code)),
});
