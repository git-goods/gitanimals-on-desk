import { React, h } from "../react.js";
import { Section, ToggleRow } from "../components.js";
import type {
  PendingMap,
  RunCommand,
  Snapshot,
  ThemeMetadata,
  Translator,
} from "../types.js";

interface ThemeTabProps {
  snapshot: Snapshot;
  t: Translator;
  themeMetadata: ThemeMetadata[] | null;
  themeRefreshing: boolean;
  pending: PendingMap;
  runCommand: RunCommand;
  refreshThemes: () => void;
}

export function ThemeTab({
  snapshot,
  t,
  themeMetadata,
  themeRefreshing,
  pending,
  runCommand,
  refreshThemes,
}: ThemeTabProps) {
  const hasUnowned =
    Array.isArray(themeMetadata) &&
    themeMetadata.some((th) => th.type === "persona" && !th.owned);
  return (
    <>
      <div className="tab-header">
        <h1>{t("themeTabTitle")}</h1>
        <button
          className="btn"
          type="button"
          disabled={themeRefreshing}
          onClick={refreshThemes}
        >
          {themeRefreshing ? t("themeRefreshing") : t("themeRefresh")}
        </button>
      </div>
      <p className="subtitle">{t("themeTabSubtitle")}</p>
      {themeMetadata == null ? (
        <p className="subtitle">…</p>
      ) : (
        <Section title="">
          {themeMetadata.map((theme) => {
            const pinned = !!(
              snapshot.pinnedThemes && snapshot.pinnedThemes[theme.id]
            );
            const active = snapshot.theme === theme.id;
            const pendingKey = `theme:${theme.id}`;
            const unowned = theme.type === "persona" && !theme.owned;
            return (
              <ToggleRow
                key={theme.id}
                label={
                  theme.name +
                  (theme.builtin ? "" : " \u2746") +
                  (unowned ? " \uD83D\uDD12" : "")
                }
                desc={null}
                on={pinned}
                disabled={active || unowned}
                pending={!!pending[pendingKey]}
                onToggle={() =>
                  runCommand(pendingKey, async () => {
                    const result = await window.settingsAPI.command(
                      "togglePinnedTheme",
                      { themeId: theme.id },
                    );
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
                  })
                }
              />
            );
          })}
        </Section>
      )}
      {hasUnowned && (
        <div
          className="info-bar"
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>{"\uD83D\uDD12"}</span>
          <span>{t("personaInfo")}</span>
          <a
            href="#"
            style={{
              color: "#7eb8ff",
              textDecoration: "underline",
              cursor: "pointer",
              marginLeft: "4px",
              textAlign: "left",
            }}
            onClick={(e) => {
              e.preventDefault();
              window.settingsAPI.openExternal(t("toastPersonaLink"));
            }}
          >
            {t("personaInfoLink")}
          </a>
        </div>
      )}
    </>
  );
}
