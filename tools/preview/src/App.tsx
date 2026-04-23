import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useThemeList, useThemeConfig } from "./hooks/useThemeConfig";
import { useSSE } from "./hooks/useSSE";
import ThemePreview from "./components/ThemePreview";
import ThemeGallery from "./components/ThemeGallery";
import AccessoryEditor from "./components/AccessoryEditor";
import LayoutEditor from "./components/LayoutEditor";
import SvgPartsEditor from "./components/SvgPartsEditor";
import { SectionHeading, resolveLayoutDefaults } from "./components/shared";
import { MAIN_STATES } from "./types";
import type { LayoutOverrides, ThemeConfig, ThemeListItem } from "./types";

function getVisibleAccessories(config: ThemeConfig, state: string): string[] {
  const defs = config.accessories || {};
  return Object.keys(defs).filter((name) => {
    const anchors = defs[name]?.anchors;
    if (!anchors) return false;
    const anchor = anchors[state] !== undefined ? anchors[state] : anchors["*"];
    return anchor != null;
  });
}

function collectStates(config: ThemeConfig | null): string[] {
  if (!config) return [...MAIN_STATES];
  const mini = config.miniMode?.states ? Object.keys(config.miniMode.states) : [];
  return [...MAIN_STATES, ...mini];
}

function resolveFile(config: ThemeConfig, state: string): string | null {
  if (config.states?.[state]) return config.states[state][0];
  if (config.miniMode?.states?.[state]) return config.miniMode.states[state][0];
  return config.states?.idle?.[0] || null;
}

function resolveValidState(config: ThemeConfig | null, requestedState: string | null): string {
  const allStates = collectStates(config);
  if (requestedState && allStates.includes(requestedState) && config && resolveFile(config, requestedState)) {
    return requestedState;
  }
  if (config && resolveFile(config, "idle")) return "idle";
  return allStates.find((state) => (config ? Boolean(resolveFile(config, state)) : true)) || "idle";
}

function Toolbar({
  themes,
  currentThemeId,
  connected,
}: {
  themes: ThemeListItem[];
  currentThemeId?: string;
  connected: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isThemeRoute = location.pathname.startsWith("/themes/");
  const isEditorRoute = location.pathname.endsWith("/editor");
  const [searchParams] = useSearchParams();
  const selectedThemeId = currentThemeId && themes.some((theme) => theme.id === currentThemeId)
    ? currentThemeId
    : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#16213e", borderBottom: "1px solid #333", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <Link
          to="/"
          style={{
            padding: "5px 12px",
            background: !isThemeRoute ? "#e94560" : "#0f3460",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          Gallery
        </Link>
        {selectedThemeId ? (
          <>
            <Link
              to={`/themes/${encodeURIComponent(selectedThemeId)}`}
              style={{
                padding: "5px 12px",
                background: isThemeRoute && !isEditorRoute ? "#e94560" : "#0f3460",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 4,
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              All States
            </Link>
            <Link
              to={`/themes/${encodeURIComponent(selectedThemeId)}/editor?state=${encodeURIComponent(searchParams.get("state") || "idle")}`}
              style={{
                padding: "5px 12px",
                background: isEditorRoute ? "#e94560" : "#0f3460",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 4,
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              Editor
            </Link>
          </>
        ) : null}
      </div>

      {themes.length > 0 && (
        <select
          value={selectedThemeId}
          onChange={(e) => {
            const nextThemeId = e.target.value;
            if (!nextThemeId) {
              navigate("/");
              return;
            }
            if (isEditorRoute) {
              navigate(`/themes/${encodeURIComponent(nextThemeId)}/editor?state=${encodeURIComponent(searchParams.get("state") || "idle")}`);
              return;
            }
            navigate(`/themes/${encodeURIComponent(nextThemeId)}`);
          }}
          style={{ padding: "5px 10px", background: "#0f3460", color: "#e0e0e0", border: "1px solid #444", borderRadius: 4, fontSize: 13 }}
        >
          {!selectedThemeId && <option value="">Select theme</option>}
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      )}

      <div style={{ marginLeft: "auto", fontSize: 11, color: connected ? "#27ae60" : "#e94560" }}>
        {connected ? "watching" : "disconnected"}
      </div>
    </div>
  );
}

function ThemeNotFound({ themeId }: { themeId?: string }) {
  return (
    <div style={{ padding: 20, color: "#888" }}>
      Theme not found{themeId ? `: ${themeId}` : ""}.
    </div>
  );
}

function GalleryPage({ themes, refreshKey }: { themes: ThemeListItem[]; refreshKey: number }) {
  return <ThemeGallery themes={themes} refreshKey={refreshKey} />;
}

function ThemeStatesPage({ refreshKey, themes }: { refreshKey: number; themes: ThemeListItem[] }) {
  const { themeId } = useParams();
  const decodedThemeId = themeId ? decodeURIComponent(themeId) : null;
  const themeExists = decodedThemeId ? themes.some((theme) => theme.id === decodedThemeId) : false;
  const { config, loading } = useThemeConfig(decodedThemeId && themeExists ? decodedThemeId : null);

  const allStates = useMemo(() => collectStates(config), [config]);

  if (!decodedThemeId || !themeExists) {
    return <ThemeNotFound themeId={decodedThemeId || undefined} />;
  }

  if (loading && !config) {
    return <div style={{ padding: 20, color: "#888" }}>Loading theme...</div>;
  }

  if (!config) {
    return <ThemeNotFound themeId={decodedThemeId} />;
  }

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "calc(100vh - 52px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#e94560" }}>
          {decodedThemeId}
        </div>
        <Link
          to={`/themes/${encodeURIComponent(decodedThemeId)}/editor?state=idle`}
          style={{ color: "#4fc3f7", textDecoration: "none", fontSize: 12 }}
        >
          Open Editor
        </Link>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {allStates.map((state) => {
          const file = resolveFile(config, state);
          if (!file) return null;
          return (
            <Link
              key={`${decodedThemeId}-${state}-${refreshKey}`}
              to={`/themes/${encodeURIComponent(decodedThemeId)}/editor?state=${encodeURIComponent(state)}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <ThemePreview
                config={config}
                file={file}
                state={state}
                size={150}
                label={state}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ThemeEditorPage({ refreshKey, themes }: { refreshKey: number; themes: ThemeListItem[] }) {
  const { themeId } = useParams();
  const decodedThemeId = themeId ? decodeURIComponent(themeId) : null;
  const themeExists = decodedThemeId ? themes.some((theme) => theme.id === decodedThemeId) : false;
  const { config, loading } = useThemeConfig(decodedThemeId && themeExists ? decodedThemeId : null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [accOverride, setAccOverride] = useState<{ name: string; transform: string } | null>(null);
  const [layoutOverrides, setLayoutOverrides] = useState<LayoutOverrides | null>(null);
  const [svgPartOverride, setSvgPartOverride] = useState<{ id: string; transform: string } | null>(null);
  const [svgObj, setSvgObj] = useState<HTMLObjectElement | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  const allStates = useMemo(() => collectStates(config), [config]);
  const selectedState = resolveValidState(config, searchParams.get("state"));
  const currentFile = config ? resolveFile(config, selectedState) : null;

  useEffect(() => {
    if (config) {
      setLayoutOverrides(resolveLayoutDefaults(config));
      setAccOverride(null);
      setSvgPartOverride(null);
      setSvgObj(null);
      setPreviewVersion(0);
    }
  }, [config]);

  useEffect(() => {
    if (!config) return;
    config.activeAccessories = getVisibleAccessories(config, selectedState);
    setPreviewVersion((current) => current + 1);
  }, [config, selectedState, refreshKey]);

  if (!decodedThemeId || !themeExists) {
    return <ThemeNotFound themeId={decodedThemeId || undefined} />;
  }

  if (loading && !config) {
    return <div style={{ padding: 20, color: "#888" }}>Loading theme...</div>;
  }

  if (!config) {
    return <ThemeNotFound themeId={decodedThemeId} />;
  }

  if (searchParams.get("state") !== selectedState) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("state", selectedState);
    return <Navigate to={`/themes/${encodeURIComponent(decodedThemeId)}/editor?${nextParams.toString()}`} replace />;
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
        {currentFile ? (
          <ThemePreview
            key={`${decodedThemeId}-${selectedState}-${refreshKey}-${previewVersion}`}
            config={config}
            file={currentFile}
            state={selectedState}
            size={250}
            accessoryOverride={accOverride}
            layoutOverrides={layoutOverrides}
            svgPartOverride={svgPartOverride}
            onSvgLoad={setSvgObj}
          />
        ) : (
          <div style={{ color: "#666" }}>No preview available</div>
        )}
      </div>

      <div style={{ width: 320, background: "#16213e", borderLeft: "1px solid #333", overflowY: "auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
          {allStates.map((state) => (
            <button
              key={state}
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("state", state);
                setSearchParams(nextParams);
                setSvgPartOverride(null);
              }}
              style={{
                padding: "4px 8px",
                background: selectedState === state ? "#e94560" : "#0f3460",
                color: selectedState === state ? "#fff" : "#ccc",
                border: "1px solid #444",
                borderRadius: 4,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {state}
            </button>
          ))}
        </div>

        <SectionHeading>SVG Parts</SectionHeading>
        <SvgPartsEditor
          svgObject={svgObj}
          onPartChange={(id, transform) => setSvgPartOverride({ id, transform })}
        />

        <SectionHeading>Layout</SectionHeading>
        {layoutOverrides && (
          <LayoutEditor defaults={layoutOverrides} onLayoutChange={setLayoutOverrides} />
        )}

        <SectionHeading>Accessories</SectionHeading>
        {(() => {
          const visible = getVisibleAccessories(config, selectedState);
          const defs = config.accessories || {};
          if (visible.length === 0) return <div style={{ color: "#666", fontSize: 12 }}>No accessories for this state</div>;
          return (
            <div style={{ marginBottom: 16 }}>
              {visible.map((name) => (
                <label key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.activeAccessories?.includes(name)}
                    onChange={() => {
                      const active = config.activeAccessories || [];
                      config.activeAccessories = active.includes(name)
                        ? active.filter((item) => item !== name)
                        : [...active, name];
                      setPreviewVersion((current) => current + 1);
                    }}
                    style={{ accentColor: "#e94560" }}
                  />
                  {defs[name]?.name || name}
                </label>
              ))}
            </div>
          );
        })()}

        <SectionHeading>Transform Editor</SectionHeading>
        <AccessoryEditor
          config={config}
          onTransformChange={(name, transform) => setAccOverride({ name, transform })}
        />

        <SectionHeading>Info</SectionHeading>
        <div style={{ fontSize: 12, color: "#888" }}>
          <div>States: {Object.keys(config.states || {}).length}</div>
          <div>Mini: {config.miniMode?.states ? Object.keys(config.miniMode.states).length : 0}</div>
          <div>Accessories: {Object.keys(config.accessories || {}).length}</div>
          <div>
            ViewBox: {config.viewBox?.x},{config.viewBox?.y} {config.viewBox?.width}x{config.viewBox?.height}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const themes = useThemeList();
  const [refreshKey, setRefreshKey] = useState(0);
  const location = useLocation();
  const routeMatch = location.pathname.match(/^\/themes\/(.+?)(?:\/editor)?$/);
  const currentThemeId = routeMatch ? decodeURIComponent(routeMatch[1]) : undefined;

  const connected = useSSE(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, [])
  );

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, monospace", background: "#1a1a2e", color: "#e0e0e0", minHeight: "100vh" }}>
      <Toolbar themes={themes} currentThemeId={currentThemeId} connected={connected} />
      <Routes>
        <Route path="/" element={<GalleryPage themes={themes} refreshKey={refreshKey} />} />
        <Route path="/themes/:themeId" element={<ThemeStatesPage themes={themes} refreshKey={refreshKey} />} />
        <Route path="/themes/:themeId/editor" element={<ThemeEditorPage themes={themes} refreshKey={refreshKey} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
