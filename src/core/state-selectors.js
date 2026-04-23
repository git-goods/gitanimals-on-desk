"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDisplayStateFromSessions = resolveDisplayStateFromSessions;
exports.pickDisplayHint = pickDisplayHint;
exports.countInteractiveSessions = countInteractiveSessions;
exports.selectTieredSvg = selectTieredSvg;
exports.getWinningSessionDisplayHint = getWinningSessionDisplayHint;
function resolveDisplayStateFromSessions({ sessions, statePriority = {}, updateVisualState, } = {}) {
    let best;
    if (!sessions || sessions.size === 0) {
        best = "idle";
    }
    else {
        best = "sleeping";
        let hasNonHeadless = false;
        for (const [, session] of sessions) {
            if (session.headless)
                continue;
            hasNonHeadless = true;
            if ((statePriority[session.state || ""] || 0) > (statePriority[best] || 0)) {
                best = session.state || best;
            }
        }
        if (!hasNonHeadless)
            best = "idle";
    }
    if (updateVisualState && (statePriority[updateVisualState] || 0) >= (statePriority[best] || 0)) {
        return updateVisualState;
    }
    return best;
}
function pickDisplayHint({ state, existingDisplayHint, incomingDisplayHint, displayHintMap, } = {}) {
    if (state !== "working" && state !== "thinking" && state !== "juggling") {
        return null;
    }
    if (incomingDisplayHint !== undefined) {
        if (incomingDisplayHint === null || incomingDisplayHint === "")
            return null;
        if (displayHintMap && displayHintMap[incomingDisplayHint] != null)
            return incomingDisplayHint;
        return existingDisplayHint != null ? existingDisplayHint : null;
    }
    return existingDisplayHint != null ? existingDisplayHint : null;
}
function countInteractiveSessions(sessions, states) {
    let count = 0;
    for (const [, session] of sessions || []) {
        if (!session.headless && session.state && states.has(session.state))
            count++;
    }
    return count;
}
function selectTieredSvg({ count = 0, tiers, fallback = null, } = {}) {
    if (tiers) {
        for (const tier of tiers) {
            if (count >= tier.minSessions)
                return tier.file;
        }
    }
    return fallback;
}
function getWinningSessionDisplayHint({ sessions, targetState, displayHintMap, } = {}) {
    let best = null;
    let bestAt = -1;
    for (const [, session] of sessions || []) {
        if (session.headless || session.state !== targetState)
            continue;
        if ((session.updatedAt || 0) >= bestAt) {
            bestAt = session.updatedAt || 0;
            best = session;
        }
    }
    if (!best || !best.displayHint)
        return null;
    const resolved = displayHintMap && displayHintMap[best.displayHint];
    return resolved || null;
}
