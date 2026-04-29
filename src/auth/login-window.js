"use strict";

const { BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const EventEmitter = require("events");
const { AuthCallbackServer } = require("./callback-server");
const tokenStore = require("./token-store");

const { bc } = (() => {
  try { return require("../core/telemetry"); } catch { return { bc() {} }; }
})();

const WEB_BASE = (process.env.WEB_BASE_URL || "https://gitanimals.org").replace(/\/$/, "");

class LoginWindow extends EventEmitter {
  constructor() {
    super();
    this._win = null;
    this._cbServer = null;
    this._ipcRegistered = false;
    this._authenticated = false;
  }

  async open() {
    if (this._win && !this._win.isDestroyed()) {
      this._win.focus();
      return;
    }

    this._win = new BrowserWindow({
      width: 420,
      height: 520,
      resizable: false,
      center: true,
      title: "GitAnimals — 로그인",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "login-preload.js"),
      },
    });
    this._win.setMenuBarVisibility(false);
    this._win.on("closed", () => { this._win = null; if (!this._authenticated) this.emit("closed"); });

    if (!this._ipcRegistered) {
      ipcMain.on("auth:open-browser", () => this._openBrowser());
      this._ipcRegistered = true;
    }

    await this._win.loadFile(path.join(__dirname, "login.html"));

    try {
      await this._startCallbackServer();
    } catch (err) {
      console.warn("[login-window] callback server failed to start:", err.message);
      this._sendError("port_conflict");
    }
  }

  async _startCallbackServer() {
    if (this._cbServer) { this._cbServer.stop(); }
    this._cbServer = new AuthCallbackServer();
    await this._cbServer.start();

    this._cbServer.once("token", (token) => {
      try {
        tokenStore.set(token);
        bc("auth", "login.success");
        this._authenticated = true;
        this._closeWin();
        this.emit("authenticated", token);
      } catch (err) {
        console.error("[login-window] failed to store token:", err.message);
        bc("auth", "login.error", { kind: "token_store_failed", error: err.message });
        this._resetForRetry();
        this._sendError("token_store_failed");
      }
    });

    this._cbServer.once("error", (err) => {
      const kind = err.message.includes("state") ? "state_mismatch"
        : err.message.includes("timeout") ? "auth_timeout"
        : "server_error";
      bc("auth", "login.error", { kind, error: err.message });
      this._resetForRetry();
      this._sendError(kind);
    });
  }

  _resetForRetry() {
    if (this._cbServer) { this._cbServer.stop(); }
    this._cbServer = null;
  }

  async _openBrowser() {
    if (!this._cbServer) {
      try {
        await this._startCallbackServer();
      } catch (err) {
        bc("auth", "login.error", { kind: "port_conflict", error: err.message });
        this._sendError("port_conflict");
        return;
      }
    }
    const redirectUri = `http://127.0.0.1:${this._cbServer.port}/auth/callback`;
    const url = new URL(`${WEB_BASE}/auth/desktop`);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", this._cbServer.state);
    bc("auth", "login.start");
    shell.openExternal(url.toString());
  }

  _sendError(code) {
    if (this._win && !this._win.isDestroyed()) {
      this._win.webContents.send("auth:error", code);
    }
  }

  _closeWin() {
    if (this._win && !this._win.isDestroyed()) this._win.close();
  }

  cleanup() {
    if (this._cbServer) { this._cbServer.stop(); this._cbServer = null; }
    if (this._ipcRegistered) {
      ipcMain.removeAllListeners("auth:open-browser");
      this._ipcRegistered = false;
    }
    this._closeWin();
  }
}

module.exports = { LoginWindow };
