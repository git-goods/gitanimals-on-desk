const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert");

let initUpdater = require("../../src/update/updater");

function makeCtx(overrides = {}) {
  return {
    doNotDisturb: false,
    miniMode: false,
    autoCheckForUpdates: true,
    getPendingUpdateVersion: () => "",
    getUpdateSnoozeUntil: () => 0,
    savePendingState() {},
    rebuildAllMenus() {},
    updateLog() {},
    t: (k) => k,
    showUpdateDialog() {},
    setUpdateVisualState() {},
    applyState() {},
    resolveDisplayState: () => "idle",
    ...overrides,
  };
}

function makeDeps(overrides = {}) {
  const app = {
    isPackaged: true,
    getVersion: () => "0.5.10",
    relaunch() {},
    exit() {},
  };
  return {
    app,
    dialog: {
      showMessageBox: async () => ({ response: 1 }),
    },
    shell: {
      openExternal() {},
    },
    Notification: class {
      constructor() {}
      show() {}
    },
    httpsGetImpl: null,
    execFileImpl: null,
    fsImpl: null,
    autoUpdaterFactory: () => ({
      autoDownload: false,
      autoInstallOnAppQuit: true,
      on() {},
      checkForUpdates: async () => null,
      quitAndInstall() {},
      downloadUpdate() {},
    }),
    ...overrides,
  };
}

describe("updater visual flow", () => {
  beforeEach(() => {
    mock.restoreAll();
    delete require.cache[require.resolve("../../src/update/updater")];
    initUpdater = require("../../src/update/updater");
  });

  it("shows sweeping state and up-to-date bubble when latest version matches", async () => {
    const visualStates = [];
    const bubbles = [];
    const applied = [];
    let overlayState = null;
    const ctx = makeCtx({
      setUpdateVisualState: (state) => {
        visualStates.push(state);
        overlayState = state;
      },
      applyState: (state, svgOverride) => applied.push({ state, svgOverride }),
      resolveDisplayState: () => overlayState ? "sweeping" : "idle",
      getSvgOverride: (state) => state === "sweeping" ? "gitanimals-working-debugger.svg" : null,
      showUpdateDialog: (payload) => bubbles.push(payload),
    });
    const handlers = {};
    const updater = initUpdater(ctx, makeDeps({
      autoUpdaterFactory: () => ({
        autoDownload: false,
        autoInstallOnAppQuit: true,
        on(event, handler) { handlers[event] = handler; },
        async checkForUpdates() {
          process.nextTick(() => handlers["update-not-available"]?.());
          return {};
        },
        quitAndInstall() {},
        downloadUpdate() {},
      }),
    }));
    updater.setupAutoUpdater();

    await updater.checkForUpdates(true);
    await new Promise((r) => setTimeout(r, 20));

    assert.deepStrictEqual(visualStates, ["checking", null]);
    assert.deepStrictEqual(bubbles.map((bubble) => bubble.mode), ["up-to-date"]);
    assert.ok(
      applied.some((entry) => entry.state === "sweeping" && entry.svgOverride === "gitanimals-working-debugger.svg")
    );
  });

  it("shows error state and detail bubble when autoUpdater check fails", async () => {
    const visualStates = [];
    const appliedStates = [];
    const bubbles = [];
    const ctx = makeCtx({
      setUpdateVisualState: (state) => visualStates.push(state),
      applyState: (state) => appliedStates.push(state),
      showUpdateDialog: (payload) => bubbles.push(payload),
    });
    const handlers = {};
    const updater = initUpdater(ctx, makeDeps({
      autoUpdaterFactory: () => ({
        autoDownload: false,
        autoInstallOnAppQuit: true,
        on(event, handler) { handlers[event] = handler; },
        async checkForUpdates() { throw new Error("network down"); },
        quitAndInstall() {},
        downloadUpdate() {},
      }),
    }));
    updater.setupAutoUpdater();

    await updater.checkForUpdates(true);

    assert.deepStrictEqual(visualStates, ["checking", null]);
    assert.ok(appliedStates.includes("error"));
    assert.deepStrictEqual(bubbles.map((bubble) => bubble.mode), ["error"]);
    assert.match(bubbles[0].detail, /Operation: Check for Updates/);
    assert.match(bubbles[0].detail, /Reason: network down/);
    assert.match(bubbles[0].detail, /network down/);
  });

  it("shows a real error bubble when packaged download fails after user starts it", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });
    delete require.cache[require.resolve("../../src/update/updater")];
    initUpdater = require("../../src/update/updater");
    const bubbles = [];
    const handlers = {};
    const ctx = makeCtx({
      showUpdateDialog: async (payload) => {
        bubbles.push(payload);
        if (payload.mode === "available") return "primary";
        if (payload.mode === "error") return "dismiss";
        return payload.defaultAction || null;
      },
    });
    const updater = initUpdater(ctx, makeDeps({
      autoUpdaterFactory: () => ({
        autoDownload: false,
        autoInstallOnAppQuit: true,
        on(event, handler) { handlers[event] = handler; },
        checkForUpdates: async () => ({ updateInfo: { version: "0.5.11" } }),
        quitAndInstall() {},
        downloadUpdate() {
          return Promise.resolve().then(() => handlers.error(new Error("download exploded")));
        },
      }),
      httpsGetImpl: (options, cb) => {
        const res = {
          statusCode: 200,
          on(event, handler) {
            if (event === "data") handler(Buffer.from(JSON.stringify({ tag_name: "v0.5.11" })));
            if (event === "end") handler();
            return this;
          },
        };
        cb(res);
        return { on() { return this; }, setTimeout() {} };
      },
    }));

    updater.setupAutoUpdater();
    await updater.checkForUpdates(true);
    await handlers["update-available"]({ version: "0.5.11" });
    await Promise.resolve();
    await Promise.resolve();

    assert.deepStrictEqual(bubbles.map((bubble) => bubble.mode), ["available", "error"]);
    assert.match(bubbles[1].detail, /download exploded/);
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("uses the same autoUpdater download path on macOS as on Windows (signed + notarized)", async () => {
    const originalPlatform = process.platform;
    const bubbles = [];
    const handlers = {};
    let downloadCalled = false;
    Object.defineProperty(process, "platform", { value: "darwin" });
    try {
      delete require.cache[require.resolve("../../src/update/updater")];
      initUpdater = require("../../src/update/updater");
      const ctx = makeCtx({
        showUpdateDialog: async (payload) => {
          bubbles.push(payload);
          if (payload.mode === "available") return "primary";
          if (payload.mode === "ready") return "dismiss";
          return payload.defaultAction || null;
        },
      });
      const updater = initUpdater(ctx, makeDeps({
        autoUpdaterFactory: () => ({
          autoDownload: false,
          autoInstallOnAppQuit: true,
          on(event, handler) { handlers[event] = handler; },
          checkForUpdates: async () => ({ updateInfo: { version: "0.5.11" } }),
          quitAndInstall() {},
          downloadUpdate() {
            downloadCalled = true;
          },
        }),
        httpsGetImpl: (options, cb) => {
          const res = {
            statusCode: 200,
            on(event, handler) {
              if (event === "data") handler(Buffer.from(JSON.stringify({ tag_name: "v0.5.11" })));
              if (event === "end") handler();
              return this;
            },
          };
          cb(res);
          return { on() { return this; }, setTimeout() {} };
        },
      }));

      updater.setupAutoUpdater();
      await updater.checkForUpdates(true);
      await handlers["update-available"]({ version: "0.5.11" });

      assert.deepStrictEqual(bubbles.map((bubble) => bubble.mode), ["available"]);
      assert.strictEqual(downloadCalled, true);
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    }
  });

  it("uses a friendly dirty-worktree message while keeping detailed file status", async () => {
    const bubbles = [];
    const ctx = makeCtx({
      showUpdateDialog: async (payload) => {
        bubbles.push(payload);
        if (payload.mode === "available") return "primary";
        if (payload.mode === "error") return "dismiss";
        return payload.defaultAction || null;
      },
    });
    const updater = initUpdater(ctx, makeDeps({
      app: {
        isPackaged: false,
        getVersion: () => "0.5.10",
        relaunch() {},
        exit() {},
      },
      fsImpl: {
        statSync(file) {
          if (String(file).endsWith("\\.git") || String(file).endsWith("/.git")) {
            return { isDirectory: () => true };
          }
          throw new Error("unexpected stat");
        },
      },
      execFileImpl(command, args, options, callback) {
        const key = `${command} ${args.join(" ")}`;
        if (key === "git rev-parse --abbrev-ref HEAD") return callback(null, "main");
        if (key === "git fetch origin main") return callback(null, "");
        if (key === "git rev-parse HEAD") return callback(null, "localsha");
        if (key === "git rev-parse origin/main") return callback(null, "remotesha");
        if (key === "git show origin/main:package.json") return callback(null, JSON.stringify({ version: "0.5.11" }));
        if (key === "git status --porcelain") return callback(null, "M package-lock.json\nM src/main.js");
        return callback(new Error(`unexpected command: ${key}`));
      },
    }));

    await updater.checkForUpdates(true);

    assert.deepStrictEqual(bubbles.map((bubble) => bubble.mode), ["available", "error"]);
    assert.match(bubbles[1].message, /modified|commit|stash/i);
    assert.match(bubbles[1].detail, /Failure Type: Dirty Worktree/i);
    assert.match(bubbles[1].detail, /Operation: Apply Git Update/i);
    assert.match(bubbles[1].detail, /package-lock\.json/);
  });

  it("pulses attention on packaged update download completion so the success sound path runs", async () => {
    const appliedStates = [];
    let resetSoundCooldownCalls = 0;
    const handlers = {};
    const ctx = makeCtx({
      resetSoundCooldown: () => { resetSoundCooldownCalls++; },
      applyState: (state) => appliedStates.push(state),
      showUpdateDialog: async (payload) => {
        if (payload.mode === "ready") return "later";
        return payload.defaultAction || null;
      },
    });
    const updater = initUpdater(ctx, makeDeps({
      autoUpdaterFactory: () => ({
        autoDownload: false,
        autoInstallOnAppQuit: true,
        on(event, handler) { handlers[event] = handler; },
        checkForUpdates: async () => null,
        quitAndInstall() {},
        downloadUpdate() {},
      }),
    }));

    updater.setupAutoUpdater();
    await handlers["update-downloaded"]({ version: "0.5.11" });

    assert.strictEqual(resetSoundCooldownCalls, 1);
    assert.ok(appliedStates.includes("attention"));
  });
});

describe("scheduler", () => {
  beforeEach(() => {
    mock.restoreAll();
    delete require.cache[require.resolve("../../src/update/updater")];
    initUpdater = require("../../src/update/updater");
  });

  it("startScheduler does nothing when app.isPackaged is false", () => {
    const ctx = makeCtx();
    const updater = initUpdater(ctx, makeDeps({
      app: { isPackaged: false, getVersion: () => "1.0.0", relaunch() {}, exit() {} },
    }));
    updater.startScheduler();
    updater.stopScheduler();
  });

  it("stopScheduler is safe to call without start", () => {
    const ctx = makeCtx();
    const updater = initUpdater(ctx, makeDeps());
    updater.stopScheduler();
  });
});

describe("defer", () => {
  beforeEach(() => {
    mock.restoreAll();
    delete require.cache[require.resolve("../../src/update/updater")];
    initUpdater = require("../../src/update/updater");
  });

  it("saves pendingUpdateVersion when update found during DND", async () => {
    const savedState = {};
    const bubbles = [];
    const ctx = makeCtx({
      doNotDisturb: true,
      showUpdateDialog: (p) => { bubbles.push(p); return "later"; },
      savePendingState(partial) { Object.assign(savedState, partial); },
    });
    const autoUpdater = {
      autoDownload: false,
      autoInstallOnAppQuit: true,
      _handlers: {},
      on(event, handler) { this._handlers[event] = handler; },
      checkForUpdates: async () => ({}),
      quitAndInstall() {},
      downloadUpdate() {},
    };
    const updater = initUpdater(ctx, makeDeps({ autoUpdaterFactory: () => autoUpdater }));
    updater.setupAutoUpdater();
    await autoUpdater._handlers["update-available"]({ version: "2.0.0" });

    assert.strictEqual(savedState.pendingUpdateVersion, "2.0.0");
    const availableBubbles = bubbles.filter(b => b.mode === "available");
    assert.strictEqual(availableBubbles.length, 0);
  });

  it("reevaluateDeferred prompts when not silent and snooze expired", async () => {
    const bubbles = [];
    const ctx = makeCtx({
      showUpdateDialog: (p) => { bubbles.push(p); return "later"; },
      getPendingUpdateVersion: () => "2.0.0",
      getUpdateSnoozeUntil: () => 0,
      savePendingState() {},
    });
    const updater = initUpdater(ctx, makeDeps());
    updater.setupAutoUpdater();
    await updater.reevaluateDeferred();

    const availableBubbles = bubbles.filter(b => b.mode === "available");
    assert.ok(availableBubbles.length > 0, "should show available prompt");
  });

  it("reevaluateDeferred skips when still silent", async () => {
    const bubbles = [];
    const ctx = makeCtx({
      doNotDisturb: true,
      showUpdateDialog: (p) => { bubbles.push(p); return "later"; },
      getPendingUpdateVersion: () => "2.0.0",
      savePendingState() {},
    });
    const updater = initUpdater(ctx, makeDeps());
    await updater.reevaluateDeferred();
    assert.strictEqual(bubbles.length, 0);
  });
});

describe("menu reflects available state", () => {
  beforeEach(() => {
    mock.restoreAll();
    delete require.cache[require.resolve("../../src/update/updater")];
    initUpdater = require("../../src/update/updater");
  });

  it("getUpdateMenuLabel shows version when status is available", async () => {
    const savedState = {};
    const ctx = makeCtx({
      showUpdateDialog: () => "later",
      savePendingState(partial) { Object.assign(savedState, partial); },
    });
    const autoUpdater = {
      autoDownload: false,
      autoInstallOnAppQuit: true,
      _handlers: {},
      on(event, handler) { this._handlers[event] = handler; },
      checkForUpdates: async () => ({}),
      quitAndInstall() {},
      downloadUpdate() {},
    };
    const updater = initUpdater(ctx, makeDeps({ autoUpdaterFactory: () => autoUpdater }));
    updater.setupAutoUpdater();

    // Trigger update-available → user picks "later" → status stays "available"
    await autoUpdater._handlers["update-available"]({ version: "2.0.0" });

    const label = updater.getUpdateMenuLabel();
    assert.ok(label.includes("2.0.0"), `label should include version, got: ${label}`);
  });
});

describe("pending version cleanup", () => {
  beforeEach(() => {
    mock.restoreAll();
    delete require.cache[require.resolve("../../src/update/updater")];
    initUpdater = require("../../src/update/updater");
  });

  it("clears pendingUpdateVersion when current version is up-to-date", async () => {
    const savedState = {};
    const ctx = makeCtx({
      showUpdateDialog: (p) => "dismiss",
      savePendingState(partial) { Object.assign(savedState, partial); },
      getPendingUpdateVersion: () => "0.5.10",
      getUpdateSnoozeUntil: () => 0,
    });
    const handlers = {};
    const updater = initUpdater(ctx, makeDeps({
      app: { isPackaged: true, getVersion: () => "0.5.10", relaunch() {}, exit() {} },
      autoUpdaterFactory: () => ({
        autoDownload: false,
        autoInstallOnAppQuit: true,
        on(event, handler) { handlers[event] = handler; },
        async checkForUpdates() {
          process.nextTick(() => handlers["update-not-available"]?.());
          return {};
        },
        quitAndInstall() {},
        downloadUpdate() {},
      }),
    }));
    updater.setupAutoUpdater();
    await updater.checkForUpdates(false);
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(savedState.pendingUpdateVersion, "");
  });

  it("persists lastUpdateCheckAt on check start", async () => {
    const savedState = {};
    const before = Date.now();
    const ctx = makeCtx({
      showUpdateDialog: (p) => "dismiss",
      savePendingState(partial) { Object.assign(savedState, partial); },
    });
    const updater = initUpdater(ctx, makeDeps({
      httpsGetImpl: (options, cb) => {
        const res = {
          statusCode: 200,
          on(evt, fn) {
            if (evt === "data") fn(JSON.stringify({ tag_name: "v0.5.10" }));
            if (evt === "end") fn();
          },
        };
        cb(res);
        return { on() {}, setTimeout() {} };
      },
    }));
    updater.setupAutoUpdater();
    await updater.checkForUpdates(false);

    assert.ok(savedState.lastUpdateCheckAt >= before, "should persist check timestamp");
  });
});

describe("snooze", () => {
  beforeEach(() => {
    mock.restoreAll();
    delete require.cache[require.resolve("../../src/update/updater")];
    initUpdater = require("../../src/update/updater");
  });

  it("Later sets snooze and keeps pendingUpdateVersion", async () => {
    const savedState = {};
    const ctx = makeCtx({
      showUpdateDialog: () => "later",
      savePendingState(partial) { Object.assign(savedState, partial); },
    });
    const autoUpdater = {
      autoDownload: false,
      autoInstallOnAppQuit: true,
      _handlers: {},
      on(event, handler) { this._handlers[event] = handler; },
      checkForUpdates: async () => ({}),
      quitAndInstall() {},
      downloadUpdate() {},
    };
    const updater = initUpdater(ctx, makeDeps({ autoUpdaterFactory: () => autoUpdater }));
    updater.setupAutoUpdater();
    await autoUpdater._handlers["update-available"]({ version: "2.0.0" });

    assert.strictEqual(savedState.pendingUpdateVersion, "2.0.0");
    assert.ok(savedState.updateSnoozeUntil > Date.now() - 1000, "snooze should be set");
    assert.ok(savedState.updateSnoozeUntil <= Date.now() + 86400001, "snooze should be ~24h");
  });

  it("reevaluateDeferred skips when snooze not expired", async () => {
    const bubbles = [];
    const ctx = makeCtx({
      showUpdateDialog: (p) => { bubbles.push(p); return "later"; },
      getPendingUpdateVersion: () => "2.0.0",
      getUpdateSnoozeUntil: () => Date.now() + 86400000,
      savePendingState() {},
    });
    const updater = initUpdater(ctx, makeDeps());
    await updater.reevaluateDeferred();
    assert.strictEqual(bubbles.length, 0, "should not prompt while snoozed");
  });
});
