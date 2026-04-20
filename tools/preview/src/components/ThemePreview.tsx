import { useRef, useEffect } from "react";
import type { ThemeConfig } from "../types";

interface Props {
  config: ThemeConfig;
  file: string;
  state: string;
  size?: number;
  label?: string;
  accessoryOverride?: { name: string; transform: string } | null;
}

export default function ThemePreview({ config, file, state, size = 200, label, accessoryOverride }: Props) {
  const objRef = useRef<HTMLObjectElement>(null);

  useEffect(() => {
    const obj = objRef.current;
    if (!obj) return;

    const onLoad = () => injectAccessories(obj, config, state, accessoryOverride);
    obj.addEventListener("load", onLoad);
    // Also try immediately (may already be loaded)
    injectAccessories(obj, config, state, accessoryOverride);

    return () => obj.removeEventListener("load", onLoad);
  }, [config, file, state, accessoryOverride]);

  const url = `${config.assetsPath}/${file}`;
  const os = config.objectScale || { widthRatio: 1.9, heightRatio: 1.3, offsetX: -0.45, offsetY: -0.25 };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {label && <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{label}</div>}
      <div
        style={{
          width: size,
          height: size,
          background: "#111",
          border: "1px solid #333",
          borderRadius: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {file.endsWith(".svg") ? (
          <object
            ref={objRef}
            key={`${file}-${state}-${config.assetsPath}`}
            type="image/svg+xml"
            data={url}
            style={{
              position: "absolute",
              width: `${os.widthRatio * 100}%`,
              height: `${os.heightRatio * 100}%`,
              left: `${os.offsetX * 100}%`,
              bottom: `${(os.objBottom != null ? os.objBottom : 1 - os.offsetY - os.heightRatio) * 100}%`,
            }}
          />
        ) : (
          <img
            src={url}
            style={{
              position: "absolute",
              width: `${os.widthRatio * 100}%`,
              height: "auto",
              left: `${os.offsetX * 100}%`,
              bottom: "5%",
            }}
          />
        )}
      </div>
    </div>
  );
}

function injectAccessories(
  obj: HTMLObjectElement,
  config: ThemeConfig,
  state: string,
  override?: { name: string; transform: string } | null
) {
  let svgDoc: Document;
  try {
    svgDoc = obj.contentDocument!;
    if (!svgDoc || !svgDoc.documentElement) return;
  } catch {
    return;
  }

  // Remove existing
  svgDoc.querySelectorAll("[data-accessory]").forEach((el) => el.remove());

  const activeList = config.activeAccessories || [];
  const defs = config.accessories || {};

  for (const accName of activeList) {
    const def = defs[accName];
    if (!def?.anchors) continue;

    const anchor = def.anchors[state] !== undefined ? def.anchors[state] : def.anchors["*"] || null;
    if (!anchor) continue;

    const parent =
      anchor.parentId === "root" ? svgDoc.documentElement : svgDoc.getElementById(anchor.parentId);
    if (!parent) continue;

    const transformValue =
      override && override.name === accName ? override.transform : anchor.transform || "";

    fetch(`${config.assetsPath}/${def.file}`)
      .then((r) => r.text())
      .then((svgText) => {
        const parser = new DOMParser();
        const accDoc = parser.parseFromString(svgText, "image/svg+xml");
        const sourceG = accDoc.querySelector("g");
        if (!sourceG) return;

        const wrapper = svgDoc.createElementNS("http://www.w3.org/2000/svg", "g");
        wrapper.setAttribute("data-accessory", accName);
        if (transformValue) wrapper.setAttribute("transform", transformValue);

        for (const child of [...sourceG.childNodes]) {
          wrapper.appendChild(svgDoc.importNode(child, true));
        }
        parent.appendChild(wrapper);
      })
      .catch(() => {});
  }
}
