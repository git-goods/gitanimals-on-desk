"use strict";

// Pure gate helpers over a prefs snapshot. Default-true for missing
// snapshot / entry / flag so an install that predates a flag still runs.

/** @typedef {import("../types/contracts").SettingsSnapshot} SettingsSnapshot */
/** @typedef {import("../types/contracts").AgentId} AgentId */

/**
 * @param {SettingsSnapshot | null | undefined | Record<string, unknown>} snapshot
 * @param {AgentId | string | null | undefined} agentId
 * @param {"enabled" | "permissionsEnabled"} flag
 */
function readFlag(snapshot, agentId, flag) {
  if (!agentId) return true;
  if (!snapshot || typeof snapshot !== "object") return true;
  const agents = snapshot.agents;
  if (!agents || typeof agents !== "object") return true;
  const entry = agents[agentId];
  if (!entry || typeof entry !== "object") return true;
  return entry[flag] !== false;
}

const isAgentEnabled = (snapshot, agentId) => readFlag(snapshot, agentId, "enabled");
const isAgentPermissionsEnabled = (snapshot, agentId) => readFlag(snapshot, agentId, "permissionsEnabled");

module.exports = { isAgentEnabled, isAgentPermissionsEnabled };
