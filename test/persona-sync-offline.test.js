const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const os = require("os");
const fs = require("fs");

// persona-sync depends on ../api/gitanimals-client at sync time (lazy require).
// We test the public API surface in a Node-only environment.

const personaSync = require("../src/theme/persona-sync");

describe("persona-sync offline", () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-sync-test-"));
    personaSync.init(tmpDir);
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) {}
  });

  it("syncAll() does not throw when the network fails", async () => {
    // Monkey-patch the lazy-loaded gitanimals-client so getUser throws.
    const clientPath = require.resolve("../src/api/gitanimals-client");
    const original = require.cache[clientPath];
    require.cache[clientPath] = {
      id: clientPath,
      filename: clientPath,
      loaded: true,
      exports: {
        getUser: async () => { throw new Error("network error"); },
        getUserPersonas: async () => { throw new Error("network error"); },
        getAssets: async () => { throw new Error("network error"); },
        downloadBuffer: async () => { throw new Error("network error"); },
        UnauthorizedError: class UnauthorizedError extends Error {},
      },
    };

    try {
      // Must not throw — syncAll swallows errors
      await assert.doesNotReject(() => personaSync.syncAll({ force: true }));
    } finally {
      // Restore original (or remove stub so next require re-evaluates)
      if (original) {
        require.cache[clientPath] = original;
      } else {
        delete require.cache[clientPath];
      }
    }
  });

  it("loadCachedPersonas() returns [] when cache directory doesn't exist", () => {
    // Point to a directory that definitely does not exist
    const nonExistentDir = path.join(os.tmpdir(), "persona-sync-no-such-dir-" + Date.now());
    personaSync.init(nonExistentDir);
    const result = personaSync.loadCachedPersonas();
    assert.deepStrictEqual(result, []);
    // Restore to tmpDir for subsequent tests
    personaSync.init(tmpDir);
  });
});
