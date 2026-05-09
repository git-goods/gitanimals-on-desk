import type { SettingsSnapshot } from "../../types/contracts";

export type {
  SettingsSnapshot,
  AgentEventSource,
} from "../../types/contracts";
export type {
  SettingsPanelAgentEntry as AgentMetadata,
  SettingsPanelThemeEntry as ThemeMetadata,
  SettingsPanelUser as UserInfo,
  SettingsUpdateState as UpdateState,
  SettingsChangedPayload,
  SettingsTabId,
  SettingsAPI,
} from "../../types/settings-ui";

export type Snapshot = Partial<SettingsSnapshot> & {
  platform?: string;
  appVersion?: string;
};

export type Translator = (key: string) => string;
export type PendingMap = Record<string, boolean>;

export interface Toast {
  id: string;
  message: string;
  error?: boolean;
}

export type RunUpdate = (
  pendingKey: string,
  key: string,
  value: any,
) => Promise<any>;

export type RunCommand = (
  pendingKey: string,
  work: () => any,
) => Promise<any>;
