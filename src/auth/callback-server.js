"use strict";

const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");
const EventEmitter = require("events");

const { bc } = (() => {
  try { return require("../core/telemetry"); } catch { return { bc() {} }; }
})();

const PORT_START = 23338;
const PORT_COUNT = 5;
const TIMEOUT_MS = 5 * 60 * 1000;

class AuthCallbackServer extends EventEmitter {
  constructor() {
    super();
    this._server = null;
    this._port = null;
    this._state = null;
    this._timer = null;
  }

  get port() { return this._port; }
  get state() { return this._state; }

  async start() {
    this._state = crypto.randomBytes(32).toString("hex");
    this._port = await this._listen();
    this._timer = setTimeout(() => {
      bc("auth", "callback.timeout", { port: this._port });
      this.emit("error", new Error("auth timeout"));
      this.stop();
    }, TIMEOUT_MS);
    return this;
  }

  stop() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._server) { try { this._server.close(); } catch {} this._server = null; }
  }

  _listen() {
    return new Promise((resolve, reject) => {
      let idx = 0;
      const tryPort = () => {
        if (idx >= PORT_COUNT) return reject(new Error("no free auth callback port in range"));
        const port = PORT_START + idx++;
        const srv = http.createServer((req, res) => this._handle(req, res));
        srv.once("error", () => setImmediate(tryPort));
        srv.listen(port, "127.0.0.1", () => {
          this._server = srv;
          resolve(port);
        });
      };
      tryPort();
    });
  }

  _respond(res, status, body, contentType = "text/plain") {
    // Connection: close forces the client to close the socket after response,
    // which lets server.close() fully shut down without waiting for keep-alive.
    res.writeHead(status, { "Content-Type": contentType, "Connection": "close" });
    res.end(body);
  }

  _handle(req, res) {
    let parsed;
    try { parsed = new URL(req.url, `http://127.0.0.1:${this._port}`); } catch {
      this._respond(res, 400, "bad request"); return;
    }

    if (parsed.pathname !== "/auth/callback") {
      this._respond(res, 404, "not found"); return;
    }

    const state = parsed.searchParams.get("state");
    const token = parsed.searchParams.get("token");

    const stateOk = state && state.length === this._state.length &&
      crypto.timingSafeEqual(Buffer.from(state), Buffer.from(this._state));
    if (!stateOk) {
      bc("auth", "callback.state_mismatch", { hasState: !!state, stateLen: state ? state.length : 0 });
      this._respond(res, 400, "state mismatch");
      this.stop();
      this.emit("error", new Error("state mismatch — possible CSRF"));
      return;
    }

    if (!token) {
      bc("auth", "callback.missing_token");
      this._respond(res, 400, "missing token");
      this.stop();
      this.emit("error", new Error("no token in callback"));
      return;
    }

    this._respond(res, 200, `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>GitAnimals</title>
<style>body{font-family:sans-serif;text-align:center;padding:60px 20px;color:#333}</style>
</head><body>
<h2>✓ 로그인 완료</h2>
<p>이 탭을 닫아도 됩니다.</p>
<script>setTimeout(()=>window.close(),1500)</script>
</body></html>`, "text/html; charset=utf-8");

    this.stop();
    this.emit("token", token);
  }
}

module.exports = { AuthCallbackServer, PORT_START, PORT_COUNT };
