import type {
  SettingsSnapshot,
} from "../types/contracts";
import type {
  SettingsStore,
  SettingsStoreBroadcast,
} from "../types/settings";

type SettingsListener = (broadcast: SettingsStoreBroadcast) => void;

export function createStore(initialSnapshot: SettingsSnapshot): SettingsStore {
  if (!initialSnapshot || typeof initialSnapshot !== "object") {
    throw new TypeError("createStore(initialSnapshot): initialSnapshot must be an object");
  }

  let snapshot: SettingsSnapshot = { ...initialSnapshot };
  const listeners = new Set<SettingsListener>();
  let disposed = false;

  function getSnapshot(): SettingsSnapshot {
    return { ...snapshot };
  }

  function get(key: string): unknown {
    return snapshot[key];
  }

  function subscribe(fn: SettingsListener): () => void {
    if (typeof fn !== "function") {
      throw new TypeError("subscribe(fn): fn must be a function");
    }
    listeners.add(fn);
    return function unsubscribe() {
      listeners.delete(fn);
    };
  }

  function _commit(partial: Record<string, unknown>) {
    if (disposed) return { changed: false, changes: {} };
    if (!partial || typeof partial !== "object") {
      return { changed: false, changes: {} };
    }

    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(partial)) {
      const next = partial[key];
      if (snapshot[key] !== next) {
        changes[key] = next;
      }
    }

    if (Object.keys(changes).length === 0) {
      return { changed: false, changes };
    }

    snapshot = { ...snapshot, ...changes };
    const broadcast: SettingsStoreBroadcast = {
      changes,
      snapshot: { ...snapshot },
    };
    for (const fn of listeners) {
      try {
        fn(broadcast);
      } catch (err) {
        console.warn(
          "GitAnimals: settings-store subscriber threw:",
          (err as Error | undefined)?.message
        );
      }
    }
    return { changed: true, changes };
  }

  function dispose(): void {
    disposed = true;
    listeners.clear();
  }

  return {
    getSnapshot,
    get,
    subscribe,
    dispose,
    _commit,
  };
}
