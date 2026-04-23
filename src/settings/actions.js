"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandRegistry = exports.updateRegistry = void 0;
exports.requireBoolean = requireBoolean;
exports.requireFiniteNumber = requireFiniteNumber;
exports.requireEnum = requireEnum;
exports.requireString = requireString;
exports.requirePlainObject = requirePlainObject;
const prefs_1 = require("./prefs");
function requireBoolean(key) {
    return function (value) {
        if (typeof value !== "boolean") {
            return { status: "error", message: `${key} must be a boolean` };
        }
        return { status: "ok" };
    };
}
function requireFiniteNumber(key) {
    return function (value) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return { status: "error", message: `${key} must be a finite number` };
        }
        return { status: "ok" };
    };
}
function requireEnum(key, allowed) {
    return function (value) {
        if (!allowed.includes(String(value))) {
            return {
                status: "error",
                message: `${key} must be one of: ${allowed.join(", ")}`,
            };
        }
        return { status: "ok" };
    };
}
function requireString(key, { allowEmpty = false } = {}) {
    return function (value) {
        if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
            return { status: "error", message: `${key} must be a non-empty string` };
        }
        return { status: "ok" };
    };
}
function requirePlainObject(key) {
    return function (value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return { status: "error", message: `${key} must be a plain object` };
        }
        return { status: "ok" };
    };
}
exports.updateRegistry = {
    x: requireFiniteNumber("x"),
    y: requireFiniteNumber("y"),
    size(value) {
        if (typeof value !== "string") {
            return { status: "error", message: "size must be a string" };
        }
        if (value === "S" || value === "M" || value === "L")
            return { status: "ok" };
        if (/^P:\d+(?:\.\d+)?$/.test(value))
            return { status: "ok" };
        return {
            status: "error",
            message: `size must be S/M/L or P:<num>, got: ${value}`,
        };
    },
    miniMode: requireBoolean("miniMode"),
    miniEdge: requireEnum("miniEdge", ["left", "right"]),
    preMiniX: requireFiniteNumber("preMiniX"),
    preMiniY: requireFiniteNumber("preMiniY"),
    positionSaved: requireBoolean("positionSaved"),
    lang: requireEnum("lang", ["en", "zh", "ko"]),
    soundMuted: requireBoolean("soundMuted"),
    flip: requireBoolean("flip"),
    autoCheckForUpdates: requireBoolean("autoCheckForUpdates"),
    lastUpdateCheckAt: requireFiniteNumber("lastUpdateCheckAt"),
    updateSnoozeUntil: requireFiniteNumber("updateSnoozeUntil"),
    pendingUpdateVersion: requireString("pendingUpdateVersion", { allowEmpty: true }),
    bubbleFollowPet: requireBoolean("bubbleFollowPet"),
    hideBubbles: requireBoolean("hideBubbles"),
    showSessionId: requireBoolean("showSessionId"),
    sendDiagnostics: {
        validate: requireBoolean("sendDiagnostics"),
        effect(value, deps) {
            if (!deps || typeof deps.setTelemetryEnabled !== "function") {
                return { status: "ok" };
            }
            try {
                deps.setTelemetryEnabled(value);
                return { status: "ok" };
            }
            catch (err) {
                return { status: "error", message: `sendDiagnostics: ${err?.message}` };
            }
        },
    },
    autoStartWithClaude: {
        validate: requireBoolean("autoStartWithClaude"),
        effect(value, deps) {
            if (!deps ||
                typeof deps.installAutoStart !== "function" ||
                typeof deps.uninstallAutoStart !== "function") {
                return {
                    status: "error",
                    message: "autoStartWithClaude effect requires installAutoStart/uninstallAutoStart deps",
                };
            }
            try {
                if (value)
                    deps.installAutoStart();
                else
                    deps.uninstallAutoStart();
                return { status: "ok" };
            }
            catch (err) {
                return {
                    status: "error",
                    message: `autoStartWithClaude: ${err?.message}`,
                };
            }
        },
    },
    openAtLogin: {
        validate: requireBoolean("openAtLogin"),
        effect(value, deps) {
            if (!deps || typeof deps.setOpenAtLogin !== "function") {
                return {
                    status: "error",
                    message: "openAtLogin effect requires setOpenAtLogin dep",
                };
            }
            try {
                deps.setOpenAtLogin(value);
                return { status: "ok" };
            }
            catch (err) {
                return {
                    status: "error",
                    message: `openAtLogin: ${err?.message}`,
                };
            }
        },
    },
    openAtLoginHydrated: requireBoolean("openAtLoginHydrated"),
    showTray(value, { snapshot }) {
        if (typeof value !== "boolean") {
            return { status: "error", message: "showTray must be a boolean" };
        }
        if (!value && snapshot && snapshot.showDock === false) {
            return {
                status: "error",
                message: "Cannot hide Menu Bar while Dock is also hidden — GitAnimals would become unquittable.",
            };
        }
        return { status: "ok" };
    },
    showDock(value, { snapshot }) {
        if (typeof value !== "boolean") {
            return { status: "error", message: "showDock must be a boolean" };
        }
        if (!value && snapshot && snapshot.showTray === false) {
            return {
                status: "error",
                message: "Cannot hide Dock while Menu Bar is also hidden — GitAnimals would become unquittable.",
            };
        }
        return { status: "ok" };
    },
    theme: requireString("theme"),
    agents: requirePlainObject("agents"),
    themeOverrides: requirePlainObject("themeOverrides"),
    pinnedThemes: requirePlainObject("pinnedThemes"),
    version(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
            return { status: "error", message: "version must be a positive number" };
        }
        if (value > prefs_1.CURRENT_VERSION) {
            return {
                status: "error",
                message: `version ${value} is newer than supported (${prefs_1.CURRENT_VERSION})`,
            };
        }
        return { status: "ok" };
    },
};
function notImplemented(name) {
    return function () {
        return {
            status: "error",
            message: `${name}: not implemented yet (Phase 0 stub)`,
        };
    };
}
const _validateAgentFlagId = requireString("setAgentFlag.agentId");
const _validateAgentFlagValue = requireBoolean("setAgentFlag.value");
function setAgentFlag(payload, deps) {
    if (!payload || typeof payload !== "object") {
        return { status: "error", message: "setAgentFlag: payload must be an object" };
    }
    const { agentId, flag, value } = payload;
    const idCheck = _validateAgentFlagId(agentId);
    if (idCheck.status !== "ok")
        return idCheck;
    if (typeof flag !== "string" || !prefs_1.AGENT_FLAGS.includes(flag)) {
        return {
            status: "error",
            message: `setAgentFlag.flag must be one of: ${prefs_1.AGENT_FLAGS.join(", ")}`,
        };
    }
    const valueCheck = _validateAgentFlagValue(value);
    if (valueCheck.status !== "ok")
        return valueCheck;
    const snapshot = deps && deps.snapshot;
    const currentAgents = (snapshot && snapshot.agents) || {};
    const currentEntry = currentAgents[agentId];
    const currentValue = currentEntry && typeof currentEntry[flag] === "boolean" ? currentEntry[flag] : true;
    if (currentValue === value) {
        return { status: "ok", noop: true };
    }
    try {
        if (flag === "enabled") {
            if (!value) {
                if (typeof deps.stopMonitorForAgent === "function")
                    deps.stopMonitorForAgent(agentId);
                if (typeof deps.clearSessionsByAgent === "function")
                    deps.clearSessionsByAgent(agentId);
                if (typeof deps.dismissPermissionsByAgent === "function")
                    deps.dismissPermissionsByAgent(agentId);
            }
            else if (typeof deps.startMonitorForAgent === "function") {
                deps.startMonitorForAgent(agentId);
            }
        }
        else if (flag === "permissionsEnabled") {
            if (!value && typeof deps.dismissPermissionsByAgent === "function") {
                deps.dismissPermissionsByAgent(agentId);
            }
        }
    }
    catch (err) {
        return {
            status: "error",
            message: `setAgentFlag side effect threw: ${err?.message}`,
        };
    }
    const nextEntry = { ...(currentEntry || {}), [flag]: value };
    const nextAgents = { ...currentAgents, [agentId]: nextEntry };
    return { status: "ok", commit: { agents: nextAgents } };
}
function togglePinnedTheme(payload, deps) {
    if (!payload || typeof payload !== "object") {
        return { status: "error", message: "togglePinnedTheme: payload must be an object" };
    }
    const { themeId } = payload;
    if (typeof themeId !== "string" || themeId.length === 0) {
        return { status: "error", message: "togglePinnedTheme.themeId must be a non-empty string" };
    }
    const discovered = typeof deps.getDiscoveredThemes === "function" ? deps.getDiscoveredThemes() : [];
    const knownIds = new Set(discovered.map((t) => t.id));
    if (!knownIds.has(themeId)) {
        return { status: "error", message: `togglePinnedTheme: unknown theme "${themeId}"` };
    }
    const snapshot = deps && deps.snapshot;
    const currentPinned = (snapshot && snapshot.pinnedThemes) || {};
    const isPinned = currentPinned[themeId] === true;
    if (!isPinned) {
        return { status: "ok", commit: { pinnedThemes: { ...currentPinned, [themeId]: true } } };
    }
    const activeId = typeof deps.getActiveThemeId === "function" ? deps.getActiveThemeId() : null;
    if (activeId && themeId === activeId) {
        return { status: "active-locked", message: "Cannot unpin the active theme." };
    }
    const remainingCount = Object.keys(currentPinned).filter((id) => id !== themeId && currentPinned[id] === true).length;
    if (remainingCount < 1) {
        return { status: "min-one-required", message: "At least one theme must remain pinned." };
    }
    const next = { ...currentPinned };
    delete next[themeId];
    return { status: "ok", commit: { pinnedThemes: next } };
}
async function refreshThemes(_payload, deps) {
    if (typeof deps.resyncPersonas === "function") {
        try {
            await deps.resyncPersonas();
        }
        catch (err) {
            return { status: "error", message: `refreshThemes: ${err?.message}` };
        }
    }
    return { status: "ok" };
}
exports.commandRegistry = {
    removeTheme: notImplemented("removeTheme"),
    installHooks: notImplemented("installHooks"),
    uninstallHooks: notImplemented("uninstallHooks"),
    registerShortcut: notImplemented("registerShortcut"),
    setAgentFlag,
    togglePinnedTheme,
    refreshThemes,
    logout(_payload, deps) {
        if (typeof deps.logout !== "function")
            return { status: "error", message: "logout: dep not available" };
        deps.logout();
        return { status: "ok" };
    },
    signIn(_payload, deps) {
        if (typeof deps.logout !== "function")
            return { status: "error", message: "signIn: dep not available" };
        deps.logout();
        return { status: "ok" };
    },
};
