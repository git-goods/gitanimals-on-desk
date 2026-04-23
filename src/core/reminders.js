"use strict";

function normalizeTimeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shouldTriggerReminder({ reminderTime, now, lastShownDate, startedAt }) {
  const normalized = normalizeTimeString(reminderTime);
  if (!normalized)
    return false;
  const today = toDateKey(now);
  if (lastShownDate === today)
    return false;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (currentTime !== normalized)
    return false;
  if (startedAt instanceof Date) {
    const startDay = toDateKey(startedAt);
    if (startDay === today) {
      const startTime = `${String(startedAt.getHours()).padStart(2, "0")}:${String(startedAt.getMinutes()).padStart(2, "0")}`;
      if (startTime > normalized)
        return false;
    }
  }
  return true;
}

function initReminders(ctx, deps = {}) {
  const nowFn = typeof deps.now === "function" ? deps.now : () => new Date();
  const setIntervalFn = deps.setInterval || setInterval;
  const clearIntervalFn = deps.clearInterval || clearInterval;
  const startedAt = nowFn();
  let timer = null;
  let activePayload = null;
  let hideTimer = null;
  const lastShownDateByReminder = {
    lunch: null,
    leave: null,
  };

  function t(key, fallback) {
    const value = typeof ctx.t === "function" ? ctx.t(key) : key;
    if (value && value !== key)
      return value;
    return fallback != null ? fallback : key;
  }

  function clearActiveReminder(sendHide = true) {
    const hadActiveReminder = !!activePayload || !!hideTimer;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    activePayload = null;
    if (sendHide && hadActiveReminder && typeof ctx.hideReminder === "function")
      ctx.hideReminder();
  }

  function showReminder(kind, message) {
    clearActiveReminder(false);
    activePayload = { kind, message };
    if (typeof ctx.showReminder === "function") {
      ctx.showReminder(activePayload);
    }
    hideTimer = setTimeout(() => {
      clearActiveReminder(true);
    }, 10000);
  }

  function isSuppressed() {
    return !ctx.timeRemindersEnabled || !!ctx.doNotDisturb || !!ctx.hideBubbles || !!ctx.petHidden;
  }

  function check(now = nowFn()) {
    if (isSuppressed())
      return;
    const slots = [
      {
        kind: "lunch",
        reminderTime: ctx.getLunchReminderTime(),
        message: t("reminderLunchMessage", "밥시간이야!!"),
      },
      {
        kind: "leave",
        reminderTime: ctx.getLeaveReminderTime(),
        message: t("reminderLeaveMessage", "얼렁 퇴근해~"),
      },
    ];
    for (const slot of slots) {
      if (!shouldTriggerReminder({
        reminderTime: slot.reminderTime,
        now,
        lastShownDate: lastShownDateByReminder[slot.kind],
        startedAt,
      })) {
        continue;
      }
      lastShownDateByReminder[slot.kind] = toDateKey(now);
      showReminder(slot.kind, slot.message);
    }
  }

  function start() {
    stop();
    timer = setIntervalFn(() => check(), 60 * 1000);
  }

  function stop() {
    if (timer) {
      clearIntervalFn(timer);
      timer = null;
    }
    clearActiveReminder(true);
  }

  function syncVisibility() {
    if (isSuppressed()) {
      if (activePayload)
        clearActiveReminder(true);
      return;
    }
    if (activePayload && typeof ctx.showReminder === "function") {
      ctx.showReminder(activePayload);
    }
  }

  return {
    start,
    stop,
    check,
    hideReminder: () => clearActiveReminder(true),
    syncVisibility,
    getActiveReminder: () => activePayload,
  };
}

module.exports = initReminders;
module.exports.__test = {
  normalizeTimeString,
  shouldTriggerReminder,
  toDateKey,
};
