import { useState, useEffect } from "react";
import { Slider, CodeOutput, CopyButton, parseTranslate } from "./shared";

interface SvgPart {
  id: string;
  transform: string;
}

interface Props {
  svgObject: HTMLObjectElement | null;
  onPartChange: (id: string, transform: string) => void;
}

function parseParts(obj: HTMLObjectElement | null): SvgPart[] {
  if (!obj) return [];
  try {
    const doc = obj.contentDocument;
    if (!doc) return [];
    const parts: SvgPart[] = [];
    for (const g of doc.querySelectorAll("g[id]")) {
      if (g.getAttribute("data-accessory")) continue;
      parts.push({ id: g.id, transform: g.getAttribute("transform") || "" });
    }
    return parts;
  } catch {
    return [];
  }
}

export default function SvgPartsEditor({ svgObject, onPartChange }: Props) {
  const [parts, setParts] = useState<SvgPart[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [usesPx, setUsesPx] = useState(false);

  useEffect(() => {
    if (!svgObject) { setParts([]); setSelected(null); return; }

    const tryParse = () => setParts(parseParts(svgObject));

    if (svgObject.contentDocument?.documentElement) {
      tryParse();
    }
    svgObject.addEventListener("load", tryParse);
    setSelected(null);

    return () => svgObject.removeEventListener("load", tryParse);
  }, [svgObject]);

  const selectPart = (part: SvgPart) => {
    setSelected(part.id);
    const parsed = parseTranslate(part.transform);
    setTx(parsed.x);
    setTy(parsed.y);
    setUsesPx(parsed.usesPx);
  };

  const buildTransform = (x: number, y: number) => {
    const unit = usesPx ? "px" : "";
    return `translate(${x}${unit}, ${y}${unit})`;
  };

  const transformStr = buildTransform(tx, ty);

  if (parts.length === 0) {
    return <div style={{ color: "#666", fontSize: 12 }}>No editable parts</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {parts.map((p) => (
          <button
            key={p.id}
            onClick={() => selectPart(p)}
            style={{
              padding: "3px 8px",
              background: selected === p.id ? "#e94560" : "#0f3460",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: 4,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {p.id}
          </button>
        ))}
      </div>

      {selected && (
        <>
          <Slider label="translateX" value={tx} min={-30} max={30} step={0.5}
            onChange={(v) => { setTx(v); onPartChange(selected, buildTransform(v, ty)); }} />
          <Slider label="translateY" value={ty} min={-30} max={30} step={0.5}
            onChange={(v) => { setTy(v); onPartChange(selected, buildTransform(tx, v)); }} />
          <CodeOutput>{`transform="${transformStr}"`}</CodeOutput>
          <CopyButton text={`transform="${transformStr}"`} label="Copy transform" />
        </>
      )}
    </div>
  );
}
