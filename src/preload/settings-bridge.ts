import type {
  SettingsAPI,
  SettingsChangedPayload,
  SettingsTabId,
  SettingsUpdateState,
} from "../types/settings-ui";

type BridgeInvoke = (channel: string, payload?: unknown) => Promise<unknown>;
type BridgeSubscribe = (
  channel: string,
  handler: (...args: unknown[]) => void
) => () => void;

type BridgeListener<T> = (value: T) => void;

interface CreateSettingsBridgeDeps {
  invoke: BridgeInvoke;
  subscribe: BridgeSubscribe;
}

function addListener<T>(set: Set<BridgeListener<T>>, cb: BridgeListener<T> | unknown): () => void {
  if (typeof cb !== "function") return () => {};
  const listener = cb as BridgeListener<T>;
  set.add(listener);
  return () => set.delete(listener);
}

function emitTo<T>(set: Set<BridgeListener<T>>, value: T): void {
  for (const cb of set) {
    try {
      cb(value);
    } catch (err) {
      console.warn("settings bridge listener threw:", err);
    }
  }
}

export function createSettingsBridge({
  invoke,
  subscribe,
}: CreateSettingsBridgeDeps): SettingsAPI {
  if (typeof invoke !== "function") {
    throw new TypeError("createSettingsBridge: invoke is required");
  }
  if (typeof subscribe !== "function") {
    throw new TypeError("createSettingsBridge: subscribe is required");
  }

  const changedListeners = new Set<BridgeListener<SettingsChangedPayload>>();
  const updateStateListeners = new Set<BridgeListener<SettingsUpdateState>>();
  const tabListeners = new Set<BridgeListener<SettingsTabId | string>>();
  const sessionExpiredListeners = new Set<BridgeListener<void>>();

  subscribe("settings-changed", (_event, payload) => {
    emitTo(changedListeners, payload as SettingsChangedPayload);
  });
  subscribe("settings:set-tab", (_event, tab) => {
    emitTo(tabListeners, tab as SettingsTabId | string);
  });
  subscribe("settings:update-state-changed", (_event, state) => {
    emitTo(updateStateListeners, state as SettingsUpdateState);
  });
  subscribe("auth:session-expired", () => {
    emitTo(sessionExpiredListeners, undefined);
  });

  return {
    getSnapshot: () => invoke("settings:get-snapshot") as Promise<any>,
    getUpdateState: () => invoke("settings:get-update-state") as Promise<any>,
    update: (key, value) =>
      invoke("settings:update", { key, value }) as Promise<any>,
    command: (action, payload) =>
      invoke("settings:command", { action, payload }) as Promise<any>,
    listAgents: () => invoke("settings:list-agents") as Promise<any>,
    listThemes: () => invoke("settings:list-themes") as Promise<any>,
    openExternal: (url: string) => invoke("settings:open-external", url) as Promise<void>,
    getUser: () => invoke("settings:get-user") as Promise<any>,
    onChanged: (cb) => addListener(changedListeners, cb),
    onUpdateStateChanged: (cb) => addListener(updateStateListeners, cb),
    onSetTab: (cb) => addListener(tabListeners, cb),
    onSessionExpired: (cb) => addListener(sessionExpiredListeners, cb),
  };
}
