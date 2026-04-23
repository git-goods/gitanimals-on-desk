import { useState } from "react";
import type { LayoutOverrides } from "../types";
import { Slider, CodeOutput, CopyButton } from "./shared";

interface Props {
  defaults: LayoutOverrides;
  onLayoutChange: (overrides: LayoutOverrides) => void;
}

const SLIDERS: { key: keyof LayoutOverrides; min: number; max: number; step: number }[] = [
  { key: "baselineY", min: -5, max: 25, step: 0.5 },
  { key: "visibleHeightRatio", min: 0.1, max: 1.2, step: 0.01 },
  { key: "baselineBottomRatio", min: -0.2, max: 0.3, step: 0.01 },
  { key: "centerX", min: -15, max: 25, step: 0.5 },
];

export default function LayoutEditor({ defaults, onLayoutChange }: Props) {
  const [values, setValues] = useState<LayoutOverrides>(defaults);

  const updateValue = (key: keyof LayoutOverrides, val: number) => {
    const next = { ...values, [key]: val };
    setValues(next);
    onLayoutChange(next);
  };

  const json = JSON.stringify(values, null, 2);

  return (
    <div>
      {SLIDERS.map(({ key, min, max, step }) => (
        <Slider
          key={key}
          label={key}
          value={values[key]}
          min={min}
          max={max}
          step={step}
          onChange={(v) => updateValue(key, v)}
        />
      ))}
      <CodeOutput>{json}</CodeOutput>
      <CopyButton text={json} label="Copy layout JSON" />
    </div>
  );
}
