import { h } from "../react.js";
export function PlaceholderTab({ t }) {
    return (h("div", { className: "placeholder" },
        h("div", { className: "placeholder-icon" }, "\u{1F6E0}"),
        h("div", { className: "placeholder-title" }, t("placeholderTitle")),
        h("div", { className: "placeholder-desc" }, t("placeholderDesc"))));
}
