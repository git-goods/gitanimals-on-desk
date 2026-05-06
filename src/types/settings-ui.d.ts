import type { AgentEventSource, SettingsSnapshot } from "./contracts";
import type { SettingsCommandResult, SettingsResult } from "./settings";

export interface SettingsPanelAgentEntry {
  id: string;
  name: string;
  eventSource: AgentEventSource | string;
  capabilities: Record<string, unknown>;
}

export interface SettingsPanelThemeEntry {
  id: string;
  name: string;
  builtin: boolean;
  type: "free" | "persona";
  owned: boolean;
}

export interface SettingsPanelUser {
  username: string;
}

export interface SettingsUpdateState {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  currentVersion: string;
  latestVersion: string;
  pendingVersion: string;
  lastCheckedAt: number;
  lastError: string;
  canCheck: boolean;
  canApplyUpdate: boolean;
  canRestartToUpdate: boolean;
  flow: "git" | "auto-updater";
  isPackaged: boolean;
}

export interface SettingsChangedPayload {
  changes: Record<string, unknown>;
  snapshot?: SettingsSnapshot;
}

export type SettingsTabId = "general" | "agents" | "theme" | "about";

export interface SettingsAPI {
  getSnapshot(): Promise<SettingsSnapshot>;
  getUpdateState(): Promise<SettingsUpdateState>;
  update(key: string, value: unknown): Promise<SettingsResult>;
  command(action: string, payload?: unknown): Promise<SettingsCommandResult>;
  listAgents(): Promise<SettingsPanelAgentEntry[]>;
  listThemes(): Promise<SettingsPanelThemeEntry[]>;
  openExternal(url: string): Promise<void>;
  getUser(): Promise<SettingsPanelUser | null>;
  onChanged(cb: (payload: SettingsChangedPayload) => void): () => void;
  onUpdateStateChanged(cb: (state: SettingsUpdateState) => void): () => void;
  onSetTab(cb: (tab: SettingsTabId | string) => void): () => void;
  onSessionExpired(cb: () => void): () => void;
}
