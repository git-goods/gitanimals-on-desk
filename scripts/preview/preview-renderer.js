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
let _useRealLayout = false;
let _layout = null;
let _viewBox = null;
let _layoutOverrides = {};

const container = document.getElementById("pet-container");
let petEl = null;

// ── Public API ──

function initWithConfig(cfg) {
  _config = cfg || {};
  _assetsPath = cfg.assetsPath || "";
  _accessoriesDefs = cfg.accessories || {};
  _activeAccessories = cfg.activeAccessories || [];
  _accessorySvgCache.clear();

  _layout = cfg.layout || null;
  _viewBox = cfg.viewBox || null;
  _layoutOverrides = {};
  _useRealLayout = !!(_layout && _layout.contentBox && _viewBox);

  const os = cfg.objectScale || { widthRatio: 1.9, heightRatio: 1.3, offsetX: -0.45, offsetY: -0.25 };
  _objectScaleCSS = {
    width: `${os.widthRatio * 100}%`,
    height: `${os.heightRatio * 100}%`,
    left: `${os.offsetX * 100}%`,
    objBottom: `${(os.objBottom != null ? os.objBottom : (1 - os.offsetY - os.heightRatio)) * 100}%`,
  };
}

// ── Layout positioning (mirrors src/core/renderer.js:126-155) ──

function _computeLayoutCSS(overrides) {
  if (!_layout || !_layout.contentBox || !_viewBox) return null;
  const cb = _layout.contentBox;
  const centerX = overrides.centerX != null ? overrides.centerX : (_layout.centerX != null ? _layout.centerX : (cb.x + cb.width / 2));
  const baselineY = overrides.baselineY != null ? overrides.baselineY : (_layout.baselineY != null ? _layout.baselineY : (cb.y + cb.height));
  const visibleHeightRatio = overrides.visibleHeightRatio != null ? overrides.visibleHeightRatio : (_layout.visibleHeightRatio || 0.58);
  const baselineBottomRatio = overrides.baselineBottomRatio != null ? overrides.baselineBottomRatio : (_layout.baselineBottomRatio != null ? _layout.baselineBottomRatio : 0.05);
  const centerXRatio = _layout.centerXRatio != null ? _layout.centerXRatio : 0.5;

  const unitRatio = visibleHeightRatio / cb.height;
  const widthRatio = _viewBox.width * unitRatio;
  const heightRatio = _viewBox.height * unitRatio;
  const leftRatio = centerXRatio - ((centerX - _viewBox.x) * unitRatio);
  const bottomRatio = baselineBottomRatio - ((_viewBox.y + _viewBox.height - baselineY) * unitRatio);

  return {
    width: `${widthRatio * 100}%`,
    height: `${heightRatio * 100}%`,
    left: `${leftRatio * 100}%`,
    bottom: `${bottomRatio * 100}%`,
  };
}

function _applyPositionCSS(el) {
  if (!el) return;
  if (_useRealLayout) {
    const css = _computeLayoutCSS(_layoutOverrides);
    if (css) {
      el.style.width = css.width;
      el.style.height = css.height;
      el.style.left = css.left;
      el.style.bottom = css.bottom;
    }
  } else {
    el.style.width = _objectScaleCSS.width;
    el.style.height = _objectScaleCSS.height;
    el.style.left = _objectScaleCSS.left;
    el.style.bottom = _objectScaleCSS.objBottom;
  }
}

function setUseRealLayout(enabled) {
  _useRealLayout = enabled;
  if (petEl) _applyPositionCSS(petEl);
}

function updateLayoutOverrides(overrides) {
  _layoutOverrides = overrides;
  if (_useRealLayout && petEl) _applyPositionCSS(petEl);
}

function getLayoutDefaults() {
  if (!_layout) return null;
  const cb = _layout.contentBox || {};
  return {
    baselineY: _layout.baselineY != null ? _layout.baselineY : (cb.y + cb.height),
    visibleHeightRatio: _layout.visibleHeightRatio || 0.58,
    baselineBottomRatio: _layout.baselineBottomRatio != null ? _layout.baselineBottomRatio : 0.05,
    centerX: _layout.centerX != null ? _layout.centerX : (cb.x + cb.width / 2),
  };
}

function swapToFile(file, state) {
  if (!file) return;
  _currentFile = file;
  _currentState = state;

  for (const child of [...container.querySelectorAll("object, img")]) {
    child.remove();
  }

  const url = `${_assetsPath}/${file}`;

  if (file.endsWith(".svg")) {
    const obj = document.createElement("object");
    obj.type = "image/svg+xml";
    obj.style.position = "absolute";
    _applyPositionCSS(obj);

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
    img.style.position = "absolute";
    _applyPositionCSS(img);
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

// ── SVG Parts Editor ──

function getSvgParts() {
  if (!petEl || petEl.tagName !== "OBJECT") return [];
  try {
    const svgDoc = petEl.contentDocument;
    if (!svgDoc) return [];
    const groups = svgDoc.querySelectorAll("g[id]");
    const parts = [];
    for (const g of groups) {
      if (g.getAttribute("data-accessory")) continue;
      const id = g.getAttribute("id");
      const transform = g.getAttribute("transform") || "";
      parts.push({ id, transform });
    }
    return parts;
  } catch { return []; }
}

function updateSvgPartTransform(partId, transform) {
  if (!petEl || petEl.tagName !== "OBJECT") return;
  try {
    const svgDoc = petEl.contentDocument;
    if (!svgDoc) return;
    const el = svgDoc.getElementById(partId);
    if (el) el.setAttribute("transform", transform);
  } catch {}
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
