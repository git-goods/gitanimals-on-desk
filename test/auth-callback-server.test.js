const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");

const { AuthCallbackServer, PORT_START } = require("../src/auth/callback-server");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

describe("AuthCallbackServer", () => {
  it("starts and provides port + state", async () => {
    const srv = new AuthCallbackServer();
    await srv.start();
    assert.ok(srv.port >= PORT_START, "port in expected range");
    assert.ok(typeof srv.state === "string" && srv.state.length === 64, "state is 32-byte hex");
    srv.stop();
  });

  it("emits token on valid callback", async () => {
    const srv = new AuthCallbackServer();
    await srv.start();

    const tokenPromise = new Promise((resolve) => srv.once("token", resolve));
    const url = `http://127.0.0.1:${srv.port}/auth/callback?token=abc123&state=${srv.state}`;
    const res = await httpGet(url);

    assert.strictEqual(res.status, 200);
    const token = await tokenPromise;
    assert.strictEqual(token, "abc123");
  });

  it("emits error and returns 400 on state mismatch", async () => {
    const srv = new AuthCallbackServer();
    await srv.start();

    const errPromise = new Promise((resolve) => srv.once("error", resolve));
    const url = `http://127.0.0.1:${srv.port}/auth/callback?token=abc123&state=wrong`;
    const res = await httpGet(url);

    assert.strictEqual(res.status, 400);
    const err = await errPromise;
    assert.ok(err.message.includes("state mismatch"), `unexpected: ${err.message}`);
  });

  it("returns 400 when token is missing", async () => {
    const srv = new AuthCallbackServer();
    await srv.start();

    const errPromise = new Promise((resolve) => srv.once("error", resolve));
    const url = `http://127.0.0.1:${srv.port}/auth/callback?state=${srv.state}`;
    const res = await httpGet(url);

    assert.strictEqual(res.status, 400);
    const err = await errPromise;
    assert.ok(err.message.includes("token"), `unexpected: ${err.message}`);
  });

  it("returns 404 for unknown paths", async () => {
    const srv = new AuthCallbackServer();
    await srv.start();
    const res = await httpGet(`http://127.0.0.1:${srv.port}/other`);
    assert.strictEqual(res.status, 404);
    srv.stop();
  });
});
