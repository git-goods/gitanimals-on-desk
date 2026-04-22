"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { createSettingsBridge } = require("../../src/preload/settings-bridge");

describe("createSettingsBridge", () => {
  it("proxies invoke-based APIs through the expected channels", async () => {
    const calls = [];
    const bridge = createSettingsBridge({
      invoke: async (channel, payload) => {
        calls.push({ channel, payload });
        return { status: "ok", channel };
      },
      subscribe: () => () => {},
    });

    await bridge.getSnapshot();
    await bridge.update("lang", "ko");
    await bridge.command("refreshThemes", { force: true });
    await bridge.listAgents();
    await bridge.listThemes();
    await bridge.getUser();

    assert.deepStrictEqual(calls, [
      { channel: "settings:get-snapshot", payload: undefined },
      { channel: "settings:update", payload: { key: "lang", value: "ko" } },
      { channel: "settings:command", payload: { action: "refreshThemes", payload: { force: true } } },
      { channel: "settings:list-agents", payload: undefined },
      { channel: "settings:list-themes", payload: undefined },
      { channel: "settings:get-user", payload: undefined },
    ]);
  });

  it("returns unsubscribe handlers for event listeners", () => {
    const handlers = new Map();
    const bridge = createSettingsBridge({
      invoke: async () => null,
      subscribe: (channel, handler) => {
        handlers.set(channel, handler);
        return () => handlers.delete(channel);
      },
    });

    const seen = [];
    const offChanged = bridge.onChanged((payload) => seen.push(["changed", payload]));
    const offTab = bridge.onSetTab((tab) => seen.push(["tab", tab]));
    const offExpired = bridge.onSessionExpired(() => seen.push(["expired"]));

    handlers.get("settings-changed")(null, { changes: { lang: "ko" } });
    handlers.get("settings:set-tab")(null, "theme");
    handlers.get("auth:session-expired")();

    offChanged();
    offTab();
    offExpired();

    handlers.get("settings-changed")(null, { changes: { lang: "en" } });
    handlers.get("settings:set-tab")(null, "general");
    handlers.get("auth:session-expired")();

    assert.deepStrictEqual(seen, [
      ["changed", { changes: { lang: "ko" } }],
      ["tab", "theme"],
      ["expired"],
    ]);
  });
});
