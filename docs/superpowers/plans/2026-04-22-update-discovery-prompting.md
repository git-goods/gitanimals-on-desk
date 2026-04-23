# Update Discovery & Prompting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic background update checking with deferred prompting and snooze so packaged builds discover new versions without user action.

**Architecture:** Extend the existing `initUpdater()` closure in `src/update/updater.js` with scheduler, defer, and snooze logic. New prefs fields persist state across restarts via the existing `gitanimals-prefs.json` schema. `main.js` wires the scheduler into startup/shutdown and re-evaluates deferred prompts when DND/mini state changes.

**Tech Stack:** Electron, Node.js built-in test runner, existing settings controller/store/prefs pipeline.

**Design spec:** `docs/superpowers/specs/2026-04-22-update-discovery-prompting-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/settings/prefs.ts` | Add 4 SCHEMA fields |
| Modify | `src/types/contracts.d.ts` | Add 4 fields to `SettingsSnapshot` interface |
| Modify | `src/settings/actions.ts` | Add `autoCheckForUpdates` + 3 internal validators to `updateRegistry` |
| Modify | `src/update/updater.js` | Add scheduler, defer, snooze logic; expand menu; export 3 new functions |
| Modify | `src/core/main.js` | Extend `_updaterCtx`, wire scheduler start/stop, add `reevaluateDeferred` calls |
| Modify | `src/settings/renderer.js` | Add toggle row in General > Startup |
| Modify | `src/settings/i18n.js` | Add i18n strings for settings row + menu label (en, zh, ko) |
| Modify | `test/settings/prefs.test.js` | Tests for new fields |
| Modify | `test/update/updater.test.js` | Tests for scheduler, defer, snooze |

---

### Task 1: Extend prefs schema and types

**Files:**
- Modify: `src/settings/prefs.ts:21-77` (SCHEMA object)
- Modify: `src/types/contracts.d.ts:49-75` (SettingsSnapshot interface)
- Test: `test/settings/prefs.test.js`

- [ ] **Step 1: Write failing tests for new fields**

Add to `test/settings/prefs.test.js`:

```js
describe("update discovery prefs fields", () => {
  it("defaults include autoCheckForUpdates=true", () => {
    const d = prefs.getDefaults();
    assert.strictEqual(d.autoCheckForUpdates, true);
  });

  it("defaults include lastUpdateCheckAt=0", () => {
    const d = prefs.getDefaults();
    assert.strictEqual(d.lastUpdateCheckAt, 0);
  });

  it("defaults include updateSnoozeUntil=0", () => {
    const d = prefs.getDefaults();
    assert.strictEqual(d.updateSnoozeUntil, 0);
  });

  it("defaults include pendingUpdateVersion empty string", () => {
    const d = prefs.getDefaults();
    assert.strictEqual(d.pendingUpdateVersion, "");
  });

  it("validate accepts valid update prefs", () => {
    const v = prefs.validate({
      autoCheckForUpdates: false,
      lastUpdateCheckAt: 1713800000000,
      updateSnoozeUntil: 1713886400000,
      pendingUpdateVersion: "1.2.3",
    });
    assert.strictEqual(v.autoCheckForUpdates, false);
    assert.strictEqual(v.lastUpdateCheckAt, 1713800000000);
    assert.strictEqual(v.updateSnoozeUntil, 1713886400000);
    assert.strictEqual(v.pendingUpdateVersion, "1.2.3");
  });

  it("validate rejects bad types and falls back to defaults", () => {
    const v = prefs.validate({
      autoCheckForUpdates: "yes",
      lastUpdateCheckAt: "now",
      updateSnoozeUntil: NaN,
      pendingUpdateVersion: 123,
    });
    assert.strictEqual(v.autoCheckForUpdates, true);
    assert.strictEqual(v.lastUpdateCheckAt, 0);
    assert.strictEqual(v.updateSnoozeUntil, 0);
    assert.strictEqual(v.pendingUpdateVersion, "");
  });

  it("load tolerates missing new fields in existing prefs file", () => {
    const p = makeTempPath();
    fs.writeFileSync(p, JSON.stringify({ version: 1, lang: "ko" }));
    const { snapshot } = prefs.load(p);
    assert.strictEqual(snapshot.autoCheckForUpdates, true);
    assert.strictEqual(snapshot.lastUpdateCheckAt, 0);
    assert.strictEqual(snapshot.pendingUpdateVersion, "");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/settings/prefs.test.js`
Expected: FAIL — `d.autoCheckForUpdates` is `undefined`

- [ ] **Step 3: Add fields to SettingsSnapshot type**

In `src/types/contracts.d.ts`, add inside the `SettingsSnapshot` interface after the `flip: boolean;` line:

```ts
  autoCheckForUpdates: boolean;
  lastUpdateCheckAt: number;
  updateSnoozeUntil: number;
  pendingUpdateVersion: string;
```

- [ ] **Step 4: Add fields to prefs SCHEMA**

In `src/settings/prefs.ts`, add after `flip: { type: "boolean", default: false },` and before `sendDiagnostics`:

```ts
  autoCheckForUpdates: { type: "boolean", default: true },
  lastUpdateCheckAt: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
  updateSnoozeUntil: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
  pendingUpdateVersion: { type: "string", default: "" },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/settings/prefs.test.js`
Expected: all PASS

- [ ] **Step 6: Compile TypeScript**

Run: `npx tsc --noEmit` (or the project's build:types script if it has one)
Verify no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/settings/prefs.ts src/types/contracts.d.ts test/settings/prefs.test.js
git commit -m "feat(prefs): add update discovery schema fields"
```

---

### Task 2: Add validators to actions registry

**Files:**
- Modify: `src/settings/actions.ts:59-183` (updateRegistry)
- Test: `test/settings/actions.test.js`

- [ ] **Step 1: Write failing test**

Add to `test/settings/actions.test.js`:

```js
describe("update discovery validators", () => {
  it("autoCheckForUpdates accepts boolean", () => {
    const entry = updateRegistry.autoCheckForUpdates;
    const validate = typeof entry === "function" ? entry : entry.validate;
    assert.deepStrictEqual(validate(true, { snapshot: prefs.getDefaults() }), { status: "ok" });
    assert.deepStrictEqual(validate(false, { snapshot: prefs.getDefaults() }), { status: "ok" });
  });

  it("autoCheckForUpdates rejects non-boolean", () => {
    const entry = updateRegistry.autoCheckForUpdates;
    const validate = typeof entry === "function" ? entry : entry.validate;
    const result = validate("yes", { snapshot: prefs.getDefaults() });
    assert.strictEqual(result.status, "error");
  });

  it("lastUpdateCheckAt accepts finite number", () => {
    const validate = typeof updateRegistry.lastUpdateCheckAt === "function"
      ? updateRegistry.lastUpdateCheckAt
      : updateRegistry.lastUpdateCheckAt.validate;
    assert.deepStrictEqual(validate(Date.now(), { snapshot: prefs.getDefaults() }), { status: "ok" });
  });

  it("pendingUpdateVersion accepts string including empty", () => {
    const validate = typeof updateRegistry.pendingUpdateVersion === "function"
      ? updateRegistry.pendingUpdateVersion
      : updateRegistry.pendingUpdateVersion.validate;
    assert.deepStrictEqual(validate("", { snapshot: prefs.getDefaults() }), { status: "ok" });
    assert.deepStrictEqual(validate("1.2.3", { snapshot: prefs.getDefaults() }), { status: "ok" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/settings/actions.test.js`
Expected: FAIL — `updateRegistry.autoCheckForUpdates` is `undefined`

- [ ] **Step 3: Add validators to updateRegistry**

In `src/settings/actions.ts`, add after `flip: requireBoolean("flip"),` and before `sendDiagnostics`:

```ts
  autoCheckForUpdates: requireBoolean("autoCheckForUpdates"),
  lastUpdateCheckAt: requireFiniteNumber("lastUpdateCheckAt"),
  updateSnoozeUntil: requireFiniteNumber("updateSnoozeUntil"),
  pendingUpdateVersion: requireString("pendingUpdateVersion", { allowEmpty: true }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/settings/actions.test.js`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/settings/actions.ts test/settings/actions.test.js
git commit -m "feat(settings): add update discovery validators to actions registry"
```

---

### Task 3: Extend updater.js — scheduler, defer, snooze

**Files:**
- Modify: `src/update/updater.js:69-695` (inside `initUpdater` closure)
- Test: `test/update/updater.test.js`

- [ ] **Step 1: Write failing tests for scheduler**

Add to `test/update/updater.test.js`. First, extend `makeCtx` with new ctx fields:

```js
function makeCtx(overrides = {}) {
  return {
    doNotDisturb: false,
    miniMode: false,
    rebuildAllMenus() {},
    updateLog() {},
    t: (k) => k,
    showUpdateBubble() {},
    hideUpdateBubble() {},
    setUpdateVisualState() {},
    applyState() {},
    resolveDisplayState: () => "idle",
    // new for update discovery:
    autoCheckForUpdates: true,
    getPendingUpdateVersion: () => "",
    savePendingState(partial) { Object.assign(this._savedState || (this._savedState = {}), partial); },
    ...overrides,
  };
}
```

Then add the scheduler tests:

```js
describe("scheduler", () => {
  it("startScheduler does nothing when app.isPackaged is false", () => {
    let checkCalled = false;
    const ctx = makeCtx();
    const updater = initUpdater(ctx, makeDeps({
      app: { isPackaged: false, getVersion: () => "1.0.0", relaunch() {}, exit() {} },
      httpsGetImpl: () => { checkCalled = true; },
    }));
    updater.startScheduler();
    // If scheduler ran, it would call checkForUpdates which would use httpsGetImpl
    assert.strictEqual(checkCalled, false);
    updater.stopScheduler();
  });

  it("startScheduler skips check when autoCheckForUpdates is false", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    let checkCalled = false;
    const ctx = makeCtx({ autoCheckForUpdates: false });
    const updater = initUpdater(ctx, makeDeps({
      httpsGetImpl: () => { checkCalled = true; },
    }));
    updater.setupAutoUpdater();
    updater.startScheduler();
    t.mock.timers.tick(35000); // past 30s startup delay
    assert.strictEqual(checkCalled, false);
    updater.stopScheduler();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/update/updater.test.js`
Expected: FAIL — `updater.startScheduler is not a function`

- [ ] **Step 3: Implement scheduler in updater.js**

Inside `initUpdater()`, after the `checkForUpdates` function and before `getUpdateMenuLabel`, add:

```js
  const STARTUP_DELAY = 30 * 1000;
  const CHECK_INTERVAL = 12 * 60 * 60 * 1000;
  let schedulerStartupTimer = null;
  let schedulerIntervalTimer = null;

  function scheduledCheck() {
    if (!ctx.autoCheckForUpdates) return;
    if (updateStatus === "checking" || updateStatus === "downloading") return;
    checkForUpdates(false);
  }

  function startScheduler() {
    if (!app.isPackaged) return;
    stopScheduler();
    schedulerStartupTimer = setTimeout(() => {
      scheduledCheck();
      schedulerIntervalTimer = setInterval(scheduledCheck, CHECK_INTERVAL);
    }, STARTUP_DELAY);
  }

  function stopScheduler() {
    if (schedulerStartupTimer) { clearTimeout(schedulerStartupTimer); schedulerStartupTimer = null; }
    if (schedulerIntervalTimer) { clearInterval(schedulerIntervalTimer); schedulerIntervalTimer = null; }
  }
```

Add `startScheduler`, `stopScheduler` to the return object:

```js
  return {
    setupAutoUpdater,
    checkForUpdates,
    getUpdateMenuItem,
    getUpdateMenuLabel,
    startScheduler,
    stopScheduler,
  };
```

- [ ] **Step 4: Run scheduler tests to verify they pass**

Run: `node --test test/update/updater.test.js`
Expected: scheduler tests PASS

- [ ] **Step 5: Commit scheduler**

```bash
git add src/update/updater.js test/update/updater.test.js
git commit -m "feat(updater): add background check scheduler"
```

- [ ] **Step 6: Write failing tests for defer logic**

```js
describe("defer", () => {
  it("saves pendingUpdateVersion when update found during DND", async () => {
    const savedState = {};
    const bubbles = [];
    const ctx = makeCtx({
      doNotDisturb: true,
      showUpdateBubble: (p) => { bubbles.push(p); return "later"; },
      savePendingState(partial) { Object.assign(savedState, partial); },
      getPendingUpdateVersion: () => savedState.pendingUpdateVersion || "",
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

    // Simulate: manual=false check finds update, but DND is on
    await autoUpdater._handlers["update-available"]({ version: "2.0.0" });

    assert.strictEqual(savedState.pendingUpdateVersion, "2.0.0");
    assert.strictEqual(bubbles.length, 0); // no bubble shown
  });

  it("reevaluateDeferred shows prompt when DND cleared and snooze expired", async () => {
    const savedState = { pendingUpdateVersion: "2.0.0", updateSnoozeUntil: 0 };
    const bubbles = [];
    const ctx = makeCtx({
      doNotDisturb: false,
      showUpdateBubble: (p) => { bubbles.push(p); return "later"; },
      savePendingState(partial) { Object.assign(savedState, partial); },
      getPendingUpdateVersion: () => savedState.pendingUpdateVersion,
      getUpdateSnoozeUntil: () => savedState.updateSnoozeUntil,
    });
    const updater = initUpdater(ctx, makeDeps());
    updater.setupAutoUpdater();
    await updater.reevaluateDeferred();

    assert.ok(bubbles.length > 0, "should show prompt bubble");
    assert.strictEqual(bubbles[0].mode, "available");
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `node --test test/update/updater.test.js`
Expected: FAIL

- [ ] **Step 8: Implement defer logic**

Modify `initUpdater()`:

1. Add a `pendingVersion` variable to track in-memory state:

```js
  let pendingVersion = "";
```

2. Change the silent-mode branch in `setupAutoUpdater()`'s `update-available` handler. Replace:

```js
      if (!wasManual && isSilentMode()) {
        updateStatus = "idle";
        dismissToResolvedState();
        return;
      }
```

With:

```js
      if (!wasManual && isSilentMode()) {
        pendingVersion = info.version;
        ctx.savePendingState({
          pendingUpdateVersion: info.version,
          lastUpdateCheckAt: Date.now(),
        });
        // updateStatus stays "available", menu reflects it
        rebuildMenus();
        dismissToResolvedState();
        return;
      }
```

3. Apply the same change in `gitCheckForUpdates()`. Replace:

```js
      if (!manual && isSilentMode()) {
        hideBubble();
        dismissToResolvedState();
        updateStatus = "idle";
        manualUpdateCheck = false;
        return;
      }
```

With:

```js
      if (!manual && isSilentMode()) {
        pendingVersion = remoteVersion;
        ctx.savePendingState({
          pendingUpdateVersion: remoteVersion,
          lastUpdateCheckAt: Date.now(),
        });
        updateStatus = "available";
        hideBubble();
        dismissToResolvedState();
        rebuildMenus();
        manualUpdateCheck = false;
        return;
      }
```

4. Add `reevaluateDeferred()`:

```js
  async function reevaluateDeferred() {
    if (isSilentMode()) return;
    if (updateStatus === "checking" || updateStatus === "downloading") return;

    const pending = pendingVersion || ctx.getPendingUpdateVersion();
    if (!pending) return;

    const snoozeUntil = typeof ctx.getUpdateSnoozeUntil === "function" ? ctx.getUpdateSnoozeUntil() : 0;
    if (snoozeUntil && Date.now() < snoozeUntil) return;

    pendingVersion = pending;
    updateStatus = "available";
    rebuildMenus();

    const repoRoot = getRepoRoot();
    await promptAvailableUpdate({
      mode: repoRoot ? "git" : "win",
      version: pending,
      onPrimary: async () => {
        if (repoRoot) {
          const branch = await gitCmd(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
          const localHead = await gitCmd(["rev-parse", "HEAD"], repoRoot);
          const dirty = await gitCmd(["status", "--porcelain"], repoRoot);
          if (dirty) {
            updateStatus = "error";
            rebuildMenus();
            clearOverlay();
            await showErrorBubble({
              failureType: "Dirty Worktree",
              operation: "Apply Git Update",
              reason: "Local files have uncommitted changes.",
              nextStep: "Commit or stash your changes, then try the update again.",
              detail: dirty,
              message: t("updateDirtyMsg", "Local files have been modified. Please commit or stash your changes before updating."),
            });
            return;
          }
          await runGitUpdate(repoRoot, branch, localHead);
        } else {
          updateStatus = "downloading";
          setOverlay("downloading");
          rebuildMenus();
          await showInfoBubble(
            "downloading",
            t("updateDownloading", "Downloading Update..."),
            t("updateDownloading", "Downloading Update...")
          );
          const autoUpdater = getAutoUpdater();
          if (autoUpdater) autoUpdater.downloadUpdate();
        }
      },
    });
  }
```

Add `reevaluateDeferred` to return object.

- [ ] **Step 9: Run defer tests to verify they pass**

Run: `node --test test/update/updater.test.js`
Expected: defer tests PASS

- [ ] **Step 10: Commit defer logic**

```bash
git add src/update/updater.js test/update/updater.test.js
git commit -m "feat(updater): defer update prompt when DND/mini active"
```

- [ ] **Step 11: Write failing tests for snooze**

```js
describe("snooze", () => {
  it("Later sets snooze and keeps pendingUpdateVersion", async () => {
    const savedState = {};
    const ctx = makeCtx({
      showUpdateBubble: () => "later",
      savePendingState(partial) { Object.assign(savedState, partial); },
      getPendingUpdateVersion: () => "",
      getUpdateSnoozeUntil: () => 0,
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
    assert.ok(savedState.updateSnoozeUntil > Date.now(), "snooze should be in the future");
  });

  it("reevaluateDeferred skips prompt when snooze not expired", async () => {
    const bubbles = [];
    const ctx = makeCtx({
      showUpdateBubble: (p) => { bubbles.push(p); return "later"; },
      savePendingState() {},
      getPendingUpdateVersion: () => "2.0.0",
      getUpdateSnoozeUntil: () => Date.now() + 86400000, // 24h from now
    });
    const updater = initUpdater(ctx, makeDeps());
    updater.setupAutoUpdater();
    await updater.reevaluateDeferred();

    assert.strictEqual(bubbles.length, 0, "should not prompt while snoozed");
  });
});
```

- [ ] **Step 12: Run tests to verify they fail**

Run: `node --test test/update/updater.test.js`
Expected: FAIL

- [ ] **Step 13: Implement snooze logic**

Modify `promptAvailableUpdate()` Later branch. Replace:

```js
    hideBubble();
    dismissToResolvedState();
    updateStatus = "idle";
    rebuildMenus();
    manualUpdateCheck = false;
    return null;
```

With:

```js
    const SNOOZE_DURATION = 24 * 60 * 60 * 1000;
    pendingVersion = version;
    ctx.savePendingState({
      pendingUpdateVersion: version,
      updateSnoozeUntil: Date.now() + SNOOZE_DURATION,
    });
    hideBubble();
    dismissToResolvedState();
    updateStatus = "available";
    rebuildMenus();
    manualUpdateCheck = false;
    return null;
```

Note: access `version` from the enclosing `promptAvailableUpdate` scope — it's already available as a parameter in the existing code's closure.

Also, in the packaged-mode `checkForUpdates()` flow and `setupAutoUpdater` `update-available` handler, when a new version is found and pending already exists with a different version, reset snooze:

After the `compareVersions` check in `checkForUpdates()` that determines a newer version exists, add:

```js
    // Reset snooze if a newer version supersedes the pending one
    const currentPending = pendingVersion || ctx.getPendingUpdateVersion();
    if (currentPending && currentPending !== latestVersion) {
      ctx.savePendingState({ updateSnoozeUntil: 0, pendingUpdateVersion: "" });
      pendingVersion = "";
    }
```

- [ ] **Step 14: Run snooze tests to verify they pass**

Run: `node --test test/update/updater.test.js`
Expected: all snooze tests PASS

- [ ] **Step 15: Commit snooze logic**

```bash
git add src/update/updater.js test/update/updater.test.js
git commit -m "feat(updater): snooze 24h on Later, re-prompt after expiry"
```

---

### Task 4: Expand menu to reflect background state

**Files:**
- Modify: `src/update/updater.js` (getUpdateMenuLabel, getUpdateMenuItem)
- Modify: `src/settings/i18n.js` (add `updateAvailableMenu` key)
- Test: `test/update/updater.test.js`

- [ ] **Step 1: Write failing test for menu label**

```js
describe("menu reflects available state", () => {
  it("getUpdateMenuLabel shows version when available", async () => {
    const ctx = makeCtx({
      showUpdateBubble: () => "later",
      savePendingState() {},
      getPendingUpdateVersion: () => "",
      getUpdateSnoozeUntil: () => 0,
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

    const label = updater.getUpdateMenuLabel();
    assert.ok(label.includes("2.0.0"), `label should include version, got: ${label}`);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/update/updater.test.js`
Expected: FAIL — label is "checkForUpdates" (no version)

- [ ] **Step 3: Implement menu changes**

In `getUpdateMenuLabel()`, change the `default` case and add `available`:

```js
  function getUpdateMenuLabel() {
    switch (updateStatus) {
      case "checking":
        return t("checkingForUpdates", "Checking for Updates...");
      case "downloading":
        return getRepoRoot()
          ? t("updating", "Updating...")
          : t("updateDownloading", "Downloading Update...");
      case "ready":
        return t("updateReady", "Update Ready");
      case "available":
        return t("updateAvailableMenu", "Update Available (v{version})")
          .replace("{version}", pendingVersion || "");
      default:
        return t("checkForUpdates", "Check for Updates");
    }
  }
```

In `getUpdateMenuItem()`, update to handle `available`:

```js
  function getUpdateMenuItem() {
    return {
      label: getUpdateMenuLabel(),
      enabled: updateStatus !== "checking" && updateStatus !== "downloading",
      click: () => {
        if (updateStatus === "ready") {
          const au = getAutoUpdater();
          if (au) au.quitAndInstall(false, true);
        } else if (updateStatus === "available" && pendingVersion) {
          reevaluateDeferred();
        } else {
          checkForUpdates(true);
        }
      },
    };
  }
```

Note: when `available` and user clicks menu, call `reevaluateDeferred()` which already handles the prompt flow. If DND/mini is active at that moment, it's a user-initiated action so we should force-show. Add an optional `force` parameter to `reevaluateDeferred`:

```js
  async function reevaluateDeferred(force = false) {
    if (!force && isSilentMode()) return;
    // ... rest unchanged
  }
```

And in `getUpdateMenuItem`, call `reevaluateDeferred(true)` for the menu click.

- [ ] **Step 4: Add i18n string**

In `src/settings/i18n.js`:

en section (after `restartLater`):
```js
    updateAvailableMenu: "Update Available (v{version})",
```

zh section (after `restartLater`):
```js
    updateAvailableMenu: "有可用更新 (v{version})",
```

ko section (after `restartLater`):
```js
    updateAvailableMenu: "업데이트 가능 (v{version})",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/update/updater.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/update/updater.js src/settings/i18n.js test/update/updater.test.js
git commit -m "feat(updater): menu label shows available version"
```

---

### Task 5: Wire updater into main.js

**Files:**
- Modify: `src/core/main.js:1307-1334` (_updaterCtx + destructuring)
- Modify: `src/core/main.js:1124-1203` (settings subscriber)
- Modify: `src/core/main.js:2287` (setupAutoUpdater call)
- Modify: `src/core/main.js:2361-2380` (before-quit cleanup)

- [ ] **Step 1: Extend _updaterCtx**

In `src/core/main.js`, in the `_updaterCtx` object (around line 1307), add after the existing `resetSoundCooldown` line:

```js
  get autoCheckForUpdates() { return _settingsController.get("autoCheckForUpdates"); },
  getPendingUpdateVersion() { return _settingsController.get("pendingUpdateVersion"); },
  getUpdateSnoozeUntil() { return _settingsController.get("updateSnoozeUntil"); },
  savePendingState(partial) {
    try { _settingsController.applyBulk(partial); } catch (err) {
      console.warn("GitAnimals: savePendingState failed:", err && err.message);
    }
  },
```

- [ ] **Step 2: Update destructuring to include new functions**

Change the destructuring after `require("../update/updater")(_updaterCtx)`:

```js
const {
  setupAutoUpdater,
  checkForUpdates,
  getUpdateMenuItem,
  getUpdateMenuLabel,
  startScheduler,
  stopScheduler,
  reevaluateDeferred,
} = _updater;
```

- [ ] **Step 3: Wire startScheduler after setupAutoUpdater**

At line ~2287, change:

```js
    setupAutoUpdater();
```

To:

```js
    setupAutoUpdater();
    startScheduler();
```

- [ ] **Step 4: Wire stopScheduler into before-quit**

In the `app.on("before-quit")` handler, add `stopScheduler()` before the existing cleanup calls:

```js
    stopScheduler();
    _perm.cleanup();
```

- [ ] **Step 5: Add reevaluateDeferred calls in settings subscriber**

In the `_settingsController.subscribe(({ changes }) => { ... })` block, after the `hideBubbles` reactive side effect (around line 1177), add:

```js
    // Re-evaluate deferred update prompts when visibility conditions change
    if ("hideBubbles" in changes || "miniMode" in changes) {
      try { reevaluateDeferred(); } catch (err) {
        console.warn("GitAnimals: reevaluateDeferred failed:", err && err.message);
      }
    }
```

For DND changes — DND is set via `_stateCtx.doNotDisturb = v` (line 599, 1961), not through the settings controller. Find where DND is toggled off and add `reevaluateDeferred()` there. In the DND setter at line ~599 in `_stateCtx`:

```js
  set doNotDisturb(v) {
    doNotDisturb = v;
    if (!v) {
      try { reevaluateDeferred(); } catch (err) {
        console.warn("GitAnimals: reevaluateDeferred after DND off failed:", err && err.message);
      }
    }
  },
```

Apply the same pattern to the second DND setter at line ~1961 in `_miniCtx`:

```js
  set doNotDisturb(v) {
    doNotDisturb = v;
    if (!v) {
      try { reevaluateDeferred(); } catch (err) {
        console.warn("GitAnimals: reevaluateDeferred after DND off failed:", err && err.message);
      }
    }
  },
```

Note: `reevaluateDeferred` is defined after `_updaterCtx` (line ~1328), and `_stateCtx` is defined earlier (line ~580). Since `reevaluateDeferred` is a `const` from the destructured `_updater`, it will be hoisted as `undefined` at the point `_stateCtx` is created but will be populated by the time the setter actually runs (app is ready). This is safe because the setter is never called during module initialization.

- [ ] **Step 6: Handle mini mode exit**

The `exitMiniMode()` call originates from `_mini` module. After `exitMiniMode()` completes, mini mode is false. Add a `reevaluateDeferred()` call after the existing mini-exit paths. The cleanest point is in the subscriber — mini mode changes flow through `_settingsController.applyUpdate("miniMode", false)` which triggers the subscriber. The subscriber change in step 5 already handles `"miniMode" in changes`.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/main.js
git commit -m "feat(main): wire update scheduler and deferred prompt re-evaluation"
```

---

### Task 6: Settings UI toggle + i18n

**Files:**
- Modify: `src/settings/renderer.js:406-421` (Startup section)
- Modify: `src/settings/renderer.js:13-177` (STRINGS en/zh/ko)
- Modify: `src/settings/i18n.js` (menu i18n — already done in Task 4)

- [ ] **Step 1: Add i18n strings to renderer.js STRINGS**

In `src/settings/renderer.js`, in the `en` section after `rowStartWithClaudeDesc`:

```js
    rowAutoCheckUpdates: "Automatically check for updates",
    rowAutoCheckUpdatesDesc: "Check for new versions in the background every 12 hours.",
```

In the `zh` section after `rowStartWithClaudeDesc`:

```js
    rowAutoCheckUpdates: "自动检查更新",
    rowAutoCheckUpdatesDesc: "每 12 小时在后台检查新版本。",
```

In the `ko` section after `rowStartWithClaudeDesc`:

```js
    rowAutoCheckUpdates: "자동으로 업데이트 확인",
    rowAutoCheckUpdatesDesc: "12시간마다 백그라운드에서 새 버전을 확인해요.",
```

- [ ] **Step 2: Add ToggleRow in GeneralTab Startup section**

In `src/settings/renderer.js`, in the `GeneralTab` function, after the `rowStartWithClaude` ToggleRow (line ~420), add before the closing `)` of the Startup section:

```js
      ,h(ToggleRow, {
        label: t("rowAutoCheckUpdates"),
        desc: t("rowAutoCheckUpdatesDesc"),
        on: !!snapshot.autoCheckForUpdates,
        pending: !!pending.autoCheckForUpdates,
        onToggle: () => runUpdate("autoCheckForUpdates", "autoCheckForUpdates", !snapshot.autoCheckForUpdates),
      })
```

- [ ] **Step 3: Run app and verify visually**

Run: `npm start`
Open Settings → General → Startup section.
Verify: "Automatically check for updates" toggle appears below "Start with Claude Code", default ON.
Toggle it off and on, verify it persists after closing and reopening settings.

- [ ] **Step 4: Commit**

```bash
git add src/settings/renderer.js
git commit -m "feat(settings): add auto-check-for-updates toggle in General tab"
```

---

### Task 7: Clear pending on version match at startup

**Files:**
- Modify: `src/update/updater.js` (inside `checkForUpdates`)
- Test: `test/update/updater.test.js`

- [ ] **Step 1: Write failing test**

```js
describe("pending version cleanup", () => {
  it("clears pendingUpdateVersion when current version matches pending", async () => {
    const savedState = {};
    const ctx = makeCtx({
      showUpdateBubble: (p) => { return "dismiss"; },
      savePendingState(partial) { Object.assign(savedState, partial); },
      getPendingUpdateVersion: () => "0.5.10", // same as app version
      getUpdateSnoozeUntil: () => 0,
    });
    const updater = initUpdater(ctx, makeDeps({
      app: { isPackaged: true, getVersion: () => "0.5.10", relaunch() {}, exit() {} },
      httpsGetImpl: (options, cb) => {
        const res = {
          statusCode: 200,
          on(evt, fn) { if (evt === "data") fn(JSON.stringify({ tag_name: "v0.5.10" })); if (evt === "end") fn(); },
        };
        cb(res);
        return { on() {}, setTimeout() {} };
      },
    }));
    updater.setupAutoUpdater();
    await updater.checkForUpdates(false);

    assert.strictEqual(savedState.pendingUpdateVersion, "");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/update/updater.test.js`
Expected: FAIL

- [ ] **Step 3: Implement cleanup**

In `checkForUpdates()`, after the `compareVersions` check that determines the current version is up-to-date (`compareVersions(currentVersion, latestVersion) >= 0`), add:

```js
      // Clear stale pending if current version caught up
      if (pendingVersion || ctx.getPendingUpdateVersion()) {
        pendingVersion = "";
        ctx.savePendingState({ pendingUpdateVersion: "", updateSnoozeUntil: 0 });
      }
```

Also add `lastUpdateCheckAt` persistence at the top of `checkForUpdates()`, right after the early return for checking/downloading:

```js
    ctx.savePendingState({ lastUpdateCheckAt: Date.now() });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/update/updater.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/update/updater.js test/update/updater.test.js
git commit -m "feat(updater): clear stale pending version on startup check"
```

---

### Task 8: Full regression test

**Files:**
- Test: `test/update/updater.test.js`

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: all 28+ test files PASS

- [ ] **Step 2: Verify manual check still works**

Run: `npm start`
Right-click pet → "Check for Updates" → verify the existing manual flow works unchanged.

- [ ] **Step 3: Verify menu label in available state**

Use curl to trigger a state check, or temporarily set `STARTUP_DELAY = 3000` for testing.
When an update is available, verify tray/context menu shows "Update Available (v{version})".

- [ ] **Step 4: Commit any test fixes**

If any adjustments were needed:

```bash
git add -A
git commit -m "test: fix regression tests for update discovery"
```
