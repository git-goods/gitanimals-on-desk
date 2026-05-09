import { h } from "../react.js";

export function PlaceholderTab({ t }: any) {
  return (
    <div className="placeholder">
      <div className="placeholder-icon">{"\u{1F6E0}"}</div>
      <div className="placeholder-title">{t("placeholderTitle")}</div>
      <div className="placeholder-desc">{t("placeholderDesc")}</div>
    </div>
  );
}
