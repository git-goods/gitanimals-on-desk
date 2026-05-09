import { React, h, useEffect, useMemo, useRef, useState } from "./react.js";
import { SIDEBAR_TABS, translate } from "./settings-data.js";
import { Sidebar, ToastStack } from "./components.js";
import { AboutTab, AgentsTab, GeneralTab, PlaceholderTab, ThemeTab, } from "./tabs/index.js";
export function App() {
    const [snapshot, setSnapshot] = useState(null);
    const [updateState, setUpdateState] = useState(null);
    const [activeTab, setActiveTab] = useState("general");
    const [agentMetadata, setAgentMetadata] = useState([]);
    const [themeMetadata, setThemeMetadata] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [themeRefreshing, setThemeRefreshing] = useState(false);
    const [pending, setPending] = useState({});
    const [toasts, setToasts] = useState([]);
    const toastTimers = useRef(new Map());
    const pendingRef = useRef({});
    const snapshotRef = useRef(null);
    const t = (key) => translate(snapshot || {}, key);
    useEffect(() => {
        pendingRef.current = pending;
    }, [pending]);
    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);
    function pushToast(message, options = {}) {
        const id = `${Date.now()}:${Math.random()}`;
        setToasts((current) => current.concat([{ id, message, error: !!options.error }]));
        const timer = setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
            toastTimers.current.delete(id);
        }, options.ttl || 3500);
        toastTimers.current.set(id, timer);
    }
    function withPending(key, work) {
        if (pendingRef.current[key])
            return Promise.resolve();
        setPending((current) => ({ ...current, [key]: true }));
        return Promise.resolve()
            .then(work)
            .then((result) => {
            if (!result || result.status !== "ok") {
                const message = (result && result.message) || "unknown error";
                pushToast(t("toastSaveFailed") + message, { error: true });
            }
            return result;
        })
            .catch((err) => {
            pushToast(t("toastSaveFailed") + (err && err.message), { error: true });
            return null;
        })
            .finally(() => {
            setPending((current) => {
                const next = { ...current };
                delete next[key];
                return next;
            });
        });
    }
    function runUpdate(pendingKey, key, value) {
        return withPending(pendingKey, () => window.settingsAPI.update(key, value));
    }
    function runCommand(pendingKey, work) {
        return withPending(pendingKey, work);
    }
    function refreshThemes() {
        if (themeRefreshing)
            return;
        setThemeRefreshing(true);
        window.settingsAPI
            .command("refreshThemes")
            .then((result) => {
            if (!result || result.status !== "ok") {
                pushToast(t("themeRefreshFailed") +
                    ((result && result.message) || result.status || "unknown error"), { error: true });
                return null;
            }
            pushToast(t("themeRefreshDone"));
            return window.settingsAPI.listThemes();
        })
            .then((list) => {
            if (Array.isArray(list))
                setThemeMetadata(list);
        })
            .catch((err) => {
            pushToast(t("themeRefreshFailed") + (err && err.message), {
                error: true,
            });
        })
            .finally(() => {
            setThemeRefreshing(false);
        });
    }
    useEffect(() => {
        let mounted = true;
        window.settingsAPI.getSnapshot().then((nextSnapshot) => {
            if (mounted)
                setSnapshot(nextSnapshot || {});
        });
        window.settingsAPI.getUpdateState().then((nextUpdateState) => {
            if (mounted)
                setUpdateState(nextUpdateState || null);
        });
        window.settingsAPI
            .listAgents()
            .then((list) => {
            if (mounted)
                setAgentMetadata(Array.isArray(list) ? list : []);
        })
            .catch((err) => {
            console.warn("settings: listAgents failed", err);
            if (mounted)
                setAgentMetadata([]);
        });
        window.settingsAPI
            .listThemes()
            .then((list) => {
            if (mounted)
                setThemeMetadata(Array.isArray(list) ? list : []);
        })
            .catch((err) => {
            console.warn("settings: listThemes failed", err);
            if (mounted)
                setThemeMetadata([]);
        });
        window.settingsAPI
            .getUser()
            .then((user) => {
            if (mounted)
                setUserInfo(user && user.username ? user : null);
        })
            .catch(() => {
            if (mounted)
                setUserInfo(null);
        });
        const offChanged = window.settingsAPI.onChanged((payload) => {
            setSnapshot((current) => {
                if (payload && payload.snapshot)
                    return payload.snapshot;
                if (payload && payload.changes && current)
                    return { ...current, ...payload.changes };
                return current;
            });
        });
        const offUpdateState = window.settingsAPI.onUpdateStateChanged((nextUpdateState) => {
            if (mounted)
                setUpdateState(nextUpdateState || null);
        });
        const offTab = window.settingsAPI.onSetTab((tab) => {
            const next = SIDEBAR_TABS.find((entry) => entry.id === tab && entry.available);
            if (next)
                setActiveTab(next.id);
        });
        const offExpired = window.settingsAPI.onSessionExpired(() => {
            pushToast(translate(snapshotRef.current || {}, "sessionExpiredToast"), {
                error: true,
                ttl: 8000,
            });
        });
        return () => {
            mounted = false;
            offChanged();
            offUpdateState();
            offTab();
            offExpired();
            for (const timer of toastTimers.current.values())
                clearTimeout(timer);
            toastTimers.current.clear();
        };
    }, []);
    const content = useMemo(() => {
        const safeSnapshot = snapshot || {};
        if (activeTab === "general") {
            return (h(GeneralTab, { snapshot: safeSnapshot, t: t, pending: pending, runUpdate: runUpdate, runCommand: runCommand, userInfo: userInfo, updateState: updateState }));
        }
        if (activeTab === "agents") {
            return (h(AgentsTab, { snapshot: safeSnapshot, t: t, agentMetadata: agentMetadata, pending: pending, runCommand: runCommand }));
        }
        if (activeTab === "theme") {
            return (h(ThemeTab, { snapshot: safeSnapshot, t: t, themeMetadata: themeMetadata, themeRefreshing: themeRefreshing, pending: pending, runCommand: runCommand, refreshThemes: refreshThemes }));
        }
        if (activeTab === "about") {
            return h(AboutTab, { snapshot: safeSnapshot, t: t });
        }
        return h(PlaceholderTab, { t: t });
    }, [
        activeTab,
        agentMetadata,
        pending,
        snapshot,
        themeMetadata,
        themeRefreshing,
        userInfo,
        updateState,
    ]);
    return (h(React.Fragment, null,
        h("div", { className: "app" },
            h(Sidebar, { activeTab: activeTab, setActiveTab: setActiveTab, t: t }),
            h("main", { className: "content", id: "content" }, content)),
        h(ToastStack, { toasts: toasts })));
}
