import * as fs from "fs";
import * as path from "path";

import type {
  AgentFlags,
  SettingsSnapshot,
  ThemeOverrideEntry,
} from "../types/contracts";

type SchemaField = {
  type: "number" | "boolean" | "string" | "object";
  default?: unknown;
  defaultFactory?: () => unknown;
  enum?: string[];
  validate?: (value: any) => boolean;
  normalize?: (value: unknown, defaultsValue: any) => any;
};

export const CURRENT_VERSION = 1;

export const SCHEMA: Record<string, SchemaField> = {
  version: {
    type: "number",
    default: CURRENT_VERSION,
  },
  x: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
  y: { type: "number", default: 0, validate: (v) => Number.isFinite(v) },
  positionSaved: { type: "boolean", default: false },
  size: {
    type: "string",
    default: "P:10",
    validate: (v) =>
      typeof v === "string" &&
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
  sendDiagnostics: { type: "boolean", default: true },
  theme: { type: "string", default: "fox" },
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

export const SCHEMA_KEYS = Object.freeze(Object.keys(SCHEMA));

function defaultFor(field: SchemaField): any {
  if (typeof field.defaultFactory === "function") return field.defaultFactory();
  return field.default;
}

export function getDefaults(): SettingsSnapshot {
  const out = {} as SettingsSnapshot;
  for (const key of SCHEMA_KEYS) {
    out[key] = defaultFor(SCHEMA[key]);
  }
  return out;
}

function isValidValue(field: SchemaField, value: any): boolean {
  if (value === undefined || value === null) return false;
  if (field.type === "object") {
    return typeof value === "object" && !Array.isArray(value);
  }
  if (typeof value !== field.type) return false;
  if (field.enum && !field.enum.includes(value)) return false;
  if (typeof field.validate === "function" && !field.validate(value)) return false;
  return true;
}

export function validate(raw: unknown): SettingsSnapshot {
  const out = getDefaults();
  if (!raw || typeof raw !== "object") return out;
  const source = raw as Record<string, any>;
  for (const key of SCHEMA_KEYS) {
    if (!(key in source)) continue;
    const field = SCHEMA[key];
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

export function migrate(raw: unknown): any {
  if (!raw || typeof raw !== "object") return raw;
  const out: Record<string, any> = { ...(raw as Record<string, any>) };
  if (out.version === undefined || out.version === null) {
    out.version = 1;
    if (out.agents === undefined) {
      out.agents = SCHEMA.agents.defaultFactory?.();
    }
    if (out.themeOverrides === undefined) {
      out.themeOverrides = SCHEMA.themeOverrides.defaultFactory?.();
    }
  }
  if (out.positionSaved === undefined) {
    out.positionSaved =
      (typeof out.x === "number" && out.x !== 0) ||
      (typeof out.y === "number" && out.y !== 0);
  }
  return out;
}

export const AGENT_FLAGS = ["enabled", "permissionsEnabled"] as const;

function normalizeAgents(
  value: unknown,
  defaultsValue: Record<string, AgentFlags>
): Record<string, AgentFlags> {
  if (!value || typeof value !== "object") return defaultsValue;
  const out = { ...defaultsValue };
  const source = value as Record<string, any>;
  for (const id of Object.keys(source)) {
    const entry = source[id];
    if (!entry || typeof entry !== "object") continue;
    const base = (defaultsValue && defaultsValue[id]) || {
      enabled: true,
      permissionsEnabled: true,
    };
    const merged = { ...base };
    let touched = false;
    for (const flag of AGENT_FLAGS) {
      if (typeof entry[flag] === "boolean") {
        merged[flag] = entry[flag];
        touched = true;
      }
    }
    if (touched) out[id] = merged;
  }
  return out;
}

function normalizeThemeOverrides(
  value: unknown,
  defaultsValue: Record<string, Record<string, ThemeOverrideEntry>>
): Record<string, Record<string, ThemeOverrideEntry>> {
  if (!value || typeof value !== "object") return defaultsValue;
  const out: Record<string, Record<string, ThemeOverrideEntry>> = {};
  const source = value as Record<string, any>;
  for (const themeId of Object.keys(source)) {
    const themeMap = source[themeId];
    if (!themeMap || typeof themeMap !== "object") continue;
    const cleanThemeMap: Record<string, ThemeOverrideEntry> = {};
    for (const stateKey of Object.keys(themeMap)) {
      const entry = themeMap[stateKey];
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.sourceThemeId === "string" &&
        typeof entry.file === "string"
      ) {
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

function normalizePinnedThemes(
  value: unknown,
  defaultsValue: Record<string, true>
): Record<string, true> {
  if (!value || typeof value !== "object") return defaultsValue;
  const out: Record<string, true> = {};
  const source = value as Record<string, any>;
  for (const id of Object.keys(source)) {
    if (source[id] === true) out[id] = true;
  }
  return out;
}

export function load(prefsPath: string): { snapshot: SettingsSnapshot; locked: boolean } {
  let raw: any;
  try {
    const text = fs.readFileSync(prefsPath, "utf8");
    raw = JSON.parse(text);
  } catch (err: any) {
    if (err && err.code === "ENOENT") {
      return { snapshot: getDefaults(), locked: false };
    }
    try {
      const bak = prefsPath + ".bak";
      fs.copyFileSync(prefsPath, bak);
      console.warn(`GitAnimals: prefs file unreadable, backed up to ${bak}:`, err?.message);
    } catch (bakErr: any) {
      console.warn("GitAnimals: prefs file unreadable and backup failed:", err?.message, bakErr?.message);
    }
    return { snapshot: getDefaults(), locked: false };
  }
  if (!raw || typeof raw !== "object") {
    return { snapshot: getDefaults(), locked: false };
  }
  const incomingVersion = typeof raw.version === "number" ? raw.version : 0;
  if (incomingVersion > CURRENT_VERSION) {
    console.warn(
      `GitAnimals: prefs file version ${incomingVersion} is newer than supported (${CURRENT_VERSION}). ` +
        "Settings will be readable but not saved to avoid data loss."
    );
    return { snapshot: validate(raw), locked: true };
  }
  const migrated = migrate(raw);
  return { snapshot: validate(migrated), locked: false };
}

export function save(prefsPath: string, snapshot: SettingsSnapshot): void {
  const validated = validate(snapshot);
  try {
    fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
  } catch {}
  fs.writeFileSync(prefsPath, JSON.stringify(validated, null, 2));
}
