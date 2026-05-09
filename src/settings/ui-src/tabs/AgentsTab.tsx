import { React, h } from "../react.js";
import { Section, ToggleRow } from "../components.js";
import type {
  AgentMetadata,
  PendingMap,
  RunCommand,
  Snapshot,
  Translator,
} from "../types.js";

interface AgentsTabProps {
  snapshot: Snapshot;
  t: Translator;
  agentMetadata: AgentMetadata[];
  pending: PendingMap;
  runCommand: RunCommand;
}

export function AgentsTab({
  snapshot,
  t,
  agentMetadata,
  pending,
  runCommand,
}: AgentsTabProps) {
  const isEmpty = !agentMetadata || agentMetadata.length === 0;
  return (
    <>
      <h1>{t("agentsTitle")}</h1>
      <p className="subtitle">{t("agentsSubtitle")}</p>
      {isEmpty ? (
        <div className="placeholder">
          <div className="placeholder-desc">{t("agentsEmpty")}</div>
        </div>
      ) : (
        <Section title="">
          {agentMetadata.flatMap((agent) => {
            const agentState =
              (snapshot.agents && snapshot.agents[agent.id]) || {};
            const enabled = agentState.enabled !== false;
            const permissionsEnabled = agentState.permissionsEnabled !== false;
            const rows = [
              <ToggleRow
                key={`${agent.id}:enabled`}
                label={agent.name || agent.id}
                desc={<AgentBadges agent={agent} t={t} />}
                on={enabled}
                pending={!!pending[`agent:${agent.id}:enabled`]}
                onToggle={() =>
                  runCommand(`agent:${agent.id}:enabled`, () =>
                    window.settingsAPI.command("setAgentFlag", {
                      agentId: agent.id,
                      flag: "enabled",
                      value: !enabled,
                    }),
                  )
                }
              />,
            ];

            const caps = agent.capabilities || {};
            if (caps.permissionApproval || caps.interactiveBubble) {
              rows.push(
                <ToggleRow
                  key={`${agent.id}:permissionsEnabled`}
                  label={t("rowAgentPermissions")}
                  desc={t("rowAgentPermissionsDesc")}
                  extraClass="row-sub"
                  on={permissionsEnabled}
                  pending={!!pending[`agent:${agent.id}:permissionsEnabled`]}
                  onToggle={() =>
                    runCommand(`agent:${agent.id}:permissionsEnabled`, () =>
                      window.settingsAPI.command("setAgentFlag", {
                        agentId: agent.id,
                        flag: "permissionsEnabled",
                        value: !permissionsEnabled,
                      }),
                    )
                  }
                />,
              );
            }
            return rows;
          })}
        </Section>
      )}
    </>
  );
}

interface AgentBadgesProps {
  agent: AgentMetadata;
  t: Translator;
}

function AgentBadges({ agent, t }: AgentBadgesProps) {
  const eventSourceKey =
    agent.eventSource === "log-poll"
      ? "eventSourceLogPoll"
      : agent.eventSource === "plugin-event"
        ? "eventSourcePlugin"
        : "eventSourceHook";
  return (
    <span className="row-desc agent-badges">
      <span className="agent-badge">{t(eventSourceKey)}</span>
      {agent.capabilities && agent.capabilities.permissionApproval ? (
        <span className="agent-badge accent">{t("badgePermissionBubble")}</span>
      ) : null}
    </span>
  );
}
