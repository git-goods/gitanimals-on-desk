import { useState, useCallback } from "react";
import type { ThemeConfig } from "../types";
import { Slider, CodeOutput, CopyButton } from "./shared";

interface Props {
  config: ThemeConfig;
  onTransformChange: (accName: string, transform: string) => void;
}

const SLIDERS = [
  { key: "tx" as const, label: "translateX", min: -10, max: 10, step: 0.1 },
  { key: "ty" as const, label: "translateY", min: -10, max: 10, step: 0.1 },
  { key: "s" as const, label: "scale", min: 0.1, max: 3, step: 0.05 },
  { key: "r" as const, label: "rotate", min: -180, max: 180, step: 1 },
];

function buildTransformString(v: { tx: number; ty: number; s: number; r: number }) {
  let t = `translate(${v.tx}, ${v.ty})`;
  if (v.s !== 1) t += ` scale(${v.s})`;
  if (v.r !== 0) t += ` rotate(${v.r})`;
  return t;
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
    if (selected) onTransformChange(selected, buildTransformString(next));
  };

  const transformString = buildTransformString(values);
  const copyText = `"transform": "${transformString}"`;

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
          {SLIDERS.map(({ key, label, min, max, step }) => (
            <Slider
              key={key}
              label={label}
              value={values[key]}
              min={min}
              max={max}
              step={step}
              onChange={(v) => updateValue(key, v)}
            />
          ))}
          <CodeOutput>{copyText}</CodeOutput>
          <CopyButton text={copyText} label="Copy transform" />
        </>
      )}
    </div>
  );
}
