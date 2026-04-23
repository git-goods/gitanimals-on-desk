"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const TOKEN_FILE = "gitanimals-token.json";
const LEGACY_FILE = "gitanimals-token.enc";
let _tokenPath = null;
let _legacyPath = null;

function _getPath() {
  if (!_tokenPath) {
    const { app } = require("electron");
    const dir = app.getPath("userData");
    _tokenPath = path.join(dir, TOKEN_FILE);
    _legacyPath = path.join(dir, LEGACY_FILE);
  }
  return _tokenPath;
}

function _deriveKey() {
  const { app } = require("electron");
  const seed = [os.hostname(), os.userInfo().username, app.getPath("userData")].join(":");
  return crypto.createHash("sha256").update(seed).digest();
}

function get() {
  try {
    const p = _getPath();
    if (!fs.existsSync(p)) return null;
    const { iv, tag, data } = JSON.parse(fs.readFileSync(p, "utf8"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", _deriveKey(), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return decipher.update(data, "hex", "utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}

function set(token) {
  if (!token || typeof token !== "string") throw new TypeError("token must be a non-empty string");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", _deriveKey(), iv);
  const data = cipher.update(token, "utf8", "hex") + cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  fs.writeFileSync(_getPath(), JSON.stringify({ iv: iv.toString("hex"), tag, data }), "utf8");
}

function clear() {
  try {
    const p = _getPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    if (_legacyPath && fs.existsSync(_legacyPath)) fs.unlinkSync(_legacyPath);
  } catch {}
}

module.exports = { get, set, clear };
