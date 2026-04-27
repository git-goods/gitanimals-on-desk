const { describe, it } = require("node:test");
const assert = require("node:assert");

// token-store depends on Electron (app.getPath) — skip when not in Electron.
let tokenStore;
try {
  const { app } = require("electron");
  if (typeof app.getPath === "function") {
    tokenStore = require("../src/auth/token-store");
  }
} catch {
  // not running inside Electron; skip all tests
}

describe("auth/token-store", () => {
  it("exports get, set, clear", () => {
    if (!tokenStore) return; // skip
    assert.strictEqual(typeof tokenStore.get, "function");
    assert.strictEqual(typeof tokenStore.set, "function");
    assert.strictEqual(typeof tokenStore.clear, "function");
  });

  it("set() throws on invalid token", () => {
    if (!tokenStore) return;
    assert.throws(() => tokenStore.set(""), TypeError);
    assert.throws(() => tokenStore.set(null), TypeError);
    assert.throws(() => tokenStore.set(42), TypeError);
  });

  it("get() returns null when no token stored", () => {
    if (!tokenStore) return;
    tokenStore.clear();
    assert.strictEqual(tokenStore.get(), null);
  });

  it("round-trips a token", () => {
    if (!tokenStore) return;
    tokenStore.set("test-token-xyz");
    assert.strictEqual(tokenStore.get(), "test-token-xyz");
    tokenStore.clear();
    assert.strictEqual(tokenStore.get(), null);
  });
});
