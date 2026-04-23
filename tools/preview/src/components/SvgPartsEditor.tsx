import { useState, useEffect, useCallback } from "react";

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
    const groups = doc.querySelectorAll("g[id]");
    const parts: SvgPart[] = [];
    for (const g of groups) {
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
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    setTimeout(() => setParts(parseParts(svgObject)), 300);
  }, [svgObject]);

  useEffect(() => {
    refresh();
    setSelected(null);
  }, [svgObject, refresh]);

  const selectPart = (part: SvgPart) => {
    setSelected(part.id);
    const m = part.transform.match(/translate\(\s*([-\d.]+)(?:px)?\s*,\s*([-\d.]+)(?:px)?\s*\)/);
    setTx(m ? parseFloat(m[1]) : 0);
    setTy(m ? parseFloat(m[2]) : 0);
  };

  const usesPx = selected
    ? (parts.find((p) => p.id === selected)?.transform.includes("px") ?? false)
    : false;

  const updateTransform = (ntx: number, nty: number) => {
    if (!selected) return;
    const unit = usesPx ? "px" : "";
    const transform = `translate(${ntx}${unit}, ${nty}${unit})`;
    onPartChange(selected, transform);
  };

  const transformStr = (() => {
    const unit = usesPx ? "px" : "";
    return `translate(${tx}${unit}, ${ty}${unit})`;
  })();

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
          {([
            { label: "translateX", value: tx, setter: setTx },
            { label: "translateY", value: ty, setter: setTy },
          ] as const).map(({ label, value, setter }) => (
            <div key={label} style={{ margin: "6px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa" }}>
                <span>{label}</span>
                <span style={{ color: "#e94560", fontWeight: "bold" }}>{value}</span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                step={0.5}
                value={value}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setter(v);
                  const ntx = label === "translateX" ? v : tx;
                  const nty = label === "translateY" ? v : ty;
                  updateTransform(ntx, nty);
                }}
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
            }}
          >
            {`transform="${transformStr}"`}
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(`transform="${transformStr}"`).then(() => {
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
            {copied ? "Copied!" : "Copy transform"}
          </button>
        </>
      )}
    </div>
  );
}
