import { h } from "./react.js";
import { SIDEBAR_TABS } from "./settings-data.js";
function cx(...parts) {
    return parts.filter(Boolean).join(" ");
}
export function ToastStack({ toasts }) {
    return (h("div", { className: "toast-stack", id: "toastStack" }, toasts.map((toast) => (h("div", { key: toast.id, className: cx("toast", toast.error && "error", "visible") }, toast.message)))));
}
export function Sidebar({ activeTab, setActiveTab, t }) {
    return (h("nav", { className: "sidebar", id: "sidebar" }, SIDEBAR_TABS.map((tab) => (h("div", { key: tab.id, className: cx("sidebar-item", !tab.available && "disabled", tab.id === activeTab && "active"), onClick: tab.available ? () => setActiveTab(tab.id) : undefined },
        h("span", { className: "sidebar-item-icon" }, tab.icon),
        h("span", { className: "sidebar-item-label" }, t(tab.labelKey)),
        !tab.available && (h("span", { className: "sidebar-item-soon" }, t("sidebarSoon"))))))));
}
export function Section({ title, children }) {
    return (h("section", { className: "section" },
        title ? h("h2", { className: "section-title" }, title) : null,
        h("div", { className: "section-rows" }, children)));
}
export function SwitchControl({ on, pending, disabled, onToggle }) {
    const handleKeyDown = (event) => {
        if (disabled || pending)
            return;
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            onToggle();
        }
    };
    return (h("div", { className: "row-control" },
        h("div", { className: cx("switch", on && "on", pending && "pending", disabled && "disabled"), role: "switch", tabIndex: disabled ? -1 : 0, "aria-checked": on ? "true" : "false", onClick: disabled || pending ? undefined : onToggle, onKeyDown: handleKeyDown })));
}
export function SettingRow({ label, desc, control, extraClass }) {
    return (h("div", { className: cx("row", extraClass) },
        h("div", { className: "row-text" },
            h("span", { className: "row-label" }, label),
            desc ? h("span", { className: "row-desc" }, desc) : null),
        control));
}
export function ToggleRow({ label, desc, on, pending, disabled, onToggle, extraClass, }) {
    return (h(SettingRow, { label: label, desc: desc, extraClass: extraClass, control: h(SwitchControl, { on: on, pending: pending, disabled: disabled, onToggle: onToggle }) }));
}
export function UserCard({ t, userInfo, pending, onLogout, onSignInAgain, }) {
    return (h(Section, { title: "" },
        h("div", { className: "row" },
            h("div", { className: "row-text" },
                h("span", { className: "row-label" }, userInfo
                    ? `\u{1F464} @${userInfo.username}`
                    : `\u{1F464} ${t("userCardLoading")}`),
                h("span", { className: "row-desc" }, t("userCardSignedIn"))),
            h("div", { className: "row-control", style: { display: "flex", gap: "6px" } },
                h("button", { className: "btn", type: "button", disabled: pending, onClick: onLogout }, t("userCardSignOut")),
                h("button", { className: "btn", type: "button", disabled: pending, onClick: onSignInAgain }, t("userCardSignInAgain"))))));
}
function formatDateTime(value) {
    if (!value)
        return "";
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value));
    }
    catch {
        return new Date(value).toLocaleString();
    }
}
export function UpdateSection({ t, updateState, pending, runCommand, }) {
    const status = (updateState && updateState.status) || "idle";
    const currentVersion = (updateState && updateState.currentVersion) || "0.0.0";
    const latestVersion = (updateState && updateState.latestVersion) || "";
    const lastCheckedAt = updateState && updateState.lastCheckedAt;
    const lastError = (updateState && updateState.lastError) || "";
    const isUpToDate = status === "idle" &&
        latestVersion &&
        String(latestVersion).replace(/^v/, "") ===
            String(currentVersion).replace(/^v/, "");
    let statusText = t("updateStatusIdle");
    if (isUpToDate)
        statusText = t("updateStatusUpToDate");
    else if (status === "checking")
        statusText = t("updateStatusChecking");
    else if (status === "available")
        statusText = t("updateStatusAvailable");
    else if (status === "downloading")
        statusText = t("updateStatusDownloading");
    else if (status === "ready")
        statusText = t("updateStatusReady");
    else if (status === "error")
        statusText = t("updateStatusError");
    return (h(Section, { title: t("sectionUpdates") },
        h("div", { className: "update-card" },
            h("div", { className: "update-summary" },
                h("div", { className: cx("update-status", status) }, statusText),
                h("div", { className: "update-meta-grid" },
                    h("span", { className: "update-meta-label" }, t("updateCurrentVersion")),
                    h("span", { className: "update-meta-value mono" }, `v${currentVersion}`),
                    h("span", { className: "update-meta-label" }, t("updateLatestVersion")),
                    h("span", { className: "update-meta-value mono" }, latestVersion
                        ? `v${String(latestVersion).replace(/^v/, "")}`
                        : "—"),
                    h("span", { className: "update-meta-label" }, t("updateLastChecked")),
                    h("span", { className: "update-meta-value" }, lastCheckedAt
                        ? formatDateTime(lastCheckedAt)
                        : t("updateNeverChecked"))),
                updateState ? (h("div", { className: "update-flow" }, updateState.flow === "git"
                    ? t("updateFlowGit")
                    : t("updateFlowAuto"))) : null,
                lastError ? (h("div", { className: "update-error-text" }, lastError)) : null),
            h("div", { className: "update-actions" },
                h("button", { key: "check", className: "btn", type: "button", disabled: !!pending.checkForUpdates ||
                        !updateState ||
                        !updateState.canCheck, onClick: () => runCommand("checkForUpdates", () => window.settingsAPI.command("checkForUpdatesFromSettings")) }, t("updateCheckNow")),
                updateState && updateState.canApplyUpdate && (h("button", { key: "apply", className: "btn primary", type: "button", disabled: !!pending.applyUpdate, onClick: () => runCommand("applyUpdate", () => window.settingsAPI.command("applyUpdateFromSettings")) }, updateState.flow === "git"
                    ? t("updateInstallNow")
                    : t("updateDownloadNow"))),
                updateState && updateState.canRestartToUpdate && (h("button", { key: "restart", className: "btn primary", type: "button", disabled: !!pending.restartToUpdate, onClick: () => runCommand("restartToUpdate", () => window.settingsAPI.command("restartToUpdateFromSettings")) }, t("updateRestartNow")))))));
}
