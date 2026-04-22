"use strict";

type SessionStateRecord = {
  state?: string;
  headless?: boolean;
  updatedAt?: number;
  displayHint?: string | null;
};

type DisplayStateOptions = {
  sessions?: Map<string, SessionStateRecord>;
  statePriority?: Record<string, number>;
  updateVisualState?: string | null;
};

type DisplayHintOptions = {
  state?: string;
  existingDisplayHint?: string | null;
  incomingDisplayHint?: string | null | undefined;
  displayHintMap?: Record<string, string>;
};

type TieredSvg = {
  minSessions: number;
  file: string;
};

type TieredSvgOptions = {
  count?: number;
  tiers?: TieredSvg[] | null;
  fallback?: string | null;
};

type WinningSessionDisplayHintOptions = {
  sessions?: Map<string, SessionStateRecord>;
  targetState?: string;
  displayHintMap?: Record<string, string>;
};

export function resolveDisplayStateFromSessions({
  sessions,
  statePriority = {},
  updateVisualState,
}: DisplayStateOptions = {}): string {
  let best: string;
  if (!sessions || sessions.size === 0) {
    best = "idle";
  } else {
    best = "sleeping";
    let hasNonHeadless = false;
    for (const [, session] of sessions) {
      if (session.headless) continue;
      hasNonHeadless = true;
      if ((statePriority[session.state || ""] || 0) > (statePriority[best] || 0)) {
        best = session.state || best;
      }
    }
    if (!hasNonHeadless) best = "idle";
  }

  if (updateVisualState && (statePriority[updateVisualState] || 0) >= (statePriority[best] || 0)) {
    return updateVisualState;
  }
  return best;
}

export function pickDisplayHint({
  state,
  existingDisplayHint,
  incomingDisplayHint,
  displayHintMap,
}: DisplayHintOptions = {}): string | null {
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

export function countInteractiveSessions(
  sessions: Map<string, SessionStateRecord> | undefined,
  states: Set<string>
): number {
  let count = 0;
  for (const [, session] of sessions || []) {
    if (!session.headless && session.state && states.has(session.state)) count++;
  }
  return count;
}

export function selectTieredSvg({
  count = 0,
  tiers,
  fallback = null,
}: TieredSvgOptions = {}): string | null {
  if (tiers) {
    for (const tier of tiers) {
      if (count >= tier.minSessions) return tier.file;
    }
  }
  return fallback;
}

export function getWinningSessionDisplayHint({
  sessions,
  targetState,
  displayHintMap,
}: WinningSessionDisplayHintOptions = {}): string | null {
  let best: SessionStateRecord | null = null;
  let bestAt = -1;
  for (const [, session] of sessions || []) {
    if (session.headless || session.state !== targetState) continue;
    if ((session.updatedAt || 0) >= bestAt) {
      bestAt = session.updatedAt || 0;
      best = session;
    }
  }
  if (!best || !best.displayHint) return null;
  const resolved = displayHintMap && displayHintMap[best.displayHint];
  return resolved || null;
}
