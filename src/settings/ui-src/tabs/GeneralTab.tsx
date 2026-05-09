import { React, h } from "../react.js";
import {
  Section,
  ToggleRow,
  UpdateSection,
  UserCard,
} from "../components.js";
import type {
  PendingMap,
  RunCommand,
  RunUpdate,
  Snapshot,
  Translator,
  UpdateState,
  UserInfo,
} from "../types.js";

interface GeneralTabProps {
  snapshot: Snapshot;
  t: Translator;
  pending: PendingMap;
  runUpdate: RunUpdate;
  runCommand: RunCommand;
  userInfo: UserInfo | null;
  updateState: UpdateState | null;
}

export function GeneralTab({
  snapshot,
  t,
  pending,
  runUpdate,
  runCommand,
  userInfo,
  updateState,
}: GeneralTabProps) {
  const soundEnabled = !snapshot.soundMuted;

  return (
    <>
      <h1>{t("settingsTitle")}</h1>
      <p className="subtitle">{t("settingsSubtitle")}</p>
      <UserCard
        t={t}
        userInfo={userInfo}
        pending={!!pending.auth}
        onLogout={() =>
          runCommand("auth", () => window.settingsAPI.command("logout"))
        }
        onSignInAgain={() =>
          runCommand("auth", () => window.settingsAPI.command("signIn"))
        }
      />
      <Section title={t("sectionAppearance")}>
        <LanguageRow
          snapshot={snapshot}
          t={t}
          pending={!!pending.lang}
          onChange={(lang) => runUpdate("lang", "lang", lang)}
        />
        <ToggleRow
          label={t("rowSound")}
          desc={t("rowSoundDesc")}
          on={soundEnabled}
          pending={!!pending.soundMuted}
          onToggle={() => runUpdate("soundMuted", "soundMuted", soundEnabled)}
        />
        <ToggleRow
          label={t("rowFlip")}
          desc={t("rowFlipDesc")}
          on={!!snapshot.flip}
          pending={!!pending.flip}
          onToggle={() => runUpdate("flip", "flip", !snapshot.flip)}
        />
      </Section>
      <Section title={t("sectionStartup")}>
        <ToggleRow
          label={t("rowOpenAtLogin")}
          desc={t("rowOpenAtLoginDesc")}
          on={!!snapshot.openAtLogin}
          pending={!!pending.openAtLogin}
          onToggle={() =>
            runUpdate("openAtLogin", "openAtLogin", !snapshot.openAtLogin)
          }
        />
        <ToggleRow
          label={t("rowStartWithClaude")}
          desc={t("rowStartWithClaudeDesc")}
          on={!!snapshot.autoStartWithClaude}
          pending={!!pending.autoStartWithClaude}
          onToggle={() =>
            runUpdate(
              "autoStartWithClaude",
              "autoStartWithClaude",
              !snapshot.autoStartWithClaude,
            )
          }
        />
        <ToggleRow
          label={t("rowAutoCheckUpdates")}
          desc={t("rowAutoCheckUpdatesDesc")}
          on={!!snapshot.autoCheckForUpdates}
          pending={!!pending.autoCheckForUpdates}
          onToggle={() =>
            runUpdate(
              "autoCheckForUpdates",
              "autoCheckForUpdates",
              !snapshot.autoCheckForUpdates,
            )
          }
        />
      </Section>
      <UpdateSection
        t={t}
        updateState={updateState}
        pending={pending}
        runCommand={runCommand}
      />
      {snapshot.platform === "darwin" && (
        <Section title={t("sectionMacOS")}>
          <ToggleRow
            label={t("rowShowInMenuBar")}
            desc={t("rowShowInMenuBarDesc")}
            on={!!snapshot.showTray}
            disabled={!!snapshot.showTray && !snapshot.showDock}
            pending={!!pending.showTray}
            onToggle={() =>
              runUpdate("showTray", "showTray", !snapshot.showTray)
            }
          />
          <ToggleRow
            label={t("rowShowInDock")}
            desc={t("rowShowInDockDesc")}
            on={!!snapshot.showDock}
            disabled={!!snapshot.showDock && !snapshot.showTray}
            pending={!!pending.showDock}
            onToggle={() =>
              runUpdate("showDock", "showDock", !snapshot.showDock)
            }
          />
        </Section>
      )}
      <Section title={t("sectionBubbles")}>
        <ToggleRow
          label={t("rowBubbleFollow")}
          desc={t("rowBubbleFollowDesc")}
          on={!!snapshot.bubbleFollowPet}
          pending={!!pending.bubbleFollowPet}
          onToggle={() =>
            runUpdate(
              "bubbleFollowPet",
              "bubbleFollowPet",
              !snapshot.bubbleFollowPet,
            )
          }
        />
        <ToggleRow
          label={t("rowHideBubbles")}
          desc={t("rowHideBubblesDesc")}
          on={!!snapshot.hideBubbles}
          pending={!!pending.hideBubbles}
          onToggle={() =>
            runUpdate("hideBubbles", "hideBubbles", !snapshot.hideBubbles)
          }
        />
        <ToggleRow
          label={t("rowShowSessionId")}
          desc={t("rowShowSessionIdDesc")}
          on={!!snapshot.showSessionId}
          pending={!!pending.showSessionId}
          onToggle={() =>
            runUpdate("showSessionId", "showSessionId", !snapshot.showSessionId)
          }
        />
      </Section>
      <Section title={t("sectionPrivacy")}>
        <ToggleRow
          label={t("rowSendDiagnostics")}
          desc={t("rowSendDiagnosticsDesc")}
          on={snapshot.sendDiagnostics !== false}
          pending={!!pending.sendDiagnostics}
          onToggle={() =>
            runUpdate(
              "sendDiagnostics",
              "sendDiagnostics",
              snapshot.sendDiagnostics === false,
            )
          }
        />
      </Section>
    </>
  );
}

interface LanguageRowProps {
  snapshot: Snapshot;
  t: Translator;
  pending: boolean;
  onChange: (lang: string) => void;
}

function LanguageRow({ snapshot, t, pending, onChange }: LanguageRowProps) {
  const current = snapshot.lang || "en";
  const options = [
    { value: "en", label: t("langEnglish") },
    { value: "zh", label: t("langChinese") },
    { value: "ko", label: t("langKorean") },
  ];

  return (
    <div className="row">
      <div className="row-text">
        <span className="row-label">{t("rowLanguage")}</span>
        <span className="row-desc">{t("rowLanguageDesc")}</span>
      </div>
      <div className="row-control">
        <div className="segmented" role="tablist">
          {options.map((option) => (
            <button
              key={option.value}
              className={option.value === current ? "active" : ""}
              disabled={pending}
              onClick={() => {
                if (option.value !== current) onChange(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
