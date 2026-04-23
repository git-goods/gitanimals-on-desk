import { useState } from "react";
import type { ThemeConfig, LayoutOverrides } from "../types";

// ── Layout Defaults ──

export function resolveLayoutDefaults(config: ThemeConfig): LayoutOverrides {
  const layout = config.layout || {};
  const cb = layout.contentBox || { x: 0, y: 0, width: 20, height: 20 };
  return {
    baselineY: layout.baselineY ?? cb.y + cb.height,
    visibleHeightRatio: layout.visibleHeightRatio ?? 0.58,
    baselineBottomRatio: layout.baselineBottomRatio ?? 0.05,
    centerX: layout.centerX ?? cb.x + cb.width / 2,
  };
}

// ── Slider ──

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div style={{ margin: "6px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa" }}>
        <span>{label}</span>
        <span style={{ color: "#e94560", fontWeight: "bold" }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#e94560" }}
      />
    </div>
  );
}

// ── Code Output ──

export function CodeOutput({ children }: { children: string }) {
  return (
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
        wordBreak: "break-all",
      }}
    >
      {children}
    </div>
  );
}

// ── Copy Button ──

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
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
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Section Heading ──

export function SectionHeading({ children }: { children: string }) {
  return (
    <h3 style={{ fontSize: 13, color: "#e94560", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </h3>
  );
}

// ── Transform Parse ──

export function parseTranslate(transform: string): { x: number; y: number; usesPx: boolean } {
  const m = transform.match(/translate\(\s*([-\d.]+)(?:px)?\s*,\s*([-\d.]+)(?:px)?\s*\)/);
  return {
    x: m ? parseFloat(m[1]) : 0,
    y: m ? parseFloat(m[2]) : 0,
    usesPx: transform.includes("px"),
  };
}
