import { useState, useCallback } from "react";
import type { ThemeConfig } from "../types";

interface Props {
  config: ThemeConfig;
  onTransformChange: (accName: string, transform: string) => void;
}

export default function AccessoryEditor({ config, onTransformChange }: Props) {
  const defs = config.accessories || {};
  const accNames = Object.keys(defs);
  const [selected, setSelected] = useState<string | null>(accNames[0] || null);
  const [values, setValues] = useState({ tx: 0, ty: 0, s: 1, r: 0 });

  const selectAccessory = useCallback(
    (name: string) => {
      setSelected(name);
      const def = defs[name];
      const anchor = def?.anchors?.["*"] || Object.values(def?.anchors || {}).find((a) => a?.transform);
      if (anchor && "transform" in anchor && anchor.transform) {
        const tm = anchor.transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
        const sm = anchor.transform.match(/scale\(\s*([-\d.]+)\s*\)/);
        const rm = anchor.transform.match(/rotate\(\s*([-\d.]+)\s*\)/);
        setValues({
          tx: tm ? parseFloat(tm[1]) : 0,
          ty: tm ? parseFloat(tm[2]) : 0,
          s: sm ? parseFloat(sm[1]) : 1,
          r: rm ? parseFloat(rm[1]) : 0,
        });
      }
    },
    [defs]
  );

  const updateValue = (key: keyof typeof values, val: number) => {
    const next = { ...values, [key]: val };
    setValues(next);

    let transform = `translate(${next.tx}, ${next.ty})`;
    if (next.s !== 1) transform += ` scale(${next.s})`;
    if (next.r !== 0) transform += ` rotate(${next.r})`;

    if (selected) onTransformChange(selected, transform);
  };

  const transformString = (() => {
    let t = `translate(${values.tx}, ${values.ty})`;
    if (values.s !== 1) t += ` scale(${values.s})`;
    if (values.r !== 0) t += ` rotate(${values.r})`;
    return t;
  })();

  const [copied, setCopied] = useState(false);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(`"transform": "${transformString}"`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (accNames.length === 0) {
    return <div style={{ color: "#666", fontSize: 12 }}>No accessories</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {accNames.map((name) => (
          <button
            key={name}
            onClick={() => selectAccessory(name)}
            style={{
              padding: "4px 10px",
              background: selected === name ? "#e94560" : "#0f3460",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {defs[name].name || name}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {([
            { key: "tx" as const, label: "translateX", min: -10, max: 10, step: 0.1 },
            { key: "ty" as const, label: "translateY", min: -10, max: 10, step: 0.1 },
            { key: "s" as const, label: "scale", min: 0.1, max: 3, step: 0.05 },
            { key: "r" as const, label: "rotate", min: -180, max: 180, step: 1 },
          ]).map(({ key, label, min, max, step }) => (
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
              wordBreak: "break-all",
            }}
          >
            {`"transform": "${transformString}"`}
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
            {copied ? "Copied!" : "Copy transform"}
          </button>
        </>
      )}
    </div>
  );
}
