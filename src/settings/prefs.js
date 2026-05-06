"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_FLAGS = exports.SCHEMA_KEYS = exports.SCHEMA = exports.CURRENT_VERSION = void 0;
exports.getDefaults = getDefaults;
exports.validate = validate;
exports.migrate = migrate;
exports.load = load;
exports.save = save;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.CURRENT_VERSION = 1;
exports.SCHEMA = {
    version: {
        type: "number",
        default: exports.CURRENT_VERSION,
    },
    x: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
    y: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
    positionSaved: { type: "boolean", default: false },
    size: {
        type: "string",
        default: "P:10",
        validate: (v) => typeof v === "string" &&
            (v === "S" || v === "M" || v === "L" || /^P:\d+(?:\.\d+)?$/.test(v)),
    },
    miniMode: { type: "boolean", default: false },
    miniEdge: { type: "string", default: "right", enum: ["left", "right"] },
    preMiniX: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
    preMiniY: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
    lang: { type: "string", default: "en", enum: ["en", "zh", "ko"] },
    showTray: { type: "boolean", default: true },
    showDock: { type: "boolean", default: true },
    autoStartWithClaude: { type: "boolean", default: false },
    openAtLogin: { type: "boolean", default: false },
    openAtLoginHydrated: { type: "boolean", default: false },
    bubbleFollowPet: { type: "boolean", default: false },
    hideBubbles: { type: "boolean", default: false },
    showSessionId: { type: "boolean", default: false },
    soundMuted: { type: "boolean", default: false },
    flip: { type: "boolean", default: false },
    autoCheckForUpdates: { type: "boolean", default: true },
    lastUpdateCheckAt: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
    updateSnoozeUntil: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
    pendingUpdateVersion: { type: "string", default: "" },
    sendDiagnostics: { type: "boolean", default: true },
    theme: { type: "string", default: "little-chick" },
    agents: {
        type: "object",
        defaultFactory: () => ({
            "claude-code": { enabled: true, permissionsEnabled: true },
            "codex": { enabled: true, permissionsEnabled: true },
            "copilot-cli": { enabled: true, permissionsEnabled: true },
            "cursor-agent": { enabled: true, permissionsEnabled: true },
            "gemini-cli": { enabled: true, permissionsEnabled: true },
            "codebuddy": { enabled: true, permissionsEnabled: true },
            "kiro-cli": { enabled: true, permissionsEnabled: true },
            "opencode": { enabled: true, permissionsEnabled: true },
        }),
        normalize: normalizeAgents,
    },
    themeOverrides: {
        type: "object",
        defaultFactory: () => ({}),
        normalize: normalizeThemeOverrides,
    },
    pinnedThemes: {
        type: "object",
        defaultFactory: () => ({}),
        normalize: normalizePinnedThemes,
    },
};
exports.SCHEMA_KEYS = Object.freeze(Object.keys(exports.SCHEMA));
function defaultFor(field) {
    if (typeof field.defaultFactory === "function")
        return field.defaultFactory();
    return field.default;
}
function getDefaults() {
    const out = {};
    for (const key of exports.SCHEMA_KEYS) {
        out[key] = defaultFor(exports.SCHEMA[key]);
    }
    return out;
}
function isValidValue(field, value) {
    if (value === undefined || value === null)
        return false;
    if (field.type === "object") {
        return typeof value === "object" && !Array.isArray(value);
    }
    if (typeof value !== field.type)
        return false;
    if (field.enum && !field.enum.includes(value))
        return false;
    if (typeof field.validate === "function" && !field.validate(value))
        return false;
    return true;
}
function validate(raw) {
    const out = getDefaults();
    if (!raw || typeof raw !== "object")
        return out;
    const source = raw;
    for (const key of exports.SCHEMA_KEYS) {
        if (!(key in source))
            continue;
        const field = exports.SCHEMA[key];
        let value = source[key];
        if (field.type === "object" && typeof field.normalize === "function") {
            value = field.normalize(value, out[key]);
        }
        if (isValidValue(field, value)) {
            out[key] = value;
        }
    }
    return out;
}
function migrate(raw) {
    if (!raw || typeof raw !== "object")
        return raw;
    const out = { ...raw };
    if (out.version === undefined || out.version === null) {
        out.version = 1;
        if (out.agents === undefined) {
            out.agents = exports.SCHEMA.agents.defaultFactory?.();
        }
        if (out.themeOverrides === undefined) {
            out.themeOverrides = exports.SCHEMA.themeOverrides.defaultFactory?.();
        }
    }
    if (out.positionSaved === undefined) {
        out.positionSaved =
            (typeof out.x === "number" && out.x !== 0) ||
                (typeof out.y === "number" && out.y !== 0);
    }
    return out;
}
exports.AGENT_FLAGS = ["enabled", "permissionsEnabled"];
function normalizeAgents(value, defaultsValue) {
    if (!value || typeof value !== "object")
        return defaultsValue;
    const out = { ...defaultsValue };
    const source = value;
    for (const id of Object.keys(source)) {
        const entry = source[id];
        if (!entry || typeof entry !== "object")
            continue;
        const base = (defaultsValue && defaultsValue[id]) || {
            enabled: true,
            permissionsEnabled: true,
        };
        const merged = { ...base };
        let touched = false;
        for (const flag of exports.AGENT_FLAGS) {
            if (typeof entry[flag] === "boolean") {
                merged[flag] = entry[flag];
                touched = true;
            }
        }
        if (touched)
            out[id] = merged;
    }
    return out;
}
function normalizeThemeOverrides(value, defaultsValue) {
    if (!value || typeof value !== "object")
        return defaultsValue;
    const out = {};
    const source = value;
    for (const themeId of Object.keys(source)) {
        const themeMap = source[themeId];
        if (!themeMap || typeof themeMap !== "object")
            continue;
        const cleanThemeMap = {};
        for (const stateKey of Object.keys(themeMap)) {
            const entry = themeMap[stateKey];
            if (entry &&
                typeof entry === "object" &&
                typeof entry.sourceThemeId === "string" &&
                typeof entry.file === "string") {
                cleanThemeMap[stateKey] = {
                    sourceThemeId: entry.sourceThemeId,
                    file: entry.file,
                };
            }
        }
        if (Object.keys(cleanThemeMap).length > 0) {
            out[themeId] = cleanThemeMap;
        }
    }
    return out;
}
function normalizePinnedThemes(value, defaultsValue) {
    if (!value || typeof value !== "object")
        return defaultsValue;
    const out = {};
    const source = value;
    for (const id of Object.keys(source)) {
        if (source[id] === true)
            out[id] = true;
    }
    return out;
}
function load(prefsPath) {
    let raw;
    try {
        const text = fs.readFileSync(prefsPath, "utf8");
        raw = JSON.parse(text);
    }
    catch (err) {
        if (err && err.code === "ENOENT") {
            return { snapshot: getDefaults(), locked: false };
        }
        try {
            const bak = prefsPath + ".bak";
            fs.copyFileSync(prefsPath, bak);
            console.warn(`GitAnimals: prefs file unreadable, backed up to ${bak}:`, err?.message);
        }
        catch (bakErr) {
            console.warn("GitAnimals: prefs file unreadable and backup failed:", err?.message, bakErr?.message);
        }
        return { snapshot: getDefaults(), locked: false };
    }
    if (!raw || typeof raw !== "object") {
        return { snapshot: getDefaults(), locked: false };
    }
    const incomingVersion = typeof raw.version === "number" ? raw.version : 0;
    if (incomingVersion > exports.CURRENT_VERSION) {
        console.warn(`GitAnimals: prefs file version ${incomingVersion} is newer than supported (${exports.CURRENT_VERSION}). ` +
            "Settings will be readable but not saved to avoid data loss.");
        return { snapshot: validate(raw), locked: true };
    }
    const migrated = migrate(raw);
    return { snapshot: validate(migrated), locked: false };
}
function save(prefsPath, snapshot) {
    const validated = validate(snapshot);
    try {
        fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
    }
    catch { }
    fs.writeFileSync(prefsPath, JSON.stringify(validated, null, 2));
}
