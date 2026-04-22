// --- Render window: pure view (SVG rendering + eye tracking) ---
// All input (pointer/drag/click) is handled by the hit window (hit-renderer.js).
// Reactions are triggered via IPC from main (relayed from hit window).

// Renderer diagnostics: surface unhandled errors to main → Sentry. Main
// handles the IPC via ipcMain.on("renderer-diagnostic", ...).
try {
  window.addEventListener("error", (e) => {
    try {
      window.electronAPI && window.electronAPI.reportDiagnostic &&
        window.electronAPI.reportDiagnostic({
          kind: "window-error",
          message: e && e.message,
          filename: e && e.filename,
          lineno: e && e.lineno,
          colno: e && e.colno,
          stack: e && e.error && e.error.stack,
        });
    } catch (_) {}
  });
  window.addEventListener("unhandledrejection", (e) => {
    try {
      const reason = e && e.reason;
      window.electronAPI && window.electronAPI.reportDiagnostic &&
        window.electronAPI.reportDiagnostic({
          kind: "unhandled-rejection",
          message: reason && (reason.message || String(reason)),
          stack: reason && reason.stack,
        });
    } catch (_) {}
  });
} catch (_) {}

const container = document.getElementById("pet-container");
let petEl = document.getElementById("gitanimals");
let pendingNext = null;

// ── Theme config (injected via preload.js additionalArguments) ──
let tc = window.themeConfig || {};
let _themeId = null;
let _themeSource = null;

function initWithConfig(cfg) {
  tc = cfg || {};
  _themeId = tc.themeId || null;
  _themeSource = tc.themeSource || null;
  _viewBox = tc.viewBox || { x: -15, y: -25, width: 45, height: 45 };
  _layout = tc.layout || null;
  _assetsPath = tc.assetsPath || "../../assets/svg";
  _sourceAssetsPath = tc.sourceAssetsPath || null;
  _sharedAssetsPath = tc.sharedAssetsPath || null;
  _eyeIds = (tc.eyeTracking && tc.eyeTracking.ids) || { eyes: "eyes-js", body: "body-js", shadow: "shadow-js", dozeEyes: "eyes-doze" };
  _bodyScale = (tc.eyeTracking && tc.eyeTracking.bodyScale) || 0.33;
  _shadowStretch = (tc.eyeTracking && tc.eyeTracking.shadowStretch) || 0.15;
  _shadowShift = (tc.eyeTracking && tc.eyeTracking.shadowShift) || 0.3;
  _eyeTrackingStates = (tc.eyeTrackingStates) || ["idle", "dozing", "mini-idle"];
  _dragSvg = tc.dragSvg || "react-drag.svg";
  _idleFollowSvg = tc.idleFollowSvg || "idle-follow.svg";
  _glyphFlipDefs = tc.glyphFlips || { "pixel-z": 4, "pixel-z-small": 3 };

  // Layered tracking: detect if theme uses multi-layer config
  _useLayeredTracking = !!(tc.eyeTracking && tc.eyeTracking.trackingLayers);
  _trackingLayersConfig = _useLayeredTracking ? tc.eyeTracking.trackingLayers : null;
  _themeMaxOffset = (tc.eyeTracking && tc.eyeTracking.maxOffset) || 20;

  // objectScale — applied via element.style in swapToFile() (CSP blocks <style> injection)
  const os = tc.objectScale || { widthRatio: 1.9, heightRatio: 1.3, offsetX: -0.45, offsetY: -0.25 };
  _objectScaleCSS = {
    width:  `${os.widthRatio * 100}%`,
    height: `${os.heightRatio * 100}%`,
    imgWidthBase: (os.imgWidthRatio || os.widthRatio) * 100,
    left:   `${os.offsetX * 100}%`,
    imgLeft: `${(os.imgOffsetX != null ? os.imgOffsetX : os.offsetX) * 100}%`,
    // Unified bottom-anchored positioning for both <object> and <img>
    // Theme can override objBottom directly; otherwise derive from offsetY + heightRatio
    objBottom: `${(os.objBottom != null ? os.objBottom : (1 - os.offsetY - os.heightRatio)) * 100}%`,
    imgBottom: `${(os.imgBottom != null ? os.imgBottom : 0.05) * 100}%`,
  };
  _fileScales = os.fileScales || {};
  _fileOffsets = os.fileOffsets || {};
  _transitions = tc.transitions || {};
  _miniFlipAssets = !!tc.miniFlipAssets;

  // Accessories
  _accessoriesDefs = tc.accessories || {};
  _activeAccessories = tc.activeAccessories || [];
  _accessorySvgCache.clear();

  applyObjectScaleStyle(petEl);
  applyObjectScaleStyle(pendingNext);
}

function applyObjectScaleStyle(el, file) {
  if (!el || !_objectScaleCSS) return;
  if (shouldUseNormalizedLayout(file)) {
    applyNormalizedLayoutStyle(el, file);
    return;
  }
  const fo = (file && _fileOffsets[file]) || null;
  const ox = fo ? fo.x : 0;
  const oy = fo ? fo.y : 0;

  // Unified bottom-anchored positioning: both <object> and <img> use bottom + oy
  if (el.tagName === "IMG") {
    const scale = (file && _fileScales[file]) || 1.0;
    el.style.width = `${_objectScaleCSS.imgWidthBase * scale}%`;
    el.style.height = "auto";
    el.style.left = `calc(${_objectScaleCSS.imgLeft} + ${ox}px)`;
    el.style.top = "auto";
    el.style.bottom = `calc(${_objectScaleCSS.imgBottom || "5%"} + ${oy}px)`;
  } else {
    el.style.width = _objectScaleCSS.width;
    el.style.height = _objectScaleCSS.height;
    el.style.left = `calc(${_objectScaleCSS.left} + ${ox}px)`;
    el.style.top = "auto";
    el.style.bottom = `calc(${_objectScaleCSS.objBottom} + ${oy}px)`;
  }
}

function shouldUseNormalizedLayout(file) {
  if (!_layout || !_layout.contentBox) return false;
  if (_inMiniMode || (file && file.startsWith("mini-"))) return false;
  return true;
}

function applyNormalizedLayoutStyle(el, file) {
  if (!el || !_layout || !_layout.contentBox || !_viewBox) return;
  const fo = (file && _fileOffsets[file]) || null;
  const ox = fo ? fo.x : 0;
  const oy = fo ? fo.y : 0;
  const scale = (file && _fileScales[file]) || 1.0;
  const cb = _layout.contentBox;
  const centerX = _layout.centerX != null ? _layout.centerX : (cb.x + cb.width / 2);
  const baselineY = _layout.baselineY != null ? _layout.baselineY : (cb.y + cb.height);
  const unitRatio = ((_layout.visibleHeightRatio || 0.58) * scale) / cb.height;
  const widthRatio = _viewBox.width * unitRatio;
  const heightRatio = _viewBox.height * unitRatio;
  const leftRatio = (_layout.centerXRatio != null ? _layout.centerXRatio : 0.5)
    - ((centerX - _viewBox.x) * unitRatio);
  const bottomRatio = (_layout.baselineBottomRatio != null ? _layout.baselineBottomRatio : 0.05)
    - ((_viewBox.y + _viewBox.height - baselineY) * unitRatio);

  if (el.tagName === "IMG") {
    el.style.width = `${widthRatio * 100}%`;
    el.style.height = "auto";
    el.style.left = `calc(${leftRatio * 100}% + ${ox}px)`;
    el.style.top = "auto";
    el.style.bottom = `calc(${bottomRatio * 100}% + ${oy}px)`;
  } else {
    el.style.width = `${widthRatio * 100}%`;
    el.style.height = `${heightRatio * 100}%`;
    el.style.left = `calc(${leftRatio * 100}% + ${ox}px)`;
    el.style.top = "auto";
    el.style.bottom = `calc(${bottomRatio * 100}% + ${oy}px)`;
  }
}

let _assetsPath;
let _sourceAssetsPath;
let _sharedAssetsPath;
let _viewBox;
let _layout;
let _eyeIds;
let _bodyScale;
let _shadowStretch;
let _shadowShift;
let _eyeTrackingStates;
let _dragSvg;
let _idleFollowSvg;
let _glyphFlipDefs;
let _objectScaleCSS;
let _fileScales = {};
let _fileOffsets = {};
let _transitions = {};  // per-file fade config: { "file.apng": { in: 400, out: 400 } }
let _miniFlipAssets = false; // theme's mini assets drawn in reverse direction
let _inMiniMode = false;

function applyMiniFlip(el) {
  if (!el || el.tagName !== "IMG") return;
  el.style.transform = (_miniFlipAssets && _inMiniMode) ? "scaleX(-1)" : "";
}

// ── Layered tracking state (multi-layer eye/head/body tracking) ──
let _useLayeredTracking = false;
let _trackingLayersConfig = null;  // raw config from theme.json
let _themeMaxOffset = 20;          // theme-level maxOffset for normalization
let _trackingLayers = null;        // { name: { wrappers: [], maxOffset, ease, x, y } }
let _layerTargetDx = 0;           // raw dx from tick.js (scaled to _themeMaxOffset)
let _layerTargetDy = 0;           // raw dy from tick.js
let _layerAnimFrame = null;        // requestAnimationFrame handle
let _layeredTrackingObj = null;    // the <object> element currently tracked (guard against re-init)

// ── Accessory injection state ──
let _accessoriesDefs = {};            // from theme config: { name: { file, anchors } }
let _activeAccessories = [];          // list of accessory names currently enabled
const _accessorySvgCache = new Map(); // file → parsed SVG text cache
let _accessoryInjectToken = 0;        // stale injection guard

initWithConfig(tc);

// Theme switch: reload + IPC push overrides additionalArguments
window.electronAPI.onThemeConfig((newConfig) => {
  _cleanupLayeredTracking();
  initWithConfig(newConfig);
});

// Release an <object> SVG element: navigate away to unload the SVG document
// (stops CSS animations and frees the internal frame), then remove from DOM.
function releaseObject(el) {
  if (!el) return;
  try { el.data = ""; } catch {}
  el.remove();
}

// Release an <img> element from DOM
function releaseImg(el) {
  if (!el) return;
  try { el.src = ""; } catch {}
  el.remove();
}

// --- Reaction state (visual side) ---
let isReacting = false;
let isDragReacting = false;
let reactTimer = null;
let currentIdleSvg = null;    // tracks which SVG is currently showing
let dndEnabled = false;
let miniLeftFlip = false;

window.electronAPI.onDndChange((enabled) => { dndEnabled = enabled; });

window.electronAPI.onMiniModeChange((enabled, edge) => {
  _inMiniMode = enabled;
  miniLeftFlip = enabled && edge === "left";
  container.classList.toggle("mini-left", miniLeftFlip);
  applyMiniFlip(petEl);
  if (miniLeftFlip) {
    applyGlyphFlipCompensation(petEl);
  } else {
    removeGlyphFlipCompensation(petEl);
  }
});

// Counter-flip asymmetric pixel-art glyphs (Zzz) inside SVG defs so they
// render correctly when the container has scaleX(-1). Only the glyph shape
// is flipped — CSS animation transforms (float direction) are unaffected.
function applyGlyphFlipCompensation(objectEl) {
  if (!objectEl || objectEl.tagName !== "OBJECT") return;
  try {
    const doc = objectEl.contentDocument;
    if (!doc) return;
    for (const [id, w] of Object.entries(_glyphFlipDefs)) {
      const el = doc.getElementById(id);
      if (el) el.setAttribute("transform", `translate(${w}, 0) scale(-1, 1)`);
    }
  } catch {}
}

function removeGlyphFlipCompensation(objectEl) {
  if (!objectEl || objectEl.tagName !== "OBJECT") return;
  try {
    const doc = objectEl.contentDocument;
    if (!doc) return;
    for (const id of Object.keys(_glyphFlipDefs)) {
      const el = doc.getElementById(id);
      if (el) el.removeAttribute("transform");
    }
  } catch {}
}

function getObjectSvgName(objectEl) {
  if (!objectEl) return null;
  const data = (objectEl.tagName === "OBJECT")
    ? (objectEl.getAttribute("data") || objectEl.data || "")
    : (objectEl.getAttribute("src") || objectEl.src || "");
  if (!data) return null;
  const clean = data.split(/[?#]/)[0];
  const parts = clean.split("/");
  return parts[parts.length - 1] || null;
}

// ── Dual-channel rendering ──
// Object channel: <object type="image/svg+xml"> for SVG states needing eye tracking
// Img channel: <img> for all other formats (SVG/GIF/APNG/WebP pure playback)

/**
 * Determine if a state+file needs the <object> channel (eye tracking).
 */
function needsObjectChannel(state, file) {
  if (!file) return false;
  if (!file.endsWith(".svg")) return false;
  // Object channel needed for eye tracking OR accessory injection (both need SVG DOM access)
  if (_activeAccessories.length > 0) return true;
  return _eyeTrackingStates.includes(state);
}

/**
 * Get the full asset URL for a file.
 * SVGs use _assetsPath (which may point to cache for external themes).
 * Non-SVGs use _sourceAssetsPath if available (direct from theme dir).
 */
function getAssetUrl(file) {
  if (!file) return "";
  if (file.startsWith("shared:") && _sharedAssetsPath) {
    return `${_sharedAssetsPath}/${file.slice("shared:".length)}`;
  }
  if (file.endsWith(".svg") || !_sourceAssetsPath) {
    return `${_assetsPath}/${file}`;
  }
  return `${_sourceAssetsPath}/${file}`;
}

// Asset load failures are invisible to Sentry unless we surface them from the
// renderer: Chromium just paints the browser's broken-image glyph and no
// exception fires. Guarded so a broken preload API can never crash swap().
function reportAssetLoadFailed(info) {
  try {
    window.electronAPI && window.electronAPI.reportDiagnostic &&
      window.electronAPI.reportDiagnostic({
        kind: "asset-load-failed",
        themeId: _themeId,
        themeSource: _themeSource,
        assetsPath: _assetsPath,
        ...info,
      });
  } catch (_) {}
}

// --- Debug hitbox: show blue outline around image element ---
let _debugHitbox = false;
function applyDebugOutline(el) {
  if (!el) return;
  el.style.backgroundColor = _debugHitbox ? "rgba(0, 120, 255, 0.15)" : "transparent";
}
window.electronAPI.onDebugHitbox((enabled) => {
  _debugHitbox = enabled;
  applyDebugOutline(petEl);
});

// --- IPC-triggered reactions (from hit window via main relay) ---
window.electronAPI.onStartDragReaction(() => startDragReaction());
window.electronAPI.onEndDragReaction(() => endDragReaction());
window.electronAPI.onPlayClickReaction((svg, duration) => playReaction(svg, duration));

function playReaction(svgFile, durationMs) {
  isReacting = true;
  detachEyeTracking();
  window.electronAPI.pauseCursorPolling();

  // Reactions always use <img> channel (no eye tracking needed)
  swapToFile(svgFile, null, false);

  reactTimer = setTimeout(() => endReaction(), durationMs);
}

function endReaction() {
  if (!isReacting) return;
  isReacting = false;
  reactTimer = null;
  window.electronAPI.resumeFromReaction();
}

function cancelReaction() {
  if (isReacting) {
    if (reactTimer) { clearTimeout(reactTimer); reactTimer = null; }
    isReacting = false;
  }
  if (isDragReacting) {
    isDragReacting = false;
  }
}

// --- Drag reaction (loops while dragging) ---
function startDragReaction() {
  if (isDragReacting) return;
  if (dndEnabled) return;

  if (isReacting) {
    if (reactTimer) { clearTimeout(reactTimer); reactTimer = null; }
    isReacting = false;
  }

  isDragReacting = true;
  detachEyeTracking();
  window.electronAPI.pauseCursorPolling();
  swapToFile(_dragSvg, null, false);
}

function endDragReaction() {
  if (!isDragReacting) return;
  isDragReacting = false;
  window.electronAPI.resumeFromReaction();
}

// --- Generic swap function: handles both <object> and <img> channels ---
let currentDisplayedSvg = getObjectSvgName(petEl);
let pendingSvgFile = null; // tracks the SVG currently being loaded (for dedup)
let _isFallbackAttempt = false;
currentIdleSvg = currentDisplayedSvg;

/**
 * Swap to a new animation file.
 * @param {string} file - animation filename
 * @param {string|null} state - current state name (for eye tracking decision)
 * @param {boolean} [useObjectChannel] - force object channel (true), img (false), or auto (undefined)
 */
// Fade out an element and remove it after the transition completes
function fadeOutAndRemove(el, durationMs) {
  el.style.transition = `opacity ${durationMs}ms ease-out`;
  el.style.opacity = "0";
  setTimeout(() => {
    if (el.tagName === "OBJECT") releaseObject(el);
    else releaseImg(el);
  }, durationMs);
}

function swapToFile(file, state, useObjectChannel) {
  if (pendingNext) {
    if (pendingNext.tagName === "OBJECT") releaseObject(pendingNext);
    else releaseImg(pendingNext);
    pendingNext = null;
  }

  if (!file) {
    // Emit diagnostic and keep the existing element. This is the canonical
    // "pet disappears" signature — pet would otherwise render an empty URL.
    try {
      window.electronAPI && window.electronAPI.reportDiagnostic &&
        window.electronAPI.reportDiagnostic({
          kind: "empty-svg",
          state,
          useObjectChannel,
          currentDisplayedSvg,
        });
    } catch (_) {}
    return;
  }

  pendingSvgFile = file; // track what's loading for dedup
  const useObj = useObjectChannel !== undefined ? useObjectChannel : needsObjectChannel(state, file);
  const url = getAssetUrl(file);

  if (useObj) {
    // Object channel: <object type="image/svg+xml">
    const next = document.createElement("object");
    next.type = "image/svg+xml";
    next.id = "gitanimals";
    next.style.opacity = "0";
    applyObjectScaleStyle(next, file);

    const swap = () => {
      if (pendingNext !== next) return;
      const fadeInMs = (_transitions[file] && _transitions[file].in) || 0;
      const fadeOutMs = (currentDisplayedSvg && _transitions[currentDisplayedSvg] && _transitions[currentDisplayedSvg].out) || 0;

      if (fadeInMs > 0) {
        next.style.transition = `opacity ${fadeInMs}ms ease-in`;
        next.offsetHeight; // force reflow to trigger transition
      } else {
        next.style.transition = "none";
      }
      next.style.opacity = "1";

      for (const child of [...container.querySelectorAll("object, img.gitanimals-img")]) {
        if (child !== next) {
          if (fadeOutMs > 0) fadeOutAndRemove(child, fadeOutMs);
          else if (child.tagName === "OBJECT") releaseObject(child);
          else releaseImg(child);
        }
      }
      pendingNext = null;
      pendingSvgFile = null;
      petEl = next;
      currentDisplayedSvg = file;
      applyDebugOutline(next);

      if (state && needsObjectChannel(state, file)) {
        attachEyeTracking(next);
      }
      if (miniLeftFlip) applyGlyphFlipCompensation(next);
      if (_activeAccessories.length > 0) {
        injectAccessories(next, state);
      }
    };

    next.addEventListener("load", swap, { once: true });
    next.addEventListener("error", () => {
      const canFallback = !_isFallbackAttempt && _idleFollowSvg && file !== _idleFollowSvg;
      reportAssetLoadFailed({
        state, file, url, channel: "object", failureMode: "error-event",
        fellBack: canFallback,
      });
      console.warn(`[render] load failed: ${file} (object/error)${canFallback ? " → fallback to idle" : ""}`);
      if (canFallback && pendingNext === next) {
        _isFallbackAttempt = true;
        swapToFile(_idleFollowSvg, "idle", true);
      }
    }, { once: true });
    next.data = url;
    container.appendChild(next);
    pendingNext = next;
    setTimeout(() => {
      if (pendingNext !== next) return;
      try {
        if (!next.contentDocument) {
          const canFallback = !_isFallbackAttempt && _idleFollowSvg && file !== _idleFollowSvg;
          reportAssetLoadFailed({
            state, file, url, channel: "object",
            failureMode: "timeout-no-contentdocument",
            fellBack: canFallback,
          });
          console.warn(`[render] load failed: ${file} (object/timeout)${canFallback ? " → fallback to idle" : ""}`);
          releaseObject(next); pendingNext = null;
          if (canFallback) {
            _isFallbackAttempt = true;
            swapToFile(_idleFollowSvg, "idle", true);
          }
          return;
        }
      } catch {}
      swap();
    }, 3000);
  } else {
    // Img channel: <img> for pure playback (all formats)
    const next = document.createElement("img");
    next.className = "gitanimals-img";
    next.id = "gitanimals";
    next.style.opacity = "0";
    applyObjectScaleStyle(next, file);
    applyMiniFlip(next);

    const swap = () => {
      if (pendingNext !== next) return;
      const fadeInMs = (_transitions[file] && _transitions[file].in) || 0;
      const fadeOutMs = (currentDisplayedSvg && _transitions[currentDisplayedSvg] && _transitions[currentDisplayedSvg].out) || 0;

      if (fadeInMs > 0) {
        next.style.transition = `opacity ${fadeInMs}ms ease-in`;
        next.offsetHeight; // force reflow to trigger transition
      } else {
        next.style.transition = "none";
      }
      next.style.opacity = "1";

      for (const child of [...container.querySelectorAll("object, img.gitanimals-img")]) {
        if (child !== next) {
          if (fadeOutMs > 0) fadeOutAndRemove(child, fadeOutMs);
          else if (child.tagName === "OBJECT") releaseObject(child);
          else releaseImg(child);
        }
      }
      pendingNext = null;
      pendingSvgFile = null;
      petEl = next;
      currentDisplayedSvg = file;
      applyDebugOutline(next);
    };

    next.addEventListener("load", swap, { once: true });
    next.addEventListener("error", () => {
      const canFallback = !_isFallbackAttempt && _idleFollowSvg && file !== _idleFollowSvg;
      reportAssetLoadFailed({
        state, file, url, channel: "img", failureMode: "error-event",
        fellBack: canFallback,
      });
      console.warn(`[render] load failed: ${file} (img/error)${canFallback ? " → fallback to idle" : ""}`);
      if (canFallback && pendingNext === next) {
        _isFallbackAttempt = true;
        swapToFile(_idleFollowSvg, "idle", true);
      }
    }, { once: true });
    next.src = url;
    container.appendChild(next);
    pendingNext = next;
    setTimeout(() => {
      if (pendingNext !== next) return;
      if (next.complete && next.naturalWidth === 0) {
        const canFallback = !_isFallbackAttempt && _idleFollowSvg && file !== _idleFollowSvg;
        reportAssetLoadFailed({
          state, file, url, channel: "img",
          failureMode: "timeout-naturalwidth-zero",
          fellBack: canFallback,
        });
        console.warn(`[render] load failed: ${file} (img/timeout)${canFallback ? " → fallback to idle" : ""}`);
        if (canFallback) {
          _isFallbackAttempt = true;
          releaseImg(next); pendingNext = null;
          swapToFile(_idleFollowSvg, "idle", true);
          return;
        }
      }
      swap();
    }, 3000);
  }
}

// --- State change → switch animation (preload + instant swap) ---
window.electronAPI.onStateChange((state, svg) => {
  cancelReaction();
  _isFallbackAttempt = false;

  // Dedup: same file already displayed OR currently loading → don't re-swap
  const alreadyDisplayed = petEl && petEl.isConnected && currentDisplayedSvg === svg;
  const alreadyPending = pendingSvgFile === svg && pendingNext;

  if (alreadyDisplayed || alreadyPending) {
    if (alreadyDisplayed) {
      if (needsObjectChannel(state, svg) && !eyeTarget && !_trackingLayers) {
        if (petEl.tagName === "OBJECT") attachEyeTracking(petEl);
      } else if (!needsObjectChannel(state, svg)) {
        detachEyeTracking();
      }
    }
    currentIdleSvg = svg;
    return;
  }

  // Different file — cancel pending, detach, and swap
  if (pendingNext) {
    if (pendingNext.tagName === "OBJECT") releaseObject(pendingNext);
    else releaseImg(pendingNext);
    pendingNext = null;
    pendingSvgFile = null;
  }
  detachEyeTracking();

  swapToFile(svg, state);
  currentIdleSvg = svg;
});

// --- Eye tracking (idle state only) ---
// Two systems coexist:
//   1. Single-target (legacy): eyeTarget/bodyTarget/shadowTarget + applyEyeMove
//      Used by default theme (tc.eyeTracking.ids config)
//   2. Layered tracking: per-element <g> wrappers + independent easing per layer
//      Used when tc.eyeTracking.trackingLayers is defined (e.g. calico theme)

let eyeTarget = null;
let bodyTarget = null;
let shadowTarget = null;
let lastEyeDx = 0;
let lastEyeDy = 0;
let eyeAttachToken = 0;

// ── Single-target eye tracking (legacy) ──

function applyEyeMove(dx, dy) {
  if (eyeTarget) {
    eyeTarget.setAttribute("transform", `translate(${dx}, ${dy})`);
  }
  if (bodyTarget || shadowTarget) {
    const bdx = Math.round(dx * _bodyScale * 2) / 2;
    const bdy = Math.round(dy * _bodyScale * 2) / 2;
    if (bodyTarget) bodyTarget.setAttribute("transform", `translate(${bdx}, ${bdy})`);
    if (shadowTarget) {
      const absDx = Math.abs(bdx);
      const scaleX = 1 + absDx * _shadowStretch;
      const shiftX = Math.round(bdx * _shadowShift * 2) / 2;
      shadowTarget.setAttribute("transform", `translate(${shiftX}, 0) scale(${scaleX}, 1)`);
    }
  }
}

// ── Layered tracking helpers ──

/**
 * Wrap a single SVG element in a <g> for transform control.
 * Returns the wrapper <g>, or null if element not found.
 */
function _wrapSvgElement(svgDoc, el) {
  if (!el) return null;
  const wrapper = svgDoc.createElementNS("http://www.w3.org/2000/svg", "g");
  wrapper.setAttribute("data-tracking-wrapper", "1");
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
  return wrapper;
}

/**
 * Unwrap all tracking wrappers in the SVG document (restore original structure).
 */
function _unwrapAll(svgDoc) {
  if (!svgDoc) return;
  try {
    const wrappers = svgDoc.querySelectorAll("[data-tracking-wrapper]");
    for (const wrapper of wrappers) {
      const parent = wrapper.parentNode;
      if (!parent) continue;
      // Move all children out of wrapper, then remove wrapper
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      parent.removeChild(wrapper);
    }
  } catch {}
}

/**
 * Calculate clamped offset for a layer (same formula as calico-test.html).
 * Maps raw distance to [0, maxOffset] with soft clamping.
 */
function _calcLayerOffset(dx, dy, maxOffset) {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return [0, 0];
  const clamp = Math.min(dist, maxOffset * 40) / (maxOffset * 40) * maxOffset;
  return [(dx / dist) * clamp, (dy / dist) * clamp];
}

/**
 * Initialize layered tracking for a loaded SVG document.
 * Creates <g> wrappers for each element listed in trackingLayers config.
 */
function _initLayeredTracking(svgDoc) {
  if (!_trackingLayersConfig || !svgDoc) return;

  _trackingLayers = {};

  for (const [layerName, layerCfg] of Object.entries(_trackingLayersConfig)) {
    const wrappers = [];

    // Wrap elements by ID
    if (layerCfg.ids) {
      for (const id of layerCfg.ids) {
        const el = svgDoc.getElementById(id);
        const w = _wrapSvgElement(svgDoc, el);
        if (w) wrappers.push(w);
      }
    }

    // Wrap elements by class
    if (layerCfg.classes) {
      for (const cls of layerCfg.classes) {
        const els = svgDoc.querySelectorAll(`.${cls}`);
        for (const el of els) {
          const w = _wrapSvgElement(svgDoc, el);
          if (w) wrappers.push(w);
        }
      }
    }

    _trackingLayers[layerName] = {
      wrappers,
      maxOffset: layerCfg.maxOffset || 10,
      ease: layerCfg.ease || 0.15,
      x: 0,
      y: 0,
    };
  }

  // Start the easing animation loop
  _startLayerAnimLoop();
}

/**
 * Start the requestAnimationFrame easing loop for layered tracking.
 */
function _startLayerAnimLoop() {
  if (_layerAnimFrame) return; // already running

  function tick() {
    if (!_trackingLayers) { _layerAnimFrame = null; return; }

    const rawDx = _layerTargetDx;
    const rawDy = _layerTargetDy;

    for (const layer of Object.values(_trackingLayers)) {
      // Scale the pre-calculated offset (from tick.js, already in [-maxOffset, maxOffset])
      // to this layer's range. No second normalization — tick.js already did it.
      const scale = layer.maxOffset / (_themeMaxOffset || 20);
      const tx = rawDx * scale;
      const ty = rawDy * scale;

      // Lerp towards target
      layer.x += (tx - layer.x) * layer.ease;
      layer.y += (ty - layer.y) * layer.ease;

      // Snap to zero when very close (avoid sub-pixel jitter)
      if (Math.abs(layer.x) < 0.01 && Math.abs(layer.y) < 0.01 && tx === 0 && ty === 0) {
        layer.x = 0;
        layer.y = 0;
      }

      // Quantize to quarter-pixel grid for smooth rendering
      const qx = Math.round(layer.x * 4) / 4;
      const qy = Math.round(layer.y * 4) / 4;

      // Apply transform to all wrappers in this layer
      for (const w of layer.wrappers) {
        w.setAttribute("transform", `translate(${qx},${qy})`);
      }
    }

    _layerAnimFrame = requestAnimationFrame(tick);
  }

  _layerAnimFrame = requestAnimationFrame(tick);
}

/**
 * Clean up layered tracking: cancel RAF, unwrap elements, reset state.
 */
function _cleanupLayeredTracking() {
  if (_layerAnimFrame) {
    cancelAnimationFrame(_layerAnimFrame);
    _layerAnimFrame = null;
  }

  // Unwrap elements in the current SVG if still accessible
  if (_trackingLayers && petEl && petEl.tagName === "OBJECT") {
    try {
      _unwrapAll(petEl.contentDocument);
    } catch {}
  }

  _trackingLayers = null;
  _layerTargetDx = 0;
  _layerTargetDy = 0;
  _layeredTrackingObj = null;
}

// ── Accessory injection ──

function _removeInjectedAccessories(svgDoc) {
  if (!svgDoc) return;
  try {
    const injected = svgDoc.querySelectorAll("[data-accessory]");
    for (const el of injected) el.remove();
  } catch {}
}

async function _fetchAccessorySvg(file) {
  if (_accessorySvgCache.has(file)) return _accessorySvgCache.get(file);
  const url = getAssetUrl(file);
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

      // Resolve anchor for current state: specific state → "*" fallback → null (skip)
      const anchor = def.anchors[state] !== undefined ? def.anchors[state] : (def.anchors["*"] || null);
      if (!anchor) continue;
      console.log(`[accessory] injecting "${accName}" into state="${state}", parentId="${anchor.parentId}", transform="${anchor.transform}"`);

      // "root" = append to SVG document element; otherwise find by ID
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

          // Import all children of the source <g> into the target SVG document
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

// ── Attach / Detach (dispatches to correct system) ──

function attachEyeTracking(objectEl) {
  if (!objectEl || objectEl.tagName !== "OBJECT") return;
  const token = ++eyeAttachToken;
  eyeTarget = null;
  bodyTarget = null;
  shadowTarget = null;

  const tryAttach = (attempt) => {
    if (token !== eyeAttachToken) return;
    if (!objectEl || !objectEl.isConnected) return;

    try {
      const svgDoc = objectEl.contentDocument;
      if (!svgDoc) {
        if (attempt < 60) setTimeout(() => tryAttach(attempt + 1), 16);
        return;
      }

      // Layered tracking: wrap elements and start RAF loop
      if (_useLayeredTracking) {
        // Skip if already tracking this exact <object> element
        if (_trackingLayers && _layeredTrackingObj === objectEl) return;
        _initLayeredTracking(svgDoc);
        _layeredTrackingObj = objectEl;
        return;
      }

      // Single-target tracking (legacy)
      const eyes = svgDoc && svgDoc.getElementById(_eyeIds.eyes);
      if (eyes) {
        eyeTarget = eyes;
        bodyTarget = svgDoc.getElementById(_eyeIds.body);
        shadowTarget = svgDoc.getElementById(_eyeIds.shadow);
        applyEyeMove(lastEyeDx, lastEyeDy);
        return;
      }
    } catch (e) {
      console.warn("Cannot access SVG contentDocument for eye tracking:", e.message);
      return;
    }

    if (attempt >= 60) {
      console.warn("Timed out waiting for SVG eye targets");
      return;
    }
    setTimeout(() => tryAttach(attempt + 1), 16);
  };

  tryAttach(0);
}

function detachEyeTracking() {
  eyeAttachToken++;
  // Single-target cleanup
  eyeTarget = null;
  bodyTarget = null;
  shadowTarget = null;
  // Layered tracking cleanup
  _cleanupLayeredTracking();
}

window.electronAPI.onEyeMove((dx, dy) => {
  const effectiveDx = miniLeftFlip ? -dx : dx;
  lastEyeDx = effectiveDx;
  lastEyeDy = dy;

  if (_trackingLayers) {
    // Layered tracking: store targets, RAF loop handles easing
    _layerTargetDx = effectiveDx;
    _layerTargetDy = dy;
    return;
  }

  // Single-target tracking (legacy)
  // Detect stale eye targets (e.g. after DWM z-order recovery invalidates contentDocument)
  if (eyeTarget && !eyeTarget.ownerDocument?.defaultView) {
    eyeTarget = null;
    bodyTarget = null;
    shadowTarget = null;
    if (petEl && petEl.isConnected && petEl.tagName === "OBJECT") attachEyeTracking(petEl);
    return;
  }
  applyEyeMove(effectiveDx, dy);
});

// --- Sound playback (IPC from main, receives file:// URL from theme) ---
const _audioCache = {};
window.electronAPI.onPlaySound((url) => {
  let audio = _audioCache[url];
  if (!audio) {
    audio = new Audio(url);
    _audioCache[url] = audio;
  }
  audio.currentTime = 0;
  audio.play().catch(() => {});
});

// --- Wake from doze (smooth eye opening) ---
window.electronAPI.onWakeFromDoze(() => {
  if (petEl && petEl.tagName === "OBJECT" && petEl.contentDocument) {
    try {
      const eyes = petEl.contentDocument.getElementById(_eyeIds.dozeEyes || "eyes-doze");
      if (eyes) eyes.style.transform = "scaleY(1)";
    } catch (e) {}
  }
});

// --- Initial frame: always go through swapToFile so the right channel and theme scaling apply ---
if (!currentDisplayedSvg && _idleFollowSvg) {
  currentIdleSvg = _idleFollowSvg;
  swapToFile(_idleFollowSvg, "idle");
}

// All IPC listeners registered — signal main process it's safe to send state
window.electronAPI.signalReady();
