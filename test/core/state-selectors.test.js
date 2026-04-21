"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  resolveDisplayStateFromSessions,
  pickDisplayHint,
  countInteractiveSessions,
  selectTieredSvg,
  getWinningSessionDisplayHint,
} = require("../../src/core/state-selectors");

const STATE_PRIORITY = {
  error: 8,
  notification: 7,
  sweeping: 6,
  attention: 5,
  carrying: 4,
  juggling: 4,
  working: 3,
  thinking: 2,
  idle: 1,
  sleeping: 0,
};

function sessionMap(entries) {
  return new Map(entries.map((session, index) => [`s${index}`, session]));
}

describe("state selectors", () => {
  it("resolves the highest-priority non-headless display state", () => {
    const sessions = sessionMap([
      { state: "thinking", headless: false },
      { state: "error", headless: true },
      { state: "working", headless: false },
    ]);

    const resolved = resolveDisplayStateFromSessions({
      sessions,
      statePriority: STATE_PRIORITY,
      updateVisualState: null,
    });

    assert.strictEqual(resolved, "working");
  });

  it("lets update visuals override sessions only when priority is high enough", () => {
    const sessions = sessionMap([{ state: "working", headless: false }]);

    assert.strictEqual(resolveDisplayStateFromSessions({
      sessions,
      statePriority: STATE_PRIORITY,
      updateVisualState: "carrying",
    }), "carrying");
    assert.strictEqual(resolveDisplayStateFromSessions({
      sessions,
      statePriority: STATE_PRIORITY,
      updateVisualState: "idle",
    }), "working");
  });

  it("keeps and validates display hints for interactive working states only", () => {
    assert.strictEqual(pickDisplayHint({
      state: "working",
      existingDisplayHint: "old",
      incomingDisplayHint: "build",
      displayHintMap: { build: "build.svg" },
    }), "build");
    assert.strictEqual(pickDisplayHint({
      state: "working",
      existingDisplayHint: "old",
      incomingDisplayHint: "unknown",
      displayHintMap: { build: "build.svg" },
    }), "old");
    assert.strictEqual(pickDisplayHint({
      state: "idle",
      existingDisplayHint: "old",
      incomingDisplayHint: "build",
      displayHintMap: { build: "build.svg" },
    }), null);
  });

  it("counts only non-headless sessions in the requested states", () => {
    const sessions = sessionMap([
      { state: "working", headless: false },
      { state: "thinking", headless: false },
      { state: "working", headless: true },
      { state: "idle", headless: false },
    ]);

    const count = countInteractiveSessions(sessions, new Set(["working", "thinking"]));

    assert.strictEqual(count, 2);
  });

  it("selects the first matching tier and falls back when no tier matches", () => {
    const tiers = [
      { minSessions: 3, file: "three.svg" },
      { minSessions: 2, file: "two.svg" },
    ];

    assert.strictEqual(selectTieredSvg({ count: 3, tiers, fallback: "one.svg" }), "three.svg");
    assert.strictEqual(selectTieredSvg({ count: 1, tiers, fallback: "one.svg" }), "one.svg");
  });

  it("returns the latest matching display hint mapping for the target state", () => {
    const sessions = sessionMap([
      { state: "working", headless: false, updatedAt: 10, displayHint: "build" },
      { state: "working", headless: false, updatedAt: 20, displayHint: "test" },
      { state: "working", headless: true, updatedAt: 30, displayHint: "ignored" },
    ]);

    const resolved = getWinningSessionDisplayHint({
      sessions,
      targetState: "working",
      displayHintMap: { build: "build.svg", test: "test.svg" },
    });

    assert.strictEqual(resolved, "test.svg");
  });
});
