import type { SettingsSnapshot } from "./contracts";

export interface SettingsResult {
  status: string;
  message?: string;
  noop?: boolean;
  locked?: boolean;
}

export interface SettingsCommandResult extends SettingsResult {
  commit?: Partial<SettingsSnapshot>;
}

export type SettingsMaybePromise<T> = T | Promise<T>;

export interface SettingsDeps {
  snapshot: SettingsSnapshot;
  [key: string]: unknown;
}

export type SettingsValidator = (
  value: unknown,
  deps: SettingsDeps
) => SettingsMaybePromise<SettingsResult>;

export interface SettingsUpdateEntryObject {
  validate: SettingsValidator;
  effect?: SettingsValidator;
}

export type SettingsUpdateEntry = SettingsValidator | SettingsUpdateEntryObject;
export type SettingsUpdateRegistry = Record<string, SettingsUpdateEntry>;

export type SettingsCommand = (
  payload: unknown,
  deps: SettingsDeps
) => SettingsMaybePromise<SettingsCommandResult>;

export type SettingsCommandRegistry = Record<string, SettingsCommand>;

export interface SettingsLoadResult {
  snapshot: SettingsSnapshot;
  locked: boolean;
}

export interface SettingsStoreBroadcast {
  changes: Record<string, unknown>;
  snapshot: SettingsSnapshot;
}

export interface SettingsStore {
  getSnapshot(): SettingsSnapshot;
  get(key: string): unknown;
  subscribe(fn: (broadcast: SettingsStoreBroadcast) => void): () => void;
  dispose(): void;
  _commit(partial: Record<string, unknown>): {
    changed: boolean;
    changes: Record<string, unknown>;
  };
}

export interface CreateSettingsControllerOptions {
  prefsPath?: string;
  prefs?: typeof import("../settings/prefs");
  updates?: SettingsUpdateRegistry;
  commands?: SettingsCommandRegistry;
  injectedDeps?: Record<string, unknown>;
  loadResult?: SettingsLoadResult | null;
}
