import { React, h } from "../react.js";
import { Section, ToggleRow, UpdateSection, UserCard, } from "../components.js";
export function GeneralTab({ snapshot, t, pending, runUpdate, runCommand, userInfo, updateState, }) {
    const soundEnabled = !snapshot.soundMuted;
    return (h(React.Fragment, null,
        h("h1", null, t("settingsTitle")),
        h("p", { className: "subtitle" }, t("settingsSubtitle")),
        h(UserCard, { t: t, userInfo: userInfo, pending: !!pending.auth, onLogout: () => runCommand("auth", () => window.settingsAPI.command("logout")), onSignInAgain: () => runCommand("auth", () => window.settingsAPI.command("signIn")) }),
        h(Section, { title: t("sectionAppearance") },
            h(LanguageRow, { snapshot: snapshot, t: t, pending: !!pending.lang, onChange: (lang) => runUpdate("lang", "lang", lang) }),
            h(ToggleRow, { label: t("rowSound"), desc: t("rowSoundDesc"), on: soundEnabled, pending: !!pending.soundMuted, onToggle: () => runUpdate("soundMuted", "soundMuted", soundEnabled) }),
            h(ToggleRow, { label: t("rowFlip"), desc: t("rowFlipDesc"), on: !!snapshot.flip, pending: !!pending.flip, onToggle: () => runUpdate("flip", "flip", !snapshot.flip) })),
        h(Section, { title: t("sectionStartup") },
            h(ToggleRow, { label: t("rowOpenAtLogin"), desc: t("rowOpenAtLoginDesc"), on: !!snapshot.openAtLogin, pending: !!pending.openAtLogin, onToggle: () => runUpdate("openAtLogin", "openAtLogin", !snapshot.openAtLogin) }),
            h(ToggleRow, { label: t("rowStartWithClaude"), desc: t("rowStartWithClaudeDesc"), on: !!snapshot.autoStartWithClaude, pending: !!pending.autoStartWithClaude, onToggle: () => runUpdate("autoStartWithClaude", "autoStartWithClaude", !snapshot.autoStartWithClaude) }),
            h(ToggleRow, { label: t("rowAutoCheckUpdates"), desc: t("rowAutoCheckUpdatesDesc"), on: !!snapshot.autoCheckForUpdates, pending: !!pending.autoCheckForUpdates, onToggle: () => runUpdate("autoCheckForUpdates", "autoCheckForUpdates", !snapshot.autoCheckForUpdates) })),
        h(UpdateSection, { t: t, updateState: updateState, pending: pending, runCommand: runCommand }),
        snapshot.platform === "darwin" && (h(Section, { title: t("sectionMacOS") },
            h(ToggleRow, { label: t("rowShowInMenuBar"), desc: t("rowShowInMenuBarDesc"), on: !!snapshot.showTray, disabled: !!snapshot.showTray && !snapshot.showDock, pending: !!pending.showTray, onToggle: () => runUpdate("showTray", "showTray", !snapshot.showTray) }),
            h(ToggleRow, { label: t("rowShowInDock"), desc: t("rowShowInDockDesc"), on: !!snapshot.showDock, disabled: !!snapshot.showDock && !snapshot.showTray, pending: !!pending.showDock, onToggle: () => runUpdate("showDock", "showDock", !snapshot.showDock) }))),
        h(Section, { title: t("sectionBubbles") },
            h(ToggleRow, { label: t("rowBubbleFollow"), desc: t("rowBubbleFollowDesc"), on: !!snapshot.bubbleFollowPet, pending: !!pending.bubbleFollowPet, onToggle: () => runUpdate("bubbleFollowPet", "bubbleFollowPet", !snapshot.bubbleFollowPet) }),
            h(ToggleRow, { label: t("rowHideBubbles"), desc: t("rowHideBubblesDesc"), on: !!snapshot.hideBubbles, pending: !!pending.hideBubbles, onToggle: () => runUpdate("hideBubbles", "hideBubbles", !snapshot.hideBubbles) }),
            h(ToggleRow, { label: t("rowShowSessionId"), desc: t("rowShowSessionIdDesc"), on: !!snapshot.showSessionId, pending: !!pending.showSessionId, onToggle: () => runUpdate("showSessionId", "showSessionId", !snapshot.showSessionId) })),
        h(Section, { title: t("sectionPrivacy") },
            h(ToggleRow, { label: t("rowSendDiagnostics"), desc: t("rowSendDiagnosticsDesc"), on: snapshot.sendDiagnostics !== false, pending: !!pending.sendDiagnostics, onToggle: () => runUpdate("sendDiagnostics", "sendDiagnostics", snapshot.sendDiagnostics === false) }))));
}
function LanguageRow({ snapshot, t, pending, onChange }) {
    const current = snapshot.lang || "en";
    const options = [
        { value: "en", label: t("langEnglish") },
        { value: "zh", label: t("langChinese") },
        { value: "ko", label: t("langKorean") },
    ];
    return (h("div", { className: "row" },
        h("div", { className: "row-text" },
            h("span", { className: "row-label" }, t("rowLanguage")),
            h("span", { className: "row-desc" }, t("rowLanguageDesc"))),
        h("div", { className: "row-control" },
            h("div", { className: "segmented", role: "tablist" }, options.map((option) => (h("button", { key: option.value, className: option.value === current ? "active" : "", disabled: pending, onClick: () => {
                    if (option.value !== current)
                        onChange(option.value);
                } }, option.label)))))));
}
