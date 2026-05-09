import { React, h } from "../react.js";
import { Section, ToggleRow } from "../components.js";
export function AgentsTab({ snapshot, t, agentMetadata, pending, runCommand, }) {
    const isEmpty = !agentMetadata || agentMetadata.length === 0;
    return (h(React.Fragment, null,
        h("h1", null, t("agentsTitle")),
        h("p", { className: "subtitle" }, t("agentsSubtitle")),
        isEmpty ? (h("div", { className: "placeholder" },
            h("div", { className: "placeholder-desc" }, t("agentsEmpty")))) : (h(Section, { title: "" }, agentMetadata.flatMap((agent) => {
            const agentState = (snapshot.agents && snapshot.agents[agent.id]) || {};
            const enabled = agentState.enabled !== false;
            const permissionsEnabled = agentState.permissionsEnabled !== false;
            const rows = [
                h(ToggleRow, { key: `${agent.id}:enabled`, label: agent.name || agent.id, desc: h(AgentBadges, { agent: agent, t: t }), on: enabled, pending: !!pending[`agent:${agent.id}:enabled`], onToggle: () => runCommand(`agent:${agent.id}:enabled`, () => window.settingsAPI.command("setAgentFlag", {
                        agentId: agent.id,
                        flag: "enabled",
                        value: !enabled,
                    })) }),
            ];
            const caps = agent.capabilities || {};
            if (caps.permissionApproval || caps.interactiveBubble) {
                rows.push(h(ToggleRow, { key: `${agent.id}:permissionsEnabled`, label: t("rowAgentPermissions"), desc: t("rowAgentPermissionsDesc"), extraClass: "row-sub", on: permissionsEnabled, pending: !!pending[`agent:${agent.id}:permissionsEnabled`], onToggle: () => runCommand(`agent:${agent.id}:permissionsEnabled`, () => window.settingsAPI.command("setAgentFlag", {
                        agentId: agent.id,
                        flag: "permissionsEnabled",
                        value: !permissionsEnabled,
                    })) }));
            }
            return rows;
        })))));
}
function AgentBadges({ agent, t }) {
    const eventSourceKey = agent.eventSource === "log-poll"
        ? "eventSourceLogPoll"
        : agent.eventSource === "plugin-event"
            ? "eventSourcePlugin"
            : "eventSourceHook";
    return (h("span", { className: "row-desc agent-badges" },
        h("span", { className: "agent-badge" }, t(eventSourceKey)),
        agent.capabilities && agent.capabilities.permissionApproval ? (h("span", { className: "agent-badge accent" }, t("badgePermissionBubble"))) : null));
}
