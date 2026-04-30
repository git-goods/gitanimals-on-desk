import { AGENT_FLAGS, CURRENT_VERSION } from "./prefs";

import type {
  SettingsCommandRegistry,
  SettingsResult,
  SettingsUpdateRegistry,
} from "../types/settings";

type Deps = Record<string, any>;

function requireBoolean(key: string) {
  return function (value: unknown): SettingsResult {
    if (typeof value !== "boolean") {
      return { status: "error", message: `${key} must be a boolean` };
    }
    return { status: "ok" };
  };
}

function requireFiniteNumber(key: string) {
  return function (value: unknown): SettingsResult {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { status: "error", message: `${key} must be a finite number` };
    }
    return { status: "ok" };
  };
}

function requireEnum(key: string, allowed: string[]) {
  return function (value: unknown): SettingsResult {
    if (!allowed.includes(String(value))) {
      return {
        status: "error",
        message: `${key} must be one of: ${allowed.join(", ")}`,
      };
    }
    return { status: "ok" };
  };
}

function requireString(key: string, { allowEmpty = false } = {}) {
  return function (value: unknown): SettingsResult {
    if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
      return { status: "error", message: `${key} must be a non-empty string` };
    }
    return { status: "ok" };
  };
}

function requirePlainObject(key: string) {
  return function (value: unknown): SettingsResult {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { status: "error", message: `${key} must be a plain object` };
    }
    return { status: "ok" };
  };
}

export const updateRegistry: SettingsUpdateRegistry = {
  x: requireFiniteNumber("x"),
  y: requireFiniteNumber("y"),
  size(value) {
    if (typeof value !== "string") {
      return { status: "error", message: "size must be a string" };
    }
    if (value === "S" || value === "M" || value === "L") return { status: "ok" };
    if (/^P:\d+(?:\.\d+)?$/.test(value)) return { status: "ok" };
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
    effect(value, deps: Deps) {
      if (!deps || typeof deps.setTelemetryEnabled !== "function") {
        return { status: "ok" };
      }
      try {
        deps.setTelemetryEnabled(value);
        return { status: "ok" };
      } catch (err: any) {
        return { status: "error", message: `sendDiagnostics: ${err?.message}` };
      }
    },
  },
  autoStartWithClaude: {
    validate: requireBoolean("autoStartWithClaude"),
    effect(value, deps: Deps) {
      if (
        !deps ||
        typeof deps.installAutoStart !== "function" ||
        typeof deps.uninstallAutoStart !== "function"
      ) {
        return {
          status: "error",
          message: "autoStartWithClaude effect requires installAutoStart/uninstallAutoStart deps",
        };
      }
      try {
        if (value) deps.installAutoStart();
        else deps.uninstallAutoStart();
        return { status: "ok" };
      } catch (err: any) {
        return {
          status: "error",
          message: `autoStartWithClaude: ${err?.message}`,
        };
      }
    },
  },
  openAtLogin: {
    validate: requireBoolean("openAtLogin"),
    effect(value, deps: Deps) {
      if (!deps || typeof deps.setOpenAtLogin !== "function") {
        return {
          status: "error",
          message: "openAtLogin effect requires setOpenAtLogin dep",
        };
      }
      try {
        deps.setOpenAtLogin(value);
        return { status: "ok" };
      } catch (err: any) {
        return {
          status: "error",
          message: `openAtLogin: ${err?.message}`,
        };
      }
    },
  },
  openAtLoginHydrated: requireBoolean("openAtLoginHydrated"),
  showTray(value, { snapshot }: Deps) {
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
  showDock(value, { snapshot }: Deps) {
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
    if (value > CURRENT_VERSION) {
      return {
        status: "error",
        message: `version ${value} is newer than supported (${CURRENT_VERSION})`,
      };
    }
    return { status: "ok" };
  },
};

function notImplemented(name: string) {
  return function () {
    return {
      status: "error",
      message: `${name}: not implemented yet (Phase 0 stub)`,
    };
  };
}

const _validateAgentFlagId = requireString("setAgentFlag.agentId");
const _validateAgentFlagValue = requireBoolean("setAgentFlag.value");

function setAgentFlag(payload: any, deps: Deps) {
  if (!payload || typeof payload !== "object") {
    return { status: "error", message: "setAgentFlag: payload must be an object" };
  }
  const { agentId, flag, value } = payload;
  const idCheck = _validateAgentFlagId(agentId);
  if (idCheck.status !== "ok") return idCheck;
  if (typeof flag !== "string" || !AGENT_FLAGS.includes(flag as any)) {
    return {
      status: "error",
      message: `setAgentFlag.flag must be one of: ${AGENT_FLAGS.join(", ")}`,
    };
  }
  const valueCheck = _validateAgentFlagValue(value);
  if (valueCheck.status !== "ok") return valueCheck;
  const snapshot = deps && deps.snapshot;
  const currentAgents = (snapshot && snapshot.agents) || {};
  const currentEntry = currentAgents[agentId];
  const currentValue =
    currentEntry && typeof currentEntry[flag] === "boolean" ? currentEntry[flag] : true;
  if (currentValue === value) {
    return { status: "ok", noop: true };
  }

  try {
    if (flag === "enabled") {
      if (!value) {
        if (typeof deps.stopMonitorForAgent === "function") deps.stopMonitorForAgent(agentId);
        if (typeof deps.clearSessionsByAgent === "function") deps.clearSessionsByAgent(agentId);
        if (typeof deps.dismissPermissionsByAgent === "function") deps.dismissPermissionsByAgent(agentId);
      } else if (typeof deps.startMonitorForAgent === "function") {
        deps.startMonitorForAgent(agentId);
      }
    } else if (flag === "permissionsEnabled") {
      if (!value && typeof deps.dismissPermissionsByAgent === "function") {
        deps.dismissPermissionsByAgent(agentId);
      }
    }
  } catch (err: any) {
    return {
      status: "error",
      message: `setAgentFlag side effect threw: ${err?.message}`,
    };
  }

  const nextEntry = { ...(currentEntry || {}), [flag]: value };
  const nextAgents = { ...currentAgents, [agentId]: nextEntry };
  return { status: "ok", commit: { agents: nextAgents } };
}

function togglePinnedTheme(payload: any, deps: Deps) {
  if (!payload || typeof payload !== "object") {
    return { status: "error", message: "togglePinnedTheme: payload must be an object" };
  }
  const { themeId } = payload;
  if (typeof themeId !== "string" || themeId.length === 0) {
    return { status: "error", message: "togglePinnedTheme.themeId must be a non-empty string" };
  }
  const discovered = typeof deps.getDiscoveredThemes === "function" ? deps.getDiscoveredThemes() : [];
  const knownIds = new Set(discovered.map((t: any) => t.id));
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
  const remainingCount = Object.keys(currentPinned).filter(
    (id) => id !== themeId && currentPinned[id] === true
  ).length;
  if (remainingCount < 1) {
    return { status: "min-one-required", message: "At least one theme must remain pinned." };
  }
  const next = { ...currentPinned };
  delete next[themeId];
  return { status: "ok", commit: { pinnedThemes: next } };
}

async function refreshThemes(_payload: unknown, deps: Deps) {
  if (typeof deps.resyncPersonas === "function") {
    try {
      await deps.resyncPersonas();
    } catch (err: any) {
      return { status: "error", message: `refreshThemes: ${err?.message}` };
    }
  }
  return { status: "ok" };
}

export const commandRegistry: SettingsCommandRegistry = {
  removeTheme: notImplemented("removeTheme"),
  installHooks: notImplemented("installHooks"),
  uninstallHooks: notImplemented("uninstallHooks"),
  registerShortcut: notImplemented("registerShortcut"),
  setAgentFlag,
  togglePinnedTheme,
  refreshThemes,
  logout(_payload, deps: Deps) {
    if (typeof deps.logout !== "function") return { status: "error", message: "logout: dep not available" };
    deps.logout();
    return { status: "ok" };
  },
  checkForUpdatesFromSettings(_payload, deps: Deps) {
    if (typeof deps.checkForUpdates !== "function") {
      return { status: "error", message: "checkForUpdatesFromSettings: dep not available" };
    }
    return Promise.resolve(deps.checkForUpdates({ manual: true, source: "settings" }))
      .then(() => ({ status: "ok" }));
  },
  applyUpdateFromSettings(_payload, deps: Deps) {
    if (typeof deps.applyUpdateFromSettings !== "function") {
      return { status: "error", message: "applyUpdateFromSettings: dep not available" };
    }
    return Promise.resolve(deps.applyUpdateFromSettings())
      .then(() => ({ status: "ok" }));
  },
  restartToUpdateFromSettings(_payload, deps: Deps) {
    if (typeof deps.restartToUpdateFromSettings !== "function") {
      return { status: "error", message: "restartToUpdateFromSettings: dep not available" };
    }
    return Promise.resolve(deps.restartToUpdateFromSettings())
      .then(() => ({ status: "ok" }));
  },
  signIn(_payload, deps: Deps) {
    if (typeof deps.logout !== "function") return { status: "error", message: "signIn: dep not available" };
    deps.logout();
    return { status: "ok" };
  },
};

export {
  requireBoolean,
  requireFiniteNumber,
  requireEnum,
  requireString,
  requirePlainObject,
};
