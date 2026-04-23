"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const initReminders = require("../../src/core/reminders");

function makeCtx(overrides = {}) {
  return {
    doNotDisturb: false,
    hideBubbles: false,
    petHidden: false,
    timeRemindersEnabled: true,
    getLunchReminderTime: () => "11:50",
    getLeaveReminderTime: () => "18:00",
    showReminder() {},
    hideReminder() {},
    t: (key) => key,
    ...overrides,
  };
}

describe("reminders.__test", () => {
  it("normalizes time strings", () => {
    assert.strictEqual(initReminders.__test.normalizeTimeString("6:05"), "06:05");
    assert.strictEqual(initReminders.__test.normalizeTimeString("18:00"), "18:00");
    assert.strictEqual(initReminders.__test.normalizeTimeString("24:00"), null);
  });

  it("skips catch-up when app started after the reminder time", () => {
    const startedAt = new Date("2026-04-23T11:55:00");
    const now = new Date("2026-04-23T11:50:30");
    assert.strictEqual(initReminders.__test.shouldTriggerReminder({
      reminderTime: "11:50",
      now,
      lastShownDate: null,
      startedAt,
    }), false);
  });
});

describe("reminder scheduler", () => {
  it("triggers lunch reminder only once per day", () => {
    const shown = [];
    const reminders = initReminders(makeCtx({
      showReminder: (payload) => shown.push(payload),
    }), {
      now: () => new Date("2026-04-23T10:00:00"),
    });

    reminders.check(new Date("2026-04-23T11:50:05"));
    reminders.check(new Date("2026-04-23T11:50:45"));
    reminders.check(new Date("2026-04-24T11:50:10"));
    reminders.stop();

    assert.deepStrictEqual(shown.map((entry) => entry.kind), ["lunch", "lunch"]);
  });

  it("does not trigger while suppressed", () => {
    const shown = [];
    const reminders = initReminders(makeCtx({
      doNotDisturb: true,
      showReminder: (payload) => shown.push(payload),
    }), {
      now: () => new Date("2026-04-23T10:00:00"),
    });

    reminders.check(new Date("2026-04-23T11:50:00"));
    reminders.stop();
    assert.strictEqual(shown.length, 0);
  });

  it("syncVisibility hides active reminder when bubbles become suppressed", () => {
    let hidden = 0;
    const ctx = makeCtx({
      showReminder() {},
      hideReminder: () => { hidden++; },
    });
    const reminders = initReminders(ctx, {
      now: () => new Date("2026-04-23T10:00:00"),
    });

    reminders.check(new Date("2026-04-23T11:50:00"));
    ctx.hideBubbles = true;
    reminders.syncVisibility();
    reminders.stop();

    assert.strictEqual(hidden, 1);
    assert.strictEqual(reminders.getActiveReminder(), null);
  });
});
