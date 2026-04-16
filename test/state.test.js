"use strict";

// Phase 1 invariant tests for applyState's empty-SVG fallback chain.
//
// The production bug these guard against: when STATE_SVGS[state] resolves to
// an empty or missing array, the renderer used to receive `state-change` with
// `svg = undefined` → SVG <object data=""> → invisible pet. Phase 1 adds a
// fallback chain (state-specific → idle pool → SVG_IDLE_FOLLOW) and, as a
// last resort, skips the IPC send entirely so the renderer keeps its previous
// element.

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");

const initState = require("../src/state");

// Minimal theme good enough for refreshTheme + applyState to run.
function makeTheme(overrides = {}) {
  return {
    _id: "test-theme",
    _source: "test",
    states: {
      idle: ["idle-1.svg"],
      working: ["working-1.svg"],
      thinking: ["thinking-1.svg"],
      sleeping: ["sleeping-1.svg"],
      waking: ["waking-1.svg"],
      yawning: ["yawning-1.svg"],
      ...(overrides.states || {}),
    },
    timings: {
      minDisplay: {},
      autoReturn: {},
      deepSleepTimeout: 0,
      yawnDuration: 0,
      wakeDuration: 0,
      collapseDuration: 0,
    },
    hitBoxes: { default: {}, sleeping: {}, wide: {} },
    displayHintMap: {},
    wideHitboxFiles: [],
    sleepingHitboxFiles: [],
  };
}

function makeCtx(theme) {
  const calls = { sendToRenderer: [], syncHitWin: [], sendToHitWin: [], playSound: [] };
  return {
    theme,
    doNotDisturb: false,
    miniMode: false,
    miniTransitioning: false,
    mouseOverPet: false,
    idlePaused: false,
    sendToRenderer: (...args) => calls.sendToRenderer.push(args),
    syncHitWin: (...args) => calls.syncHitWin.push(args),
    sendToHitWin: (...args) => calls.sendToHitWin.push(args),
    playSound: (name) => calls.playSound.push(name),
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    processKill: () => {},
    // Test hook to extract call log.
    __calls: calls,
  };
}

describe("applyState — Phase 1 empty-SVG fallback", () => {
  it("falls back to idle when state-specific pool is empty (array exists but length 0)", () => {
    const theme = makeTheme({ states: { yawning: [] } });
    const ctx = makeCtx(theme);
    const state = initState(ctx);
    state.refreshTheme();

    state.applyState("yawning", null);
    state.cleanup(); // drain timers so the test process exits

    const stateChanges = ctx.__calls.sendToRenderer.filter((a) => a[0] === "state-change");
    assert.strictEqual(stateChanges.length, 1, "sendToRenderer should fire exactly once with state-change");
    const [, transmittedState, transmittedSvg] = stateChanges[0];
    assert.strictEqual(transmittedState, "yawning", "state passed through unchanged");
    assert.ok(transmittedSvg, "svg must not be null/empty");
    assert.strictEqual(transmittedSvg, "idle-1.svg", "svg falls back to the first idle SVG");
  });

  it("falls back to idle when a state is missing entirely from the theme", () => {
    // 'carrying' is optional (not in REQUIRED_STATES), so a theme may omit it.
    const theme = makeTheme();
    delete theme.states.carrying;
    const ctx = makeCtx(theme);
    const state = initState(ctx);
    state.refreshTheme();

    state.applyState("carrying", null);
    state.cleanup();

    const stateChanges = ctx.__calls.sendToRenderer.filter((a) => a[0] === "state-change");
    assert.strictEqual(stateChanges.length, 1);
    const [, , transmittedSvg] = stateChanges[0];
    assert.ok(transmittedSvg, "fallback must supply a non-empty svg");
    assert.strictEqual(transmittedSvg, "idle-1.svg");
  });

  it("refreshTheme throws when idle pool is empty — theme-loader's validator should have caught this earlier, so reaching here means drift", () => {
    const theme = makeTheme({ states: { idle: [] } });
    const ctx = makeCtx(theme);
    // refreshTheme() is called automatically inside initState(), so the
    // throw surfaces during construction, not on a later explicit call.
    assert.throws(() => initState(ctx), /no idle svg/i);
  });
});
