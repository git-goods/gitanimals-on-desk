const https = require("https");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const electron = require("electron");
const { bc, report } = (() => {
  try { return require("../core/telemetry"); } catch { return { bc() {}, report() {} }; }
})();

function makeTranslate(ctx) {
  return (key, fallback) => {
    const value = typeof ctx.t === "function" ? ctx.t(key) : key;
    if (value && value !== key) return value;
    return fallback != null ? fallback : key;
  };
}

function compareVersions(v1, v2) {
  const parts1 = String(v1).replace(/^v/, "").split(".").map(Number);
  const parts2 = String(v2).replace(/^v/, "").split(".").map(Number);
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

function isUpdate404Error(err) {
  return !!(err && (
    err.code === "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND" ||
    String(err.message || "").includes("404") ||
    String(err.message || "").includes("Cannot find latest.yml")
  ));
}

function getErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  return String(err.message || err).trim() || "Unknown error";
}

function classifyFailureType(reason, fallback = "Update Failed") {
  const text = String(reason || "").toLowerCase();
  if (text.includes("dirty worktree") || text.includes("uncommitted") || text.includes("modified")) return "Dirty Worktree";
  if (text.includes("timed out") || text.includes("network") || text.includes("github api")) return "Network Error";
  if (text.includes("npm install")) return "Dependency Install Failed";
  if (text.includes("git pull")) return "Git Pull Failed";
  if (text.includes("download")) return "Update Download Failed";
  if (text.includes("autoupdater")) return "Updater Unavailable";
  return fallback;
}

function buildErrorDetail({ failureType, operation, reason, nextStep, detail }) {
  const lines = [];
  if (failureType) lines.push(`Failure Type: ${failureType}`);
  if (operation) lines.push(`Operation: ${operation}`);
  if (reason) lines.push(`Reason: ${reason}`);
  if (nextStep) lines.push(`Next Step: ${nextStep}`);
  if (detail && detail !== reason) {
    lines.push("");
    lines.push(detail);
  }
  return lines.join("\n").trim();
}

function initUpdater(ctx, deps = {}) {
  const app = deps.app || electron.app;
  const httpsGet = deps.httpsGetImpl || https.get;
  const execFileFn = deps.execFileImpl || execFile;
  const fsApi = deps.fsImpl || fs;
  const t = makeTranslate(ctx);

  let pendingVersion =
    (typeof ctx.getPendingUpdateVersion === "function" && ctx.getPendingUpdateVersion()) || "";
  let updateStatus = pendingVersion ? "available" : "idle";
  let manualUpdateCheck = false;
  let manualUpdateSource = "default";
  let repoRootCache;
  let autoUpdaterInstance = null;
  let overlayKind = null;
  let latestVersion = pendingVersion || "";
  let lastError = "";

  function getLastCheckedAt() {
    return typeof ctx.getLastUpdateCheckAt === "function"
      ? ctx.getLastUpdateCheckAt() || 0
      : 0;
  }

  function getUpdateState() {
    const repoRoot = getRepoRoot();
    return {
      status: updateStatus,
      currentVersion: app.getVersion(),
      latestVersion,
      pendingVersion,
      lastCheckedAt: getLastCheckedAt(),
      lastError,
      canCheck: updateStatus !== "checking" && updateStatus !== "downloading",
      canApplyUpdate: updateStatus === "available",
      canRestartToUpdate: updateStatus === "ready",
      flow: repoRoot ? "git" : "auto-updater",
      isPackaged: !!app.isPackaged,
    };
  }

  function emitUpdateStateChanged() {
    if (typeof ctx.onUpdateStateChanged === "function") {
      ctx.onUpdateStateChanged(getUpdateState());
    }
  }

  function setUpdateStatus(next) {
    if (updateStatus === next) return;
    updateStatus = next;
    emitUpdateStateChanged();
  }

  function setLatestVersion(version) {
    const next = version || "";
    if (latestVersion === next) return;
    latestVersion = next;
    emitUpdateStateChanged();
  }

  function setPendingVersion(version) {
    const next = version || "";
    const statusChanged = pendingVersion !== next;
    pendingVersion = next;
    latestVersion = next;
    if (statusChanged) emitUpdateStateChanged();
  }

  function clearPendingVersion() {
    const hadValue = pendingVersion || latestVersion;
    pendingVersion = "";
    latestVersion = "";
    if (hadValue) emitUpdateStateChanged();
  }

  function setLastError(message) {
    const next = message || "";
    if (lastError === next) return;
    lastError = next;
    emitUpdateStateChanged();
  }

  function persistPendingState(partial) {
    if (typeof ctx.savePendingState === "function") {
      ctx.savePendingState(partial);
    }
    emitUpdateStateChanged();
  }

  function rebuildMenus() {
    if (typeof ctx.rebuildAllMenus === "function") ctx.rebuildAllMenus();
  }

  function log(message) {
    console.log(`[updater] ${message}`);
    if (typeof ctx.updateLog === "function") ctx.updateLog(message);
  }

  function renderResolvedState() {
    if (typeof ctx.applyState === "function" && typeof ctx.resolveDisplayState === "function") {
      const resolved = ctx.resolveDisplayState();
      const svgOverride = typeof ctx.getSvgOverride === "function" ? ctx.getSvgOverride(resolved) : null;
      ctx.applyState(resolved, svgOverride);
    }
  }

  function setOverlay(kind) {
    if (overlayKind === kind) return;
    overlayKind = kind || null;
    if (typeof ctx.setUpdateVisualState === "function") ctx.setUpdateVisualState(overlayKind);
    renderResolvedState();
  }

  function clearOverlay() {
    setOverlay(null);
  }

  function pulseState(state) {
    clearOverlay();
    if (typeof ctx.applyState === "function") ctx.applyState(state);
  }

  function pulseSuccessState() {
    if (typeof ctx.resetSoundCooldown === "function") ctx.resetSoundCooldown();
    pulseState("attention");
  }

  function showDialog(payload) {
    if (typeof ctx.showUpdateDialog !== "function") {
      return Promise.resolve(payload.defaultAction != null ? payload.defaultAction : null);
    }
    return ctx.showUpdateDialog(payload);
  }

  function hideBubble() {
    // system dialogs close themselves — noop
  }

  function isSilentMode() {
    return !!ctx.doNotDisturb || !!ctx.miniMode;
  }

  function dismissToResolvedState() {
    hideBubble();
    clearOverlay();
    rebuildMenus();
  }

  function showInfoBubble(mode, title, message, extra = {}) {
    log(`${mode}: ${message}`);
    if (mode === "checking" || mode === "downloading") return Promise.resolve(null);
    return showDialog({
      mode,
      title,
      message,
      detail: extra.detail || "",
      version: extra.version || "",
      actions: extra.actions || [],
      defaultAction: extra.defaultAction != null ? extra.defaultAction : null,
      lang: ctx.lang || "en",
      requireAction: !!extra.requireAction,
    });
  }

  async function showErrorBubble(detailOrReport, messageOverride = null) {
    const report = typeof detailOrReport === "object" && detailOrReport !== null && !Array.isArray(detailOrReport)
      ? detailOrReport
      : { detail: detailOrReport, message: messageOverride };
    const reason = report.reason || getErrorMessage(report.detail);
    const detail = buildErrorDetail({
      failureType: report.failureType || classifyFailureType(reason),
      operation: report.operation || "Check for Updates",
      reason,
      nextStep: report.nextStep || "",
      detail: typeof report.detail === "string" ? report.detail : "",
    });
    pulseState("error");
    return showDialog({
      mode: "error",
      title: t("updateError", "Update Error"),
      message: report.message || t("updateErrorMsg", "Failed to check for updates. Please try again later."),
      detail,
      actions: [
        { id: "dismiss", label: t("dismiss", "Dismiss"), variant: "secondary" },
      ],
      defaultAction: "dismiss",
      lang: ctx.lang || "en",
      requireAction: true,
    });
  }

  async function showUpToDateBubble(version) {
    clearOverlay();
    return showInfoBubble(
      "up-to-date",
      t("updateNotAvailable", "You're Up to Date"),
      t("updateNotAvailableMsg", "GitAnimals v{version} is the latest version.").replace("{version}", version),
      {
        version,
        actions: [{ id: "dismiss", label: t("dismiss", "Dismiss"), variant: "secondary" }],
        defaultAction: "dismiss",
      }
    );
  }

  async function showSuccessBubble({ title, message, version = "", actions = [], defaultAction = null, requireAction = false }) {
    pulseSuccessState();
    return showDialog({
      mode: "ready",
      title,
      message,
      version,
      detail: "",
      actions,
      defaultAction,
      lang: ctx.lang || "en",
      requireAction,
    });
  }

  function getRepoRoot() {
    if (repoRootCache !== undefined) return repoRootCache;
    if (app.isPackaged) {
      repoRootCache = null;
      return repoRootCache;
    }
    const root = path.join(__dirname, "../..");
    try {
      if (fsApi.statSync(path.join(root, ".git")).isDirectory()) {
        repoRootCache = root;
        return repoRootCache;
      }
    } catch {}
    repoRootCache = null;
    return repoRootCache;
  }

  function gitCmd(args, cwd, timeout = 30000) {
    return new Promise((resolve, reject) => {
      execFileFn("git", args, { cwd, timeout }, (err, stdout) => {
        if (err) reject(err);
        else resolve(String(stdout || "").trim());
      });
    });
  }

  function fetchLatestVersion() {
    return new Promise((resolve, reject) => {
      const req = httpsGet({
        hostname: "api.github.com",
        path: "/repos/git-goods/gitanimals-on-desk/releases/latest",
        headers: { "User-Agent": "GitAnimals-on-Desk" },
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            if (res.statusCode === 404) return reject(new Error("No releases found"));
            return reject(new Error(`GitHub API returned ${res.statusCode}`));
          }
          try {
            const release = JSON.parse(data);
            if (!release.tag_name) return reject(new Error("No tag_name in release"));
            resolve(release.tag_name);
          } catch (err) {
            reject(new Error(`Failed to parse GitHub response: ${err.message}`));
          }
        });
      });

      if (req && typeof req.on === "function") req.on("error", reject);
      if (req && typeof req.setTimeout === "function") {
        req.setTimeout(10000, () => {
          if (typeof req.destroy === "function") req.destroy();
          reject(new Error("GitHub API request timed out (10s)"));
        });
      }
    });
  }

  function getAutoUpdater() {
    if (autoUpdaterInstance) return autoUpdaterInstance;
    try {
      autoUpdaterInstance = deps.autoUpdaterFactory
        ? deps.autoUpdaterFactory()
        : require("electron-updater").autoUpdater;
      autoUpdaterInstance.autoDownload = false;
      autoUpdaterInstance.autoInstallOnAppQuit = true;
      return autoUpdaterInstance;
    } catch (err) {
      log(`ERROR: electron-updater load failed: ${err.message}`);
      return null;
    }
  }

  async function promptAvailableUpdate({ mode, version, onPrimary }) {
    const primaryLabel = mode === "git"
      ? t("updateNow", "Update Now")
      : t("download", "Download");
    const action = await showDialog({
      mode: "available",
      title: t("updateAvailable", "Update Available"),
      message: t("updateAvailableMsg", "v{version} is available. Download and install now?")
        .replace("{version}", version),
      version,
      actions: [
        { id: "primary", label: primaryLabel, variant: "primary" },
        { id: "later", label: t("restartLater", "Later"), variant: "secondary" },
      ],
      defaultAction: "later",
      lang: ctx.lang || "en",
      requireAction: true,
    });

    if (action === "primary") return onPrimary();
    const SNOOZE_DURATION = 24 * 60 * 60 * 1000;
    setPendingVersion(version);
    persistPendingState({
      pendingUpdateVersion: version,
      updateSnoozeUntil: Date.now() + SNOOZE_DURATION,
    });
    hideBubble();
    dismissToResolvedState();
    setUpdateStatus("available");
    rebuildMenus();
    manualUpdateCheck = false;
    manualUpdateSource = "default";
    return null;
  }

  async function promptReadyUpdate(version, onPrimary) {
    pulseSuccessState();
    const action = await showDialog({
      mode: "ready",
      title: t("updateReady", "Update Ready"),
      message: t("updateReadyMsg", "v{version} has been downloaded. Restart now to update?").replace("{version}", version),
      version,
      actions: [
        { id: "primary", label: t("restartNow", "Restart Now"), variant: "primary" },
        { id: "later", label: t("restartLater", "Later"), variant: "secondary" },
      ],
      defaultAction: "later",
      lang: ctx.lang || "en",
      requireAction: true,
    });

    if (action === "primary") return onPrimary();
    hideBubble();
    dismissToResolvedState();
    setUpdateStatus("ready");
    rebuildMenus();
    return null;
  }

  async function reevaluateDeferred(force = false) {
    if (!force && isSilentMode()) return;
    if (updateStatus === "checking" || updateStatus === "downloading") return;

    const pending = pendingVersion || (typeof ctx.getPendingUpdateVersion === "function" ? ctx.getPendingUpdateVersion() : "");
    if (!pending) return;

    const snoozeUntil = typeof ctx.getUpdateSnoozeUntil === "function" ? ctx.getUpdateSnoozeUntil() : 0;
    if (snoozeUntil && Date.now() < snoozeUntil) return;

    setPendingVersion(pending);
    setUpdateStatus("available");
    rebuildMenus();

    const repoRoot = getRepoRoot();
    try {
      await promptAvailableUpdate({
        mode: repoRoot ? "git" : "win",
        version: pending,
        onPrimary: async () => {
          if (repoRoot) {
            const branch = await gitCmd(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
            const localHead = await gitCmd(["rev-parse", "HEAD"], repoRoot);
            const dirty = await gitCmd(["status", "--porcelain"], repoRoot);
            if (dirty) {
              setUpdateStatus("error");
              rebuildMenus();
              clearOverlay();
              setLastError("Local files have uncommitted changes.");
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
            setLastError("");
            setUpdateStatus("downloading");
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
    } catch (err) {
      setUpdateStatus("error");
      hideBubble();
      clearOverlay();
      rebuildMenus();
      setLastError(getErrorMessage(err));
      log(`ERROR: reevaluateDeferred: ${err.message}`);
    }
  }

  async function runGitUpdate(repoRoot, branch, localHead) {
    setLastError("");
    setUpdateStatus("downloading");
    setOverlay("downloading");
    rebuildMenus();
    await showInfoBubble(
      "downloading",
      t("updating", "Updating..."),
      t("updateDownloading", "Downloading Update...")
    );

    try {
      await gitCmd(["pull", "origin", branch], repoRoot, 60000);
    } catch (err) {
      err.updateOperation = "Apply Git Update";
      err.updateFailureType = "Git Pull Failed";
      err.updateNextStep = "Resolve the Git error, then try the update again.";
      throw err;
    }
    const diff = await gitCmd(["diff", "--name-only", localHead, "HEAD"], repoRoot);
    if (diff.includes("package.json") || diff.includes("package-lock.json")) {
      try {
        await new Promise((resolve, reject) => {
          execFileFn("npm", ["install", "--no-fund", "--no-audit"], {
            cwd: repoRoot,
            timeout: 120000,
            shell: process.platform === "win32",
          }, (err) => (err ? reject(err) : resolve()));
        });
      } catch (err) {
        err.updateOperation = "Install Updated Dependencies";
        err.updateFailureType = "Dependency Install Failed";
        err.updateNextStep = "Fix the npm install error, then try the update again.";
        throw err;
      }
    }

    await showSuccessBubble({
      title: t("updateReady", "Update Ready"),
      message: t("gitUpdateRestarting", "Update complete. Restarting now..."),
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    hideBubble();
    app.relaunch();
    app.exit(0);
  }

  async function gitCheckForUpdates(repoRoot, options) {
    log(`gitCheckForUpdates: repoRoot=${repoRoot}, manual=${options.manual}, source=${options.source}`);
    setLastError("");
    setUpdateStatus("checking");
    manualUpdateCheck = options.manual;
    manualUpdateSource = options.source;
    setOverlay("checking");
    rebuildMenus();
    if (options.source !== "settings") {
      await showInfoBubble(
        "checking",
        t("checkForUpdates", "Check for Updates"),
        t("checkingForUpdates", "Checking for Updates...")
      );
    }

    try {
      const branch = await gitCmd(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
      await gitCmd(["fetch", "origin", branch], repoRoot);

      const localHead = await gitCmd(["rev-parse", "HEAD"], repoRoot);
      const remoteHead = await gitCmd(["rev-parse", `origin/${branch}`], repoRoot);

      if (localHead === remoteHead) {
        if (pendingVersion || (typeof ctx.getPendingUpdateVersion === "function" && ctx.getPendingUpdateVersion())) {
          clearPendingVersion();
          persistPendingState({ pendingUpdateVersion: "", updateSnoozeUntil: 0 });
        }
        setLatestVersion(app.getVersion());
        setUpdateStatus("idle");
        manualUpdateCheck = false;
        manualUpdateSource = "default";
        rebuildMenus();
        if (options.manual && options.source !== "settings") await showUpToDateBubble(app.getVersion());
        else if (options.source !== "settings") dismissToResolvedState();
        else clearOverlay();
        return;
      }

      let remoteVersion;
      try {
        const remotePkg = await gitCmd(["show", `origin/${branch}:package.json`], repoRoot);
        remoteVersion = JSON.parse(remotePkg).version;
      } catch {
        remoteVersion = remoteHead.slice(0, 8);
      }

      setPendingVersion(remoteVersion);
      setUpdateStatus("available");
      rebuildMenus();

      if (!options.manual && isSilentMode()) {
        persistPendingState({
          pendingUpdateVersion: remoteVersion,
          lastUpdateCheckAt: Date.now(),
        });
        hideBubble();
        dismissToResolvedState();
        rebuildMenus();
        manualUpdateCheck = false;
        manualUpdateSource = "default";
        return;
      }

      if (options.source === "settings") {
        manualUpdateCheck = false;
        manualUpdateSource = "default";
        clearOverlay();
        rebuildMenus();
        return;
      }

      await promptAvailableUpdate({
        mode: "git",
        version: remoteVersion,
        onPrimary: async () => {
          const dirty = await gitCmd(["status", "--porcelain"], repoRoot);
          if (dirty) {
            setUpdateStatus("error");
            manualUpdateCheck = false;
            manualUpdateSource = "default";
            rebuildMenus();
            clearOverlay();
            setLastError("Local files have uncommitted changes.");
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
        },
      });
    } catch (err) {
      setUpdateStatus("error");
      manualUpdateCheck = false;
      manualUpdateSource = "default";
      rebuildMenus();
      clearOverlay();
      setLastError(getErrorMessage(err));
      if (options.manual && options.source !== "settings") {
        await showErrorBubble({
          failureType: err.updateFailureType,
          operation: err.updateOperation || "Check for Updates",
          reason: getErrorMessage(err),
          nextStep: err.updateNextStep || "",
          detail: getErrorMessage(err),
        });
      }
    }
  }

  function setupAutoUpdater() {
    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) return;

    autoUpdater.on("update-available", async (info) => {
      log(`autoUpdater: update-available v${info && info.version}`);
      try { bc("updater", "update-available", { version: info && info.version }); } catch {}
      const wasManual = manualUpdateCheck;
      const source = manualUpdateSource;
      manualUpdateCheck = false;
      manualUpdateSource = "default";
      setPendingVersion(info.version);
      setLastError("");
      setUpdateStatus("available");
      rebuildMenus();

      if (!wasManual && isSilentMode()) {
        persistPendingState({
          pendingUpdateVersion: info.version,
          lastUpdateCheckAt: Date.now(),
        });
        rebuildMenus();
        dismissToResolvedState();
        return;
      }

      if (source === "settings") {
        clearOverlay();
        return;
      }

      await promptAvailableUpdate({
        mode: "win",
        version: info.version,
        onPrimary: async () => {
          setLastError("");
          setUpdateStatus("downloading");
          setOverlay("downloading");
          rebuildMenus();
          await showInfoBubble(
            "downloading",
            t("updateDownloading", "Downloading Update..."),
            t("updateDownloading", "Downloading Update...")
          );
          autoUpdater.downloadUpdate();
        },
      });
    });

    autoUpdater.on("update-not-available", async () => {
      if (pendingVersion || (typeof ctx.getPendingUpdateVersion === "function" && ctx.getPendingUpdateVersion())) {
        clearPendingVersion();
        persistPendingState({ pendingUpdateVersion: "", updateSnoozeUntil: 0 });
      }
      setLatestVersion(app.getVersion());
      setUpdateStatus("idle");
      rebuildMenus();
      log("autoUpdater: update-not-available");
      if (manualUpdateCheck) {
        manualUpdateCheck = false;
        const source = manualUpdateSource;
        manualUpdateSource = "default";
        if (source !== "settings") await showUpToDateBubble(app.getVersion());
        else clearOverlay();
        return;
      }
      manualUpdateSource = "default";
      dismissToResolvedState();
    });

    autoUpdater.on("update-downloaded", async (info) => {
      try { bc("updater", "update-downloaded", { version: info && info.version }); } catch {}
      setPendingVersion(info.version);
      setLastError("");
      setUpdateStatus("ready");
      rebuildMenus();
      clearOverlay();
      await promptReadyUpdate(info.version, async () => {
        autoUpdater.quitAndInstall(false, true);
      });
    });

    autoUpdater.on("error", async (err) => {
      log(`ERROR: AutoUpdater error: ${err.message}`);
      try { report("[updater] error", "error", { message: err && err.message, code: err && err.code, status: updateStatus }); } catch {}
      const shouldShowErrorBubble = manualUpdateCheck || updateStatus === "downloading";
      const failedWhileDownloading = updateStatus === "downloading";
      const source = manualUpdateSource;
      if (!shouldShowErrorBubble) {
        setUpdateStatus("error");
        rebuildMenus();
        clearOverlay();
        manualUpdateSource = "default";
        setLastError(getErrorMessage(err));
        return;
      }

      manualUpdateCheck = false;
      manualUpdateSource = "default";
      if (isUpdate404Error(err)) {
        setLatestVersion(app.getVersion());
        setUpdateStatus("idle");
        rebuildMenus();
        if (source !== "settings") await showUpToDateBubble(app.getVersion());
        else clearOverlay();
      } else {
        setUpdateStatus("error");
        rebuildMenus();
        clearOverlay();
        setLastError(getErrorMessage(err));
        if (source !== "settings") {
          await showErrorBubble({
            failureType: classifyFailureType(err.message),
            operation: failedWhileDownloading ? "Download Update" : "Check for Updates",
            reason: getErrorMessage(err),
            nextStep: failedWhileDownloading
              ? "Check your network connection and try downloading again."
              : "Check your network connection and try again.",
            detail: getErrorMessage(err),
          });
        }
      }
    });
  }

  async function simulateUpdate(simMode) {
    log(`simulateUpdate: mode=${simMode}`);
    const simVersion = "v99.0.0";
    manualUpdateCheck = true;
    manualUpdateSource = "default";
    setLastError("");
    setPendingVersion(simVersion);
    setUpdateStatus("checking");
    setOverlay("checking");
    rebuildMenus();
    await showInfoBubble("checking", t("checkForUpdates", "Check for Updates"), t("checkingForUpdates", "Checking for Updates..."));
    await new Promise((r) => setTimeout(r, 800));

    if (simMode === "error") {
      setUpdateStatus("error");
      rebuildMenus();
      clearOverlay();
      setLastError("[Simulated] GitHub API request timed out (10s)");
      await showErrorBubble({
        failureType: "Network Error",
        operation: "Check for Updates",
        reason: "[Simulated] GitHub API request timed out (10s)",
        nextStep: "This is a simulated error for dev testing.",
        detail: "[DEV_SIMULATE_UPDATE=error] Simulated network failure",
      });
      return;
    }

    if (simMode === "ready") {
      setUpdateStatus("ready");
      rebuildMenus();
      clearOverlay();
      await promptReadyUpdate(simVersion, async () => {
        log("DEV: Simulated restart (no actual relaunch)");
        await showSuccessBubble({
          title: "Simulated Restart",
          message: "In production, the app would restart now.",
          version: simVersion,
        });
      });
      return;
    }

    setUpdateStatus("available");
    rebuildMenus();
    await promptAvailableUpdate({
      mode: "win",
      version: simVersion,
      onPrimary: async () => {
        setUpdateStatus("downloading");
        setOverlay("downloading");
        rebuildMenus();
        await showInfoBubble("downloading", t("updateDownloading", "Downloading Update..."), t("updateDownloading", "Downloading Update..."));
        await new Promise((r) => setTimeout(r, 1500));
        setUpdateStatus("ready");
        rebuildMenus();
        clearOverlay();
        await promptReadyUpdate(simVersion, async () => {
          log("DEV: Simulated restart (no actual relaunch)");
          await showSuccessBubble({
            title: "Simulated Restart",
            message: "In production, the app would restart now.",
            version: simVersion,
          });
        });
      },
    });
  }

  async function checkForUpdates(manual = false) {
    const options =
      manual && typeof manual === "object"
        ? { manual: !!manual.manual, source: manual.source || "default" }
        : { manual: !!manual, source: "default" };
    log(`checkForUpdates: manual=${options.manual}, source=${options.source}, packaged=${app.isPackaged}`);
    if (updateStatus === "checking" || updateStatus === "downloading") {
      log(`Check skipped: already ${updateStatus}`);
      return;
    }

    const simMode = !app.isPackaged && process.env.DEV_SIMULATE_UPDATE;
    if (simMode) return simulateUpdate(simMode);

    persistPendingState({ lastUpdateCheckAt: Date.now() });

    const repoRoot = getRepoRoot();
    if (repoRoot) return gitCheckForUpdates(repoRoot, options);

    manualUpdateCheck = options.manual;
    manualUpdateSource = options.source;
    setLastError("");
    setUpdateStatus("checking");
    setOverlay("checking");
    rebuildMenus();
    if (options.source !== "settings") {
      await showInfoBubble(
        "checking",
        t("checkForUpdates", "Check for Updates"),
        t("checkingForUpdates", "Checking for Updates...")
      );
    }

    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) {
      setUpdateStatus("error");
      manualUpdateCheck = false;
      manualUpdateSource = "default";
      rebuildMenus();
      clearOverlay();
      setLastError("AutoUpdater not available");
      if (options.manual && options.source !== "settings") {
        await showErrorBubble({
          failureType: "Updater Unavailable",
          operation: "Check for Updates",
          reason: "AutoUpdater not available",
          nextStep: "Restart GitAnimals or reinstall the packaged app, then try again.",
          detail: "AutoUpdater not available",
        });
      } else {
        hideBubble();
      }
      return;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        setLatestVersion(app.getVersion());
        setUpdateStatus("idle");
        manualUpdateCheck = false;
        manualUpdateSource = "default";
        rebuildMenus();
        if (options.source !== "settings") dismissToResolvedState();
        else clearOverlay();
      }
    } catch (err) {
      if (isUpdate404Error(err)) {
        setLatestVersion(app.getVersion());
        setUpdateStatus("idle");
        manualUpdateCheck = false;
        manualUpdateSource = "default";
        rebuildMenus();
        if (options.manual && options.source !== "settings") await showUpToDateBubble(app.getVersion());
        else if (options.source !== "settings") dismissToResolvedState();
        else clearOverlay();
      } else {
        setUpdateStatus("error");
        manualUpdateCheck = false;
        manualUpdateSource = "default";
        rebuildMenus();
        clearOverlay();
        setLastError(getErrorMessage(err));
        if (options.manual && options.source !== "settings") {
          await showErrorBubble({
            failureType: classifyFailureType(err.message),
            operation: "Check for Updates",
            reason: getErrorMessage(err),
            nextStep: "Check your network connection and try again.",
            detail: getErrorMessage(err),
          });
        } else if (options.source !== "settings") {
          hideBubble();
        }
      }
    }
  }

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

  async function applyUpdateFromSettings() {
    if (updateStatus === "checking" || updateStatus === "downloading") return;
    const repoRoot = getRepoRoot();
    setLastError("");
    if (repoRoot) {
      const branch = await gitCmd(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
      const localHead = await gitCmd(["rev-parse", "HEAD"], repoRoot);
      const dirty = await gitCmd(["status", "--porcelain"], repoRoot);
      if (dirty) {
        setUpdateStatus("error");
        setLastError("Local files have uncommitted changes.");
        rebuildMenus();
        return;
      }
      await runGitUpdate(repoRoot, branch, localHead);
      return;
    }

    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) {
      setUpdateStatus("error");
      setLastError("AutoUpdater not available");
      rebuildMenus();
      return;
    }
    setUpdateStatus("downloading");
    setOverlay("downloading");
    rebuildMenus();
    autoUpdater.downloadUpdate();
  }

  async function restartToUpdateFromSettings() {
    if (updateStatus !== "ready") return;
    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) {
      setUpdateStatus("error");
      setLastError("AutoUpdater not available");
      rebuildMenus();
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  }

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

  function getUpdateMenuItem() {
    return {
      label: getUpdateMenuLabel(),
      enabled: updateStatus !== "checking" && updateStatus !== "downloading",
      click: () => {
        if (updateStatus === "ready") {
          const au = getAutoUpdater();
          if (au) au.quitAndInstall(false, true);
        } else if (updateStatus === "available" && pendingVersion) {
          reevaluateDeferred(true);
        } else {
          checkForUpdates(true);
        }
      },
    };
  }

  return {
    setupAutoUpdater,
    checkForUpdates,
    getUpdateMenuItem,
    getUpdateMenuLabel,
    startScheduler,
    stopScheduler,
    reevaluateDeferred,
    getUpdateState,
    applyUpdateFromSettings,
    restartToUpdateFromSettings,
  };
}

module.exports = initUpdater;
module.exports.__test = {
  compareVersions,
  isUpdate404Error,
};
