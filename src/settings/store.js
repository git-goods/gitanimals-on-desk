"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStore = createStore;
function createStore(initialSnapshot) {
    if (!initialSnapshot || typeof initialSnapshot !== "object") {
        throw new TypeError("createStore(initialSnapshot): initialSnapshot must be an object");
    }
    let snapshot = { ...initialSnapshot };
    const listeners = new Set();
    let disposed = false;
    function getSnapshot() {
        return { ...snapshot };
    }
    function get(key) {
        return snapshot[key];
    }
    function subscribe(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("subscribe(fn): fn must be a function");
        }
        listeners.add(fn);
        return function unsubscribe() {
            listeners.delete(fn);
        };
    }
    function _commit(partial) {
        if (disposed)
            return { changed: false, changes: {} };
        if (!partial || typeof partial !== "object") {
            return { changed: false, changes: {} };
        }
        const changes = {};
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
        const broadcast = {
            changes,
            snapshot: { ...snapshot },
        };
        for (const fn of listeners) {
            try {
                fn(broadcast);
            }
            catch (err) {
                console.warn("GitAnimals: settings-store subscriber threw:", err?.message);
            }
        }
        return { changed: true, changes };
    }
    function dispose() {
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
