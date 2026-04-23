import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { ThemeListItem, ThemeConfig } from "../types";
import ThemePreview from "./ThemePreview";
import { MAIN_STATES } from "../types";

interface Props {
  themes: ThemeListItem[];
  refreshKey: number;
}

interface ThemeEntry {
  theme: ThemeListItem;
  config: ThemeConfig;
  allStates: string[];
}

export default function ThemeGallery({ themes, refreshKey }: Props) {
  const [entries, setEntries] = useState<ThemeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (themes.length === 0) return;
    setLoading(true);

    Promise.all(
      themes.map(async (theme) => {
        try {
          const res = await fetch(
            `/api/themes/${encodeURIComponent(theme.id)}/config`,
          );
          const config: ThemeConfig = await res.json();
          if (config.error) return null;

          const mainStates = [...MAIN_STATES].filter((s) => config.states?.[s]);
          const miniStates = config.miniMode?.states
            ? Object.keys(config.miniMode.states)
            : [];

          return { theme, config, allStates: [...mainStates, ...miniStates] };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      setEntries(results.filter(Boolean) as ThemeEntry[]);
      setLoading(false);
    });
  }, [themes, refreshKey]);

  if (loading) {
    return (
      <div style={{ padding: 20, color: "#888" }}>Loading all themes...</div>
    );
  }

  return (
    <div
      style={{ padding: 20, overflowY: "auto", height: "calc(100vh - 52px)" }}
    >
      {entries.map(({ theme, config, allStates }) => (
        <div key={theme.id} style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 14,
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: "1px solid #333",
            }}
          >
            <div>
              <span style={{ color: "#e94560" }}>{theme.name}</span>
              <span style={{ color: "#666", fontSize: 12, marginLeft: 8 }}>
                {theme.id}
                {config.activeAccessories?.length > 0 &&
                  ` + ${config.activeAccessories.join(", ")}`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link
                to={`/themes/${encodeURIComponent(theme.id)}`}
                style={{
                  color: "#4fc3f7",
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                All States
              </Link>
              <Link
                to={`/themes/${encodeURIComponent(theme.id)}/editor?state=idle`}
                style={{
                  color: "#e94560",
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Editor
              </Link>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allStates.map((state) => {
              let file: string | null = null;
              if (config.states?.[state]) file = config.states[state][0];
              if (!file && config.miniMode?.states?.[state])
                file = config.miniMode.states[state][0];
              if (!file) return null;

              return (
                <Link
                  key={`${theme.id}-${state}`}
                  to={`/themes/${encodeURIComponent(theme.id)}/editor?state=${encodeURIComponent(state)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <ThemePreview
                    config={config}
                    file={file}
                    state={state}
                    size={120}
                    label={state}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
