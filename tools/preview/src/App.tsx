import { useState, useCallback, useRef } from "react";
import { useThemeList, useThemeConfig } from "./hooks/useThemeConfig";
import { useSSE } from "./hooks/useSSE";
import ThemePreview from "./components/ThemePreview";
import type { ThemePreviewHandle } from "./components/ThemePreview";
import ThemeGallery from "./components/ThemeGallery";
import AccessoryEditor from "./components/AccessoryEditor";
import LayoutEditor from "./components/LayoutEditor";
import SvgPartsEditor from "./components/SvgPartsEditor";
import { MAIN_STATES } from "./types";
import type { LayoutOverrides } from "./types";

type Mode = "single" | "gallery";
type SingleTab = "editor" | "all-states";

export default function App() {
  const themes = useThemeList();
  const [mode, setMode] = useState<Mode>("gallery");
  const [singleTab, setSingleTab] = useState<SingleTab>("all-states");
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState("idle");
  const [refreshKey, setRefreshKey] = useState(0);
  const [accOverride, setAccOverride] = useState<{ name: string; transform: string } | null>(null);
  const [layoutOverrides, setLayoutOverrides] = useState<LayoutOverrides | null>(null);
  const [svgPartOverride, setSvgPartOverride] = useState<{ id: string; transform: string } | null>(null);
  const previewRef = useRef<ThemePreviewHandle>(null);

  // Auto-select first theme
  if (themes.length > 0 && !selectedTheme) {
    setSelectedTheme(themes[0].id);
  }

  const { config, reload } = useThemeConfig(mode === "single" ? selectedTheme : null);
  // Also load when switching to single mode from gallery
  const connected = useSSE(
    useCallback(() => {
      reload();
      setRefreshKey((k) => k + 1);
    }, [reload])
  );

  const allStates = (() => {
    if (!config) return [...MAIN_STATES];
    const mini = config.miniMode?.states ? Object.keys(config.miniMode.states) : [];
    return [...MAIN_STATES, ...mini];
  })();

  const currentFile = (() => {
    if (!config) return null;
    if (config.states?.[selectedState]) return config.states[selectedState][0];
    if (config.miniMode?.states?.[selectedState]) return config.miniMode.states[selectedState][0];
    return config.states?.idle?.[0] || null;
  })();

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, monospace", background: "#1a1a2e", color: "#e0e0e0", minHeight: "100vh" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#16213e", borderBottom: "1px solid #333", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["single", "gallery"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "5px 12px",
                background: mode === m ? "#e94560" : "#0f3460",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {m === "single" ? "Single" : "Gallery"}
            </button>
          ))}
        </div>

        {mode === "single" && (
          <>
            <select
              value={selectedTheme || ""}
              onChange={(e) => { setSelectedTheme(e.target.value); setAccOverride(null); setLayoutOverrides(null); setSvgPartOverride(null); }}
              style={{ padding: "5px 10px", background: "#0f3460", color: "#e0e0e0", border: "1px solid #444", borderRadius: 4, fontSize: 13 }}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 4 }}>
              {(["all-states", "editor"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSingleTab(tab)}
                  style={{
                    padding: "4px 10px",
                    background: singleTab === tab ? "#4fc3f7" : "#0f3460",
                    color: singleTab === tab ? "#000" : "#ccc",
                    border: "1px solid #444",
                    borderRadius: 4,
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: singleTab === tab ? "bold" : "normal",
                  }}
                >
                  {tab === "all-states" ? "All States" : "Editor"}
                </button>
              ))}
            </div>

            {singleTab === "editor" && (
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {allStates.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSelectedState(s); setSvgPartOverride(null); }}
                    style={{
                      padding: "4px 8px",
                      background: selectedState === s ? "#e94560" : "#0f3460",
                      color: selectedState === s ? "#fff" : "#ccc",
                      border: "1px solid #444",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ marginLeft: "auto", fontSize: 11, color: connected ? "#27ae60" : "#e94560" }}>
          {connected ? "watching" : "disconnected"}
        </div>
      </div>

      {/* Content */}
      {mode === "gallery" ? (
        <ThemeGallery themes={themes} refreshKey={refreshKey} />
      ) : singleTab === "all-states" ? (
        /* All States grid for selected theme */
        <div style={{ padding: 20, overflowY: "auto", height: "calc(100vh - 52px)" }}>
          {config ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allStates.map((s) => {
                let file: string | null = null;
                if (config.states?.[s]) file = config.states[s][0];
                if (!file && config.miniMode?.states?.[s]) file = config.miniMode.states[s][0];
                if (!file) return null;
                return (
                  <ThemePreview
                    key={`${selectedTheme}-${s}-${refreshKey}`}
                    config={config}
                    file={file}
                    state={s}
                    size={150}
                    label={s}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#666" }}>Select a theme</div>
          )}
        </div>
      ) : (
        /* Editor: single preview + controls */
        <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
          {/* Preview */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
            {config && currentFile ? (
              <ThemePreview
                ref={previewRef}
                config={config}
                file={currentFile}
                state={selectedState}
                size={250}
                accessoryOverride={accOverride}
                layoutOverrides={layoutOverrides}
                svgPartOverride={svgPartOverride}
              />
            ) : (
              <div style={{ color: "#666" }}>Select a theme</div>
            )}
          </div>

          {/* Controls */}
          <div style={{ width: 320, background: "#16213e", borderLeft: "1px solid #333", overflowY: "auto", padding: 16 }}>
            <h3 style={{ fontSize: 13, color: "#e94560", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              SVG Parts
            </h3>
            <SvgPartsEditor
              svgObject={previewRef.current?.getObject() ?? null}
              onPartChange={(id, transform) => setSvgPartOverride({ id, transform })}
            />

            <h3 style={{ fontSize: 13, color: "#e94560", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Layout
            </h3>
            {config && (
              <LayoutEditor config={config} onLayoutChange={setLayoutOverrides} />
            )}

            <h3 style={{ fontSize: 13, color: "#e94560", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Accessories
            </h3>
            {config && (
              <div style={{ marginBottom: 16 }}>
                {Object.entries(config.accessories || {}).map(([name, def]) => (
                  <label key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={config.activeAccessories?.includes(name)}
                      onChange={() => {
                        const active = config.activeAccessories || [];
                        config.activeAccessories = active.includes(name)
                          ? active.filter((a) => a !== name)
                          : [...active, name];
                        setRefreshKey((k) => k + 1);
                      }}
                      style={{ accentColor: "#e94560" }}
                    />
                    {def.name || name}
                  </label>
                ))}
              </div>
            )}

            <h3 style={{ fontSize: 13, color: "#e94560", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Transform Editor
            </h3>
            {config && (
              <AccessoryEditor
                config={config}
                onTransformChange={(name, transform) => setAccOverride({ name, transform })}
              />
            )}

            <h3 style={{ fontSize: 13, color: "#e94560", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Info
            </h3>
            {config && (
              <div style={{ fontSize: 12, color: "#888" }}>
                <div>States: {Object.keys(config.states || {}).length}</div>
                <div>Mini: {config.miniMode?.states ? Object.keys(config.miniMode.states).length : 0}</div>
                <div>Accessories: {Object.keys(config.accessories || {}).length}</div>
                <div>
                  ViewBox: {config.viewBox?.x},{config.viewBox?.y} {config.viewBox?.width}x{config.viewBox?.height}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
