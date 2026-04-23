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
exports.createSettingsController = createSettingsController;
const store_1 = require("./store");
const prefsModule = __importStar(require("./prefs"));
const defaultActions = __importStar(require("./actions"));
function createSettingsController({ prefsPath, prefs = prefsModule, updates = defaultActions.updateRegistry, commands = defaultActions.commandRegistry, injectedDeps = {}, loadResult = null, } = {}) {
    if (!prefsPath && !loadResult) {
        throw new TypeError("createSettingsController: prefsPath or loadResult is required");
    }
    const loaded = loadResult || prefs.load(prefsPath);
    const initialSnapshot = loaded.snapshot;
    let locked = !!loaded.locked;
    const store = (0, store_1.createStore)(initialSnapshot);
    const asyncLocks = new Map();
    function trackAsyncLock(lockKey, promiseValue) {
        asyncLocks.set(lockKey, promiseValue);
        const cleanup = () => {
            if (asyncLocks.get(lockKey) === promiseValue)
                asyncLocks.delete(lockKey);
        };
        Promise.resolve(promiseValue).then(cleanup, cleanup);
    }
    function buildDeps() {
        return {
            ...injectedDeps,
            snapshot: store.getSnapshot(),
        };
    }
    function persistInternal() {
        if (locked)
            return { status: "ok", noop: true, locked: true };
        if (!prefsPath)
            return { status: "ok", noop: true };
        try {
            prefs.save(prefsPath, store.getSnapshot());
            return { status: "ok" };
        }
        catch (err) {
            console.warn("GitAnimals: failed to persist prefs:", err?.message);
            return { status: "error", message: err?.message };
        }
    }
    function isThenable(value) {
        return !!value && typeof value.then === "function";
    }
    function resolveValidator(entry) {
        if (typeof entry === "function")
            return entry;
        if (entry && typeof entry.validate === "function")
            return entry.validate;
        return null;
    }
    function resolveEffect(entry) {
        if (entry && typeof entry === "object" && typeof entry.effect === "function") {
            return entry.effect;
        }
        return null;
    }
    function runStep(label, fn, value, deps) {
        let raw;
        try {
            raw = fn(value, deps);
        }
        catch (err) {
            return { status: "error", message: `${label} threw: ${err?.message}` };
        }
        if (isThenable(raw)) {
            return raw.then((result) => result || { status: "error", message: `${label}: returned no result` }, (err) => ({ status: "error", message: `${label} threw: ${err?.message}` }));
        }
        return raw || { status: "error", message: `${label}: returned no result` };
    }
    function invokeAction(key, value, options = {}) {
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
        const validateResult = runStep(`${key} validate`, validator, value, buildDeps());
        const effect = options.skipEffect ? null : resolveEffect(entry);
        if (!effect)
            return validateResult;
        function maybeRunEffect(result) {
            if (!result || result.status !== "ok" || result.noop)
                return result;
            return runStep(`${key} effect`, effect, value, buildDeps());
        }
        if (isThenable(validateResult)) {
            return validateResult.then(maybeRunEffect);
        }
        return maybeRunEffect(validateResult);
    }
    function finishSingle(key, value, actionResult) {
        if (!actionResult || actionResult.status !== "ok") {
            return actionResult || {
                status: "error",
                message: `${key}: action returned no result`,
            };
        }
        if (actionResult.noop)
            return { status: "ok", noop: true };
        const { changed } = store._commit({ [key]: value });
        if (changed) {
            const persisted = persistInternal();
            if (persisted.status !== "ok")
                return persisted;
        }
        return { status: "ok" };
    }
    function doApplyUpdate(key, value) {
        const actionResult = invokeAction(key, value);
        if (isThenable(actionResult)) {
            return actionResult.then((result) => finishSingle(key, value, result));
        }
        return finishSingle(key, value, actionResult);
    }
    function applyUpdate(key, value) {
        const pending = asyncLocks.get(key);
        if (pending) {
            const next = pending.then(() => doApplyUpdate(key, value), () => doApplyUpdate(key, value));
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
    function commitBulk(accumulated) {
        const { changed } = store._commit(accumulated);
        if (changed) {
            const persisted = persistInternal();
            if (persisted.status !== "ok")
                return persisted;
        }
        return { status: "ok" };
    }
    function finishBulk(entries) {
        const accumulated = {};
        for (const { key, value, actionResult } of entries) {
            if (!actionResult || actionResult.status !== "ok") {
                return actionResult || {
                    status: "error",
                    message: `${key}: action returned no result`,
                };
            }
            if (actionResult.noop)
                continue;
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
            if (!validator)
                continue;
            const recheck = runStep(`${key} post-validate`, validator, accumulated[key], mergedDeps);
            if (isThenable(recheck)) {
                return recheck.then((result) => {
                    if (!result || result.status !== "ok")
                        return result;
                    return commitBulk(accumulated);
                });
            }
            if (!recheck || recheck.status !== "ok")
                return recheck;
        }
        return commitBulk(accumulated);
    }
    function applyBulk(partial) {
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
            return finishBulk(entries);
        }
        return Promise.all(entries.map((entry) => Promise.resolve(entry.actionResult).then((result) => ({ ...entry, actionResult: result })))).then((resolved) => finishBulk(resolved));
    }
    function hydrate(partial) {
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
            return finishBulk(entries);
        }
        return Promise.all(entries.map((entry) => Promise.resolve(entry.actionResult).then((result) => ({ ...entry, actionResult: result })))).then((resolved) => finishBulk(resolved));
    }
    function applyCommand(name, payload) {
        const lockKey = `cmd:${name}`;
        const prev = asyncLocks.get(lockKey);
        const run = () => doApplyCommand(name, payload);
        const next = prev ? prev.then(run, run) : run();
        trackAsyncLock(lockKey, next);
        return next;
    }
    async function doApplyCommand(name, payload) {
        const command = commands[name];
        if (!command) {
            return { status: "error", message: `unknown command: ${name}` };
        }
        let result;
        try {
            result = await command(payload, buildDeps());
        }
        catch (err) {
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
                if (!validator)
                    continue;
                const recheck = runStep(`${name} commit validate ${key}`, validator, result.commit[key], commitDeps);
                if (isThenable(recheck)) {
                    return {
                        status: "error",
                        message: `${name} commit ${key}: async validators unsupported in commit path`,
                    };
                }
                if (!recheck || recheck.status !== "ok")
                    return recheck;
            }
            const { changed } = store._commit(result.commit);
            if (changed) {
                const persisted = persistInternal();
                if (persisted.status !== "ok")
                    return persisted;
            }
        }
        return { status: "ok", message: result.message };
    }
    function getSnapshot() {
        return store.getSnapshot();
    }
    function get(key) {
        return store.get(key);
    }
    function subscribe(fn) {
        return store.subscribe(fn);
    }
    function subscribeKey(key, fn) {
        return store.subscribe(({ changes, snapshot }) => {
            if (key in changes)
                fn(changes[key], snapshot);
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
