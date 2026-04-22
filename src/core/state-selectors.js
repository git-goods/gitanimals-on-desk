"use strict";

/**
 * @param {{
 *   sessions?: Map<string, { state?: string, headless?: boolean }>,
 *   statePriority?: Record<string, number>,
 *   updateVisualState?: string | null
 * }} [options]
 */
function resolveDisplayStateFromSessions({ sessions, statePriority, updateVisualState } = {}) {
  let best;
  if (!sessions || sessions.size === 0) {
    best = "idle";
  } else {
    best = "sleeping";
    let hasNonHeadless = false;
    for (const [, session] of sessions) {
      if (session.headless) continue;
      hasNonHeadless = true;
      if ((statePriority[session.state] || 0) > (statePriority[best] || 0)) {
        best = session.state;
      }
    }
    if (!hasNonHeadless) best = "idle";
  }

  if (updateVisualState && (statePriority[updateVisualState] || 0) >= (statePriority[best] || 0)) {
    return updateVisualState;
  }
  return best;
}

/**
 * @param {{
 *   state?: string,
 *   existingDisplayHint?: string | null,
 *   incomingDisplayHint?: string | null | undefined,
 *   displayHintMap?: Record<string, string>
 * }} [options]
 */
function pickDisplayHint({ state, existingDisplayHint, incomingDisplayHint, displayHintMap } = {}) {
  if (state !== "working" && state !== "thinking" && state !== "juggling") {
    return null;
  }
  if (incomingDisplayHint !== undefined) {
    if (incomingDisplayHint === null || incomingDisplayHint === "") return null;
    if (displayHintMap && displayHintMap[incomingDisplayHint] != null) return incomingDisplayHint;
    return existingDisplayHint != null ? existingDisplayHint : null;
  }
  return existingDisplayHint != null ? existingDisplayHint : null;
}

/**
 * @param {Map<string, { state?: string, headless?: boolean }>} sessions
 * @param {Set<string>} states
 */
function countInteractiveSessions(sessions, states) {
  let count = 0;
  for (const [, session] of sessions || []) {
    if (!session.headless && states.has(session.state)) count++;
  }
  return count;
}

/**
 * @param {{
 *   count?: number,
 *   tiers?: Array<{ minSessions: number, file: string }> | null,
 *   fallback?: string | null
 * }} [options]
 */
function selectTieredSvg({ count, tiers, fallback } = {}) {
  if (tiers) {
    for (const tier of tiers) {
      if (count >= tier.minSessions) return tier.file;
    }
  }
  return fallback;
}

/**
 * @param {{
 *   sessions?: Map<string, { state?: string, headless?: boolean, updatedAt?: number, displayHint?: string | null }>,
 *   targetState?: string,
 *   displayHintMap?: Record<string, string>
 * }} [options]
 */
function getWinningSessionDisplayHint({ sessions, targetState, displayHintMap } = {}) {
  let best = null;
  let bestAt = -1;
  for (const [, session] of sessions || []) {
    if (session.headless || session.state !== targetState) continue;
    if (session.updatedAt >= bestAt) {
      bestAt = session.updatedAt;
      best = session;
    }
  }
  if (!best || !best.displayHint) return null;
  const resolved = displayHintMap && displayHintMap[best.displayHint];
  return resolved || null;
}

module.exports = {
  resolveDisplayStateFromSessions,
  pickDisplayHint,
  countInteractiveSessions,
  selectTieredSvg,
  getWinningSessionDisplayHint,
};
