import { h } from "./react.js";
import { SIDEBAR_TABS } from "./settings-data.js";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function ToastStack({ toasts }: any) {
  return (
    <div className="toast-stack" id="toastStack">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cx("toast", toast.error && "error", "visible")}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function Sidebar({ activeTab, setActiveTab, t }: any) {
  return (
    <nav className="sidebar" id="sidebar">
      {SIDEBAR_TABS.map((tab) => (
        <div
          key={tab.id}
          className={cx(
            "sidebar-item",
            !tab.available && "disabled",
            tab.id === activeTab && "active",
          )}
          onClick={tab.available ? () => setActiveTab(tab.id) : undefined}
        >
          <span className="sidebar-item-icon">{tab.icon}</span>
          <span className="sidebar-item-label">{t(tab.labelKey)}</span>
          {!tab.available && (
            <span className="sidebar-item-soon">{t("sidebarSoon")}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

export function Section({ title, children }: any) {
  return (
    <section className="section">
      {title ? <h2 className="section-title">{title}</h2> : null}
      <div className="section-rows">{children}</div>
    </section>
  );
}

export function SwitchControl({ on, pending, disabled, onToggle }: any) {
  const handleKeyDown = (event) => {
    if (disabled || pending) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="row-control">
      <div
        className={cx(
          "switch",
          on && "on",
          pending && "pending",
          disabled && "disabled",
        )}
        role="switch"
        tabIndex={disabled ? -1 : 0}
        aria-checked={on ? "true" : "false"}
        onClick={disabled || pending ? undefined : onToggle}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

export function SettingRow({ label, desc, control, extraClass }: any) {
  return (
    <div className={cx("row", extraClass)}>
      <div className="row-text">
        <span className="row-label">{label}</span>
        {desc ? <span className="row-desc">{desc}</span> : null}
      </div>
      {control}
    </div>
  );
}

export function ToggleRow({
  label,
  desc,
  on,
  pending,
  disabled,
  onToggle,
  extraClass,
}: any) {
  return (
    <SettingRow
      label={label}
      desc={desc}
      extraClass={extraClass}
      control={
        <SwitchControl
          on={on}
          pending={pending}
          disabled={disabled}
          onToggle={onToggle}
        />
      }
    />
  );
}

export function UserCard({
  t,
  userInfo,
  pending,
  onLogout,
  onSignInAgain,
}: any) {
  return (
    <Section title="">
      <div className="row">
        <div className="row-text">
          <span className="row-label">
            {userInfo
              ? `\u{1F464} @${userInfo.username}`
              : `\u{1F464} ${t("userCardLoading")}`}
          </span>
          <span className="row-desc">{t("userCardSignedIn")}</span>
        </div>
        <div className="row-control" style={{ display: "flex", gap: "6px" }}>
          <button
            className="btn"
            type="button"
            disabled={pending}
            onClick={onLogout}
          >
            {t("userCardSignOut")}
          </button>
          <button
            className="btn"
            type="button"
            disabled={pending}
            onClick={onSignInAgain}
          >
            {t("userCardSignInAgain")}
          </button>
        </div>
      </div>
    </Section>
  );
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

export function UpdateSection({
  t,
  updateState,
  pending,
  runCommand,
}: any) {
  const status = (updateState && updateState.status) || "idle";
  const currentVersion = (updateState && updateState.currentVersion) || "0.0.0";
  const latestVersion = (updateState && updateState.latestVersion) || "";
  const lastCheckedAt = updateState && updateState.lastCheckedAt;
  const lastError = (updateState && updateState.lastError) || "";
  const isUpToDate =
    status === "idle" &&
    latestVersion &&
    String(latestVersion).replace(/^v/, "") ===
      String(currentVersion).replace(/^v/, "");

  let statusText = t("updateStatusIdle");
  if (isUpToDate) statusText = t("updateStatusUpToDate");
  else if (status === "checking") statusText = t("updateStatusChecking");
  else if (status === "available") statusText = t("updateStatusAvailable");
  else if (status === "downloading") statusText = t("updateStatusDownloading");
  else if (status === "ready") statusText = t("updateStatusReady");
  else if (status === "error") statusText = t("updateStatusError");

  return (
    <Section title={t("sectionUpdates")}>
      <div className="update-card">
        <div className="update-summary">
          <div className={cx("update-status", status)}>{statusText}</div>
          <div className="update-meta-grid">
            <span className="update-meta-label">
              {t("updateCurrentVersion")}
            </span>
            <span className="update-meta-value mono">{`v${currentVersion}`}</span>
            <span className="update-meta-label">
              {t("updateLatestVersion")}
            </span>
            <span className="update-meta-value mono">
              {latestVersion
                ? `v${String(latestVersion).replace(/^v/, "")}`
                : "—"}
            </span>
            <span className="update-meta-label">
              {t("updateLastChecked")}
            </span>
            <span className="update-meta-value">
              {lastCheckedAt
                ? formatDateTime(lastCheckedAt)
                : t("updateNeverChecked")}
            </span>
          </div>
          {updateState ? (
            <div className="update-flow">
              {updateState.flow === "git"
                ? t("updateFlowGit")
                : t("updateFlowAuto")}
            </div>
          ) : null}
          {lastError ? (
            <div className="update-error-text">{lastError}</div>
          ) : null}
        </div>
        <div className="update-actions">
          <button
            key="check"
            className="btn"
            type="button"
            disabled={
              !!pending.checkForUpdates ||
              !updateState ||
              !updateState.canCheck
            }
            onClick={() =>
              runCommand("checkForUpdates", () =>
                window.settingsAPI.command("checkForUpdatesFromSettings"),
              )
            }
          >
            {t("updateCheckNow")}
          </button>
          {updateState && updateState.canApplyUpdate && (
            <button
              key="apply"
              className="btn primary"
              type="button"
              disabled={!!pending.applyUpdate}
              onClick={() =>
                runCommand("applyUpdate", () =>
                  window.settingsAPI.command("applyUpdateFromSettings"),
                )
              }
            >
              {updateState.flow === "git"
                ? t("updateInstallNow")
                : t("updateDownloadNow")}
            </button>
          )}
          {updateState && updateState.canRestartToUpdate && (
            <button
              key="restart"
              className="btn primary"
              type="button"
              disabled={!!pending.restartToUpdate}
              onClick={() =>
                runCommand("restartToUpdate", () =>
                  window.settingsAPI.command("restartToUpdateFromSettings"),
                )
              }
            >
              {t("updateRestartNow")}
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}
