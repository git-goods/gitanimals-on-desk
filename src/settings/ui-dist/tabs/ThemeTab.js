import { React, h } from "../react.js";
import { Section } from "../components.js";
import { ToggleRow } from "./ToggleRow.js";
export function ThemeTab({ snapshot, t, themeMetadata, themeRefreshing, pending, runCommand, refreshThemes, }) {
    const hasUnowned = Array.isArray(themeMetadata) &&
        themeMetadata.some((th) => th.type === "persona" && !th.owned);
    return (h(React.Fragment, null,
        h("div", { className: "tab-header" },
            h("h1", null, t("themeTabTitle")),
            h("button", { className: "btn", type: "button", disabled: themeRefreshing, onClick: refreshThemes }, themeRefreshing ? t("themeRefreshing") : t("themeRefresh"))),
        h("p", { className: "subtitle" }, t("themeTabSubtitle")),
        themeMetadata == null ? (h("p", { className: "subtitle" }, "\u2026")) : (h(Section, { title: "" }, themeMetadata.map((theme) => {
            const pinned = !!(snapshot.pinnedThemes && snapshot.pinnedThemes[theme.id]);
            const active = snapshot.theme === theme.id;
            const pendingKey = `theme:${theme.id}`;
            const unowned = theme.type === "persona" && !theme.owned;
            return (h(ToggleRow, { key: theme.id, label: theme.name +
                    (theme.builtin ? "" : " \u2746") +
                    (unowned ? " \uD83D\uDD12" : ""), desc: null, on: pinned, disabled: active || unowned, pending: !!pending[pendingKey], onToggle: () => runCommand(pendingKey, async () => {
                    const result = await window.settingsAPI.command("togglePinnedTheme", { themeId: theme.id });
                    if (result && result.status === "active-locked") {
                        return {
                            status: "error",
                            message: t("toastActiveLocked"),
                        };
                    }
                    if (result && result.status === "min-one-required") {
                        return {
                            status: "error",
                            message: t("toastMinOneRequired"),
                        };
                    }
                    return result;
                }) }));
        }))),
        hasUnowned && (h("div", { className: "info-bar", style: {
                marginTop: "12px",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.6)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
            } },
            h("span", null, "\uD83D\uDD12"),
            h("span", null, t("personaInfo")),
            h("a", { href: "#", style: {
                    color: "#7eb8ff",
                    textDecoration: "underline",
                    cursor: "pointer",
                    marginLeft: "4px",
                    textAlign: "left",
                }, onClick: (e) => {
                    e.preventDefault();
                    window.settingsAPI.openExternal(t("toastPersonaLink"));
                } }, t("personaInfoLink"))))));
}
