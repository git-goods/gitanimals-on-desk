import { createStore } from "./store";
import * as prefsModule from "./prefs";
import * as defaultActions from "./actions";

import type {
  CreateSettingsControllerOptions,
  SettingsResult,
  SettingsUpdateEntry,
} from "../types/settings";
import type { SettingsSnapshot } from "../types/contracts";

type MaybePromise<T> = T | Promise<T>;

type SettingsControllerPublic = {
  applyUpdate(key: string, value: unknown): MaybePromise<SettingsResult>;
  applyBulk(partial: Record<string, unknown>): MaybePromise<SettingsResult>;
  applyCommand(name: string, payload: unknown): Promise<SettingsResult>;
  hydrate(partial: Record<string, unknown>): MaybePromise<SettingsResult>;
  getSnapshot(): SettingsSnapshot;
  get(key: string): unknown;
  subscribe(fn: (...args: any[]) => void): () => void;
  subscribeKey(key: string, fn: (value: unknown, snapshot: SettingsSnapshot) => void): () => void;
  persist(): SettingsResult;
  isLocked(): boolean;
  dispose(): void;
};

export function createSettingsController({
  prefsPath,
  prefs = prefsModule,
  updates = defaultActions.updateRegistry,
  commands = defaultActions.commandRegistry,
  injectedDeps = {},
  loadResult = null,
}: CreateSettingsControllerOptions = {}): SettingsControllerPublic {
  if (!prefsPath && !loadResult) {
    throw new TypeError("createSettingsController: prefsPath or loadResult is required");
  }

  const loaded = loadResult || prefs.load(prefsPath as string);
  const initialSnapshot = loaded.snapshot;
  let locked = !!loaded.locked;
  const store = createStore(initialSnapshot);

  const asyncLocks = new Map<string, Promise<any>>();

  function trackAsyncLock(lockKey: string, promiseValue: Promise<any>) {
    asyncLocks.set(lockKey, promiseValue);
    const cleanup = () => {
      if (asyncLocks.get(lockKey) === promiseValue) asyncLocks.delete(lockKey);
    };
    Promise.resolve(promiseValue).then(cleanup, cleanup);
  }

  function buildDeps() {
    return {
      ...injectedDeps,
      snapshot: store.getSnapshot(),
    };
  }

  function persistInternal(): SettingsResult {
    if (locked) return { status: "ok", noop: true, locked: true };
    if (!prefsPath) return { status: "ok", noop: true };
    try {
      prefs.save(prefsPath, store.getSnapshot() as any);
      return { status: "ok" };
    } catch (err: any) {
      console.warn("GitAnimals: failed to persist prefs:", err?.message);
      return { status: "error", message: err?.message };
    }
  }

  function isThenable<T>(value: MaybePromise<T>): value is Promise<T> {
    return !!value && typeof (value as Promise<T>).then === "function";
  }

  function resolveValidator(entry: SettingsUpdateEntry | undefined) {
    if (typeof entry === "function") return entry;
    if (entry && typeof entry.validate === "function") return entry.validate;
    return null;
  }

  function resolveEffect(entry: SettingsUpdateEntry | undefined) {
    if (entry && typeof entry === "object" && typeof entry.effect === "function") {
      return entry.effect;
    }
    return null;
  }

  function runStep(
    label: string,
    fn: (value: unknown, deps: Record<string, unknown>) => any,
    value: unknown,
    deps: Record<string, unknown>
  ): MaybePromise<SettingsResult> {
    let raw;
    try {
      raw = fn(value, deps);
    } catch (err: any) {
      return { status: "error", message: `${label} threw: ${err?.message}` };
    }
    if (isThenable(raw)) {
      return raw.then(
        (result) => result || { status: "error", message: `${label}: returned no result` },
        (err) => ({ status: "error", message: `${label} threw: ${err?.message}` })
      );
    }
    return raw || { status: "error", message: `${label}: returned no result` };
  }

  function invokeAction(
    key: string,
    value: unknown,
    options: { skipEffect?: boolean } = {}
  ): MaybePromise<SettingsResult> {
    const entry = updates[key];
    if (!entry) {
      return { status: "error", message: `unknown settings key: ${key}` };
    }
    if (store.get(key) === value) {
      return { status: "ok", noop: true };
    }
    const validator = resolveValidator(entry);
    if (!validator) {
      return { status: "error", message: `${key}: entry has no validator` };
    }
    const validateResult = runStep(`${key} validate`, validator as any, value, buildDeps());
    const effect = options.skipEffect ? null : resolveEffect(entry);
    if (!effect) return validateResult;

    function maybeRunEffect(result: SettingsResult): MaybePromise<SettingsResult> {
      if (!result || result.status !== "ok" || result.noop) return result;
      return runStep(`${key} effect`, effect as any, value, buildDeps());
    }

    if (isThenable(validateResult)) {
      return validateResult.then(maybeRunEffect);
    }
    return maybeRunEffect(validateResult);
  }

  function finishSingle(key: string, value: unknown, actionResult: SettingsResult): SettingsResult {
    if (!actionResult || actionResult.status !== "ok") {
      return actionResult || {
        status: "error",
        message: `${key}: action returned no result`,
      };
    }
    if (actionResult.noop) return { status: "ok", noop: true };
    const { changed } = store._commit({ [key]: value });
    if (changed) {
      const persisted = persistInternal();
      if (persisted.status !== "ok") return persisted;
    }
    return { status: "ok" };
  }

  function doApplyUpdate(key: string, value: unknown): MaybePromise<SettingsResult> {
    const actionResult = invokeAction(key, value);
    if (isThenable(actionResult)) {
      return actionResult.then((result) => finishSingle(key, value, result));
    }
    return finishSingle(key, value, actionResult);
  }

  function applyUpdate(key: string, value: unknown): MaybePromise<SettingsResult> {
    const pending = asyncLocks.get(key);
    if (pending) {
      const next = pending.then(
        () => doApplyUpdate(key, value),
        () => doApplyUpdate(key, value)
      ) as Promise<SettingsResult>;
      trackAsyncLock(key, next);
      return next;
    }
    const actionResult = invokeAction(key, value);
    if (!isThenable(actionResult)) {
      return finishSingle(key, value, actionResult);
    }
    const next = actionResult.then((result) => finishSingle(key, value, result));
    trackAsyncLock(key, next);
    return next;
  }

  function commitBulk(accumulated: Record<string, unknown>): SettingsResult {
    const { changed } = store._commit(accumulated);
    if (changed) {
      const persisted = persistInternal();
      if (persisted.status !== "ok") return persisted;
    }
    return { status: "ok" };
  }

  function finishBulk(entries: Array<{ key: string; value: unknown; actionResult: SettingsResult }>) {
    const accumulated: Record<string, unknown> = {};
    for (const { key, value, actionResult } of entries) {
      if (!actionResult || actionResult.status !== "ok") {
        return actionResult || {
          status: "error",
          message: `${key}: action returned no result`,
        };
      }
      if (actionResult.noop) continue;
      accumulated[key] = value;
    }
    if (Object.keys(accumulated).length === 0) {
      return { status: "ok", noop: true };
    }
    const mergedSnapshot = { ...store.getSnapshot(), ...accumulated };
    const mergedDeps = { ...injectedDeps, snapshot: mergedSnapshot };
    for (const key of Object.keys(accumulated)) {
      const entry = updates[key];
      const validator = entry && resolveValidator(entry);
      if (!validator) continue;
      const recheck = runStep(
        `${key} post-validate`,
        validator as any,
        accumulated[key],
        mergedDeps
      );
      if (isThenable(recheck)) {
        return recheck.then((result) => {
          if (!result || result.status !== "ok") return result;
          return commitBulk(accumulated);
        });
      }
      if (!recheck || recheck.status !== "ok") return recheck;
    }
    return commitBulk(accumulated);
  }

  function applyBulk(partial: Record<string, unknown>): MaybePromise<SettingsResult> {
    if (!partial || typeof partial !== "object") {
      return { status: "error", message: "applyBulk: partial must be an object" };
    }
    for (const key of Object.keys(partial)) {
      const entry = updates[key];
      if (entry && resolveEffect(entry)) {
        return {
          status: "error",
          message: `${key}: effect-bearing keys cannot be updated via applyBulk — use applyUpdate`,
        };
      }
    }
    const entries = Object.keys(partial).map((key) => ({
      key,
      value: partial[key],
      actionResult: invokeAction(key, partial[key]),
    }));
    const anyAsync = entries.some((entry) => isThenable(entry.actionResult));
    if (!anyAsync) {
      return finishBulk(entries as Array<{ key: string; value: unknown; actionResult: SettingsResult }>);
    }
    return Promise.all(
      entries.map((entry) =>
        Promise.resolve(entry.actionResult).then((result) => ({ ...entry, actionResult: result }))
      )
    ).then((resolved) => finishBulk(resolved));
  }

  function hydrate(partial: Record<string, unknown>): MaybePromise<SettingsResult> {
    if (!partial || typeof partial !== "object") {
      return { status: "error", message: "hydrate: partial must be an object" };
    }
    const entries = Object.keys(partial).map((key) => ({
      key,
      value: partial[key],
      actionResult: invokeAction(key, partial[key], { skipEffect: true }),
    }));
    const anyAsync = entries.some((entry) => isThenable(entry.actionResult));
    if (!anyAsync) {
      return finishBulk(entries as Array<{ key: string; value: unknown; actionResult: SettingsResult }>);
    }
    return Promise.all(
      entries.map((entry) =>
        Promise.resolve(entry.actionResult).then((result) => ({ ...entry, actionResult: result }))
      )
    ).then((resolved) => finishBulk(resolved));
  }

  function applyCommand(name: string, payload: unknown): Promise<SettingsResult> {
    const lockKey = `cmd:${name}`;
    const prev = asyncLocks.get(lockKey);
    const run = () => doApplyCommand(name, payload);
    const next = prev ? prev.then(run, run) : run();
    trackAsyncLock(lockKey, next);
    return next;
  }

  async function doApplyCommand(name: string, payload: unknown): Promise<SettingsResult> {
    const command = commands[name];
    if (!command) {
      return { status: "error", message: `unknown command: ${name}` };
    }
    let result: any;
    try {
      result = await command(payload, buildDeps());
    } catch (err: any) {
      return { status: "error", message: `${name} command threw: ${err?.message}` };
    }
    if (!result || result.status !== "ok") {
      return result || { status: "error", message: `${name}: command returned no result` };
    }
    if (result.commit && typeof result.commit === "object") {
      const mergedSnapshot = { ...store.getSnapshot(), ...result.commit };
      const commitDeps = { ...injectedDeps, snapshot: mergedSnapshot };
      for (const key of Object.keys(result.commit)) {
        const entry = updates[key];
        if (!entry) {
          return { status: "error", message: `${name} commit: unknown settings key ${key}` };
        }
        const validator = resolveValidator(entry);
        if (!validator) continue;
        const recheck = runStep(
          `${name} commit validate ${key}`,
          validator as any,
          result.commit[key],
          commitDeps
        );
        if (isThenable(recheck)) {
          return {
            status: "error",
            message: `${name} commit ${key}: async validators unsupported in commit path`,
          };
        }
        if (!recheck || recheck.status !== "ok") return recheck;
      }
      const { changed } = store._commit(result.commit);
      if (changed) {
        const persisted = persistInternal();
        if (persisted.status !== "ok") return persisted;
      }
    }
    return { status: "ok", message: result.message };
  }

  function getSnapshot() {
    return store.getSnapshot();
  }

  function get(key: string) {
    return store.get(key);
  }

  function subscribe(fn: (...args: any[]) => void) {
    return store.subscribe(fn as any);
  }

  function subscribeKey(
    key: string,
    fn: (value: unknown, snapshot: SettingsSnapshot) => void
  ) {
    return store.subscribe(({ changes, snapshot }) => {
      if (key in changes) fn(changes[key], snapshot);
    });
  }

  function persist() {
    return persistInternal();
  }

  function isLocked() {
    return locked;
  }

  function dispose() {
    store.dispose();
  }

  return {
    applyUpdate,
    applyBulk,
    applyCommand,
    hydrate,
    getSnapshot,
    get,
    subscribe,
    subscribeKey,
    persist,
    isLocked,
    dispose,
  };
}
