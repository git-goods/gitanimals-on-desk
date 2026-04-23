/**
 * Preview Renderer — extracted from src/renderer.js for standalone browser use.
 * Renders SVGs identically to the desktop Electron app.
 */

// ── State ──
let _config = {};
let _assetsPath = "";
let _objectScaleCSS = {};
let _accessoriesDefs = {};
let _activeAccessories = [];
const _accessorySvgCache = new Map();
let _accessoryInjectToken = 0;
let _currentState = "idle";
let _currentFile = "";

const container = document.getElementById("pet-container");
let petEl = null;

// ── Public API ──

function initWithConfig(cfg) {
  _config = cfg || {};
  _assetsPath = cfg.assetsPath || "";
  _accessoriesDefs = cfg.accessories || {};
  _activeAccessories = cfg.activeAccessories || [];
  _accessorySvgCache.clear();

  const os = cfg.objectScale || { widthRatio: 1.9, heightRatio: 1.3, offsetX: -0.45, offsetY: -0.25 };
  _objectScaleCSS = {
    width: `${os.widthRatio * 100}%`,
    height: `${os.heightRatio * 100}%`,
    left: `${os.offsetX * 100}%`,
    objBottom: `${(os.objBottom != null ? os.objBottom : (1 - os.offsetY - os.heightRatio)) * 100}%`,
  };
}

function swapToFile(file, state) {
  if (!file) return;
  _currentFile = file;
  _currentState = state;

  // Remove existing
  for (const child of [...container.querySelectorAll("object, img")]) {
    child.remove();
  }

  const url = `${_assetsPath}/${file}`;

  if (file.endsWith(".svg")) {
    const obj = document.createElement("object");
    obj.type = "image/svg+xml";
    obj.style.width = _objectScaleCSS.width;
    obj.style.height = _objectScaleCSS.height;
    obj.style.left = _objectScaleCSS.left;
    obj.style.bottom = _objectScaleCSS.objBottom;
    obj.style.position = "absolute";

    obj.addEventListener("load", () => {
      petEl = obj;
      if (_activeAccessories.length > 0) {
        injectAccessories(obj, state);
      }
    }, { once: true });

    obj.data = url;
    container.appendChild(obj);
  } else {
    const img = document.createElement("img");
    img.style.width = _objectScaleCSS.width;
    img.style.height = _objectScaleCSS.height;
    img.style.left = _objectScaleCSS.left;
    img.style.bottom = _objectScaleCSS.objBottom;
    img.style.position = "absolute";
    img.src = url;
    container.appendChild(img);
    petEl = img;
  }
}

// ── Accessory injection (mirrors src/renderer.js logic) ──

function _removeInjectedAccessories(svgDoc) {
  if (!svgDoc) return;
  try {
    const injected = svgDoc.querySelectorAll("[data-accessory]");
    for (const el of injected) el.remove();
  } catch {}
}

async function _fetchAccessorySvg(file) {
  if (_accessorySvgCache.has(file)) return _accessorySvgCache.get(file);
  const url = `${_assetsPath}/${file}`;
  try {
    const resp = await fetch(url);
    const text = await resp.text();
    _accessorySvgCache.set(file, text);
    return text;
  } catch (e) {
    console.warn("[accessory] Failed to fetch", file, e.message);
    return null;
  }
}

function injectAccessories(objectEl, state) {
  if (!objectEl || objectEl.tagName !== "OBJECT") return;
  const token = ++_accessoryInjectToken;

  const tryInject = (attempt) => {
    if (token !== _accessoryInjectToken) return;
    if (!objectEl || !objectEl.isConnected) return;

    let svgDoc;
    try { svgDoc = objectEl.contentDocument; } catch { return; }
    if (!svgDoc) {
      if (attempt < 60) setTimeout(() => tryInject(attempt + 1), 16);
      return;
    }

    _removeInjectedAccessories(svgDoc);

    for (const accName of _activeAccessories) {
      const def = _accessoriesDefs[accName];
      if (!def || !def.anchors) continue;

      const anchor = def.anchors[state] !== undefined ? def.anchors[state] : (def.anchors["*"] || null);
      if (!anchor) continue;

      const parent = anchor.parentId === "root"
        ? svgDoc.documentElement
        : svgDoc.getElementById(anchor.parentId);
      if (!parent) continue;

      _fetchAccessorySvg(def.file).then((svgText) => {
        if (token !== _accessoryInjectToken) return;
        if (!svgText) return;

        try {
          const parser = new DOMParser();
          const accDoc = parser.parseFromString(svgText, "image/svg+xml");
          const sourceG = accDoc.querySelector("g");
          if (!sourceG) return;

          const wrapper = svgDoc.createElementNS("http://www.w3.org/2000/svg", "g");
          wrapper.setAttribute("data-accessory", accName);
          if (anchor.transform) wrapper.setAttribute("transform", anchor.transform);

          for (const child of [...sourceG.childNodes]) {
            wrapper.appendChild(svgDoc.importNode(child, true));
          }
          parent.appendChild(wrapper);
        } catch (e) {
          console.warn("[accessory] Injection failed for", accName, e.message);
        }
      });
    }
  };

  tryInject(0);
}

// ── Live accessory transform override ──

function updateAccessoryTransform(accName, transform) {
  if (!petEl || petEl.tagName !== "OBJECT") return;
  try {
    const svgDoc = petEl.contentDocument;
    if (!svgDoc) return;
    const wrapper = svgDoc.querySelector(`[data-accessory="${accName}"]`);
    if (wrapper) {
      wrapper.setAttribute("transform", transform);
    }
  } catch {}
}

function setActiveAccessories(list) {
  _activeAccessories = list;
  _accessorySvgCache.clear();
  // Re-render current state
  if (_currentFile) {
    swapToFile(_currentFile, _currentState);
  }
}

function getFileForState(config, state) {
  // Check main states
  if (config.states && config.states[state]) {
    return config.states[state][0];
  }
  // Check miniMode states
  if (config.miniMode && config.miniMode.states && config.miniMode.states[state]) {
    return config.miniMode.states[state][0];
  }
  // Fallback
  if (config.states && config.states.idle) {
    return config.states.idle[0];
  }
  return null;
}
