import { h } from "../react.js";
import type { Translator } from "../types.js";

interface PlaceholderTabProps {
  t: Translator;
}

export function PlaceholderTab({ t }: PlaceholderTabProps) {
  return (
    <div className="placeholder">
      <div className="placeholder-icon">{"\u{1F6E0}"}</div>
      <div className="placeholder-title">{t("placeholderTitle")}</div>
      <div className="placeholder-desc">{t("placeholderDesc")}</div>
    </div>
  );
}
