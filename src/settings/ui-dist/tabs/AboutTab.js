import { React, h } from "../react.js";
import { ABOUT_LINKS } from "../settings-data.js";
import { Section, SettingRow } from "../components.js";
export function AboutTab({ snapshot, t }) {
    const version = (snapshot && snapshot.appVersion) || "—";
    const openLink = (url) => (event) => {
        event.preventDefault();
        window.settingsAPI.openExternal(url);
    };
    const linkButton = (url) => (h("div", { className: "row-control" },
        h("button", { className: "btn", type: "button", onClick: openLink(url) }, t("aboutOpenLink"))));
    return (h(React.Fragment, null,
        h("h1", null, t("sidebarAbout")),
        h("p", { className: "subtitle" }, t("aboutSubtitle")),
        h(Section, { title: "" },
            h(SettingRow, { label: t("aboutVersion"), control: h("div", { className: "row-control" },
                    h("span", { className: "mono" }, `v${version}`)) }),
            h(SettingRow, { label: t("aboutLicense"), control: h("div", { className: "row-control" },
                    h("span", null, t("aboutLicenseValue"))) }),
            h(SettingRow, { label: t("aboutRepository"), desc: ABOUT_LINKS.repository, control: linkButton(ABOUT_LINKS.repository) }),
            h(SettingRow, { label: t("aboutHomepage"), desc: ABOUT_LINKS.homepage, control: linkButton(ABOUT_LINKS.homepage) }))));
}
