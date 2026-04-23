import { useState, useEffect } from "react";
import type { ThemeConfig, LayoutOverrides } from "../types";

interface Props {
  config: ThemeConfig;
  onLayoutChange: (overrides: LayoutOverrides) => void;
}

const SLIDERS = [
  { key: "baselineY" as const, label: "baselineY", min: -5, max: 25, step: 0.5 },
  { key: "visibleHeightRatio" as const, label: "visibleHeightRatio", min: 0.1, max: 1.2, step: 0.01 },
  { key: "baselineBottomRatio" as const, label: "baselineBottomRatio", min: -0.2, max: 0.3, step: 0.01 },
  { key: "centerX" as const, label: "centerX", min: -15, max: 25, step: 0.5 },
] as const;

function getDefaults(config: ThemeConfig): LayoutOverrides {
  const layout = config.layout || {};
  const cb = layout.contentBox || { x: 0, y: 0, width: 20, height: 20 };
  return {
    baselineY: layout.baselineY ?? cb.y + cb.height,
    visibleHeightRatio: layout.visibleHeightRatio ?? 0.58,
    baselineBottomRatio: layout.baselineBottomRatio ?? 0.05,
    centerX: layout.centerX ?? cb.x + cb.width / 2,
  };
}

export default function LayoutEditor({ config, onLayoutChange }: Props) {
  const [values, setValues] = useState<LayoutOverrides>(() => getDefaults(config));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const next = getDefaults(config);
    setValues(next);
    onLayoutChange(next);
  }, [config]);

  const updateValue = (key: keyof LayoutOverrides, val: number) => {
    const next = { ...values, [key]: val };
    setValues(next);
    onLayoutChange(next);
  };

  const json = JSON.stringify(values, null, 2);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div>
      {SLIDERS.map(({ key, label, min, max, step }) => (
        <div key={key} style={{ margin: "6px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa" }}>
            <span>{label}</span>
            <span style={{ color: "#e94560", fontWeight: "bold" }}>{values[key]}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={values[key]}
            onChange={(e) => updateValue(key, parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#e94560" }}
          />
        </div>
      ))}

      <div
        style={{
          marginTop: 8,
          padding: 8,
          background: "#0a0a1a",
          border: "1px solid #333",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 12,
          color: "#4fc3f7",
          whiteSpace: "pre",
        }}
      >
        {json}
      </div>

      <button
        onClick={copyToClipboard}
        style={{
          display: "block",
          width: "100%",
          padding: 8,
          marginTop: 8,
          background: copied ? "#27ae60" : "#e94560",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {copied ? "Copied!" : "Copy layout JSON"}
      </button>
    </div>
  );
}
