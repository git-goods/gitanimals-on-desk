"use strict";

const fs = require("fs");
const path = require("path");

const TOKEN_FILE = "gitanimals-token.enc";
let _tokenPath = null;

function _getPath() {
  if (!_tokenPath) {
    const { app } = require("electron");
    _tokenPath = path.join(app.getPath("userData"), TOKEN_FILE);
  }
  return _tokenPath;
}

function _safeStorage() {
  return require("electron").safeStorage;
}

function get() {
  try {
    const ss = _safeStorage();
    if (!ss.isEncryptionAvailable()) return null;
    const p = _getPath();
    if (!fs.existsSync(p)) return null;
    return ss.decryptString(fs.readFileSync(p));
  } catch {
    return null;
  }
}

function set(token) {
  if (!token || typeof token !== "string") throw new TypeError("token must be a non-empty string");
  const ss = _safeStorage();
  if (!ss.isEncryptionAvailable()) throw new Error("safeStorage not available on this platform");
  fs.writeFileSync(_getPath(), ss.encryptString(token));
}

function clear() {
  try {
    const p = _getPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

module.exports = { get, set, clear };
