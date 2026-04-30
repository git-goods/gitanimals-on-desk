"use strict";

const React = window.React;
const ReactDOM = window.ReactDOM;

if (!React || !ReactDOM) {
  throw new Error("Settings renderer requires React and ReactDOM globals");
}

const { useEffect, useMemo, useRef, useState } = React;
const h = React.createElement;

const STRINGS = {
  en: {
    settingsTitle: "Settings",
    settingsSubtitle: "Configure how GitAnimals behaves on your desktop.",
    sidebarGeneral: "General",
    sidebarAgents: "Agents",
    sidebarTheme: "Theme",
    sidebarAnimMap: "Animation Map",
    sidebarShortcuts: "Shortcuts",
    sidebarAbout: "About",
    sidebarSoon: "Soon",
    sectionAppearance: "Appearance",
    sectionStartup: "Startup",
    sectionBubbles: "Bubbles",
    agentsTitle: "Agents",
    agentsSubtitle:
      "Turn tracking on or off per agent. Disabled agents stop log monitors and drop hook events at the HTTP boundary — they won't drive the pet, show permission bubbles, or keep sessions.",
    agentsEmpty: "No agents registered.",
    eventSourceHook: "Hook",
    eventSourceLogPoll: "Log poll",
    eventSourcePlugin: "Plugin",
    badgePermissionBubble: "Permission bubble",
    rowAgentPermissions: "Show pop-up bubbles",
    rowAgentPermissionsDesc:
      "Turn off to let this agent handle prompts in its own terminal instead of showing a permission bubble.",
    rowLanguage: "Language",
    rowLanguageDesc: "Interface language for menus and bubbles.",
    rowSound: "Sound effects",
    rowSoundDesc:
      "Play a chime when GitAnimals finishes a task or asks for input.",
    rowFlip: "Flip horizontally",
    rowFlipDesc: "Mirror the pet so it faces the other direction.",
    rowOpenAtLogin: "Open at login",
    rowOpenAtLoginDesc: "Start GitAnimals automatically when you log in.",
    rowStartWithClaude: "Start with Claude Code",
    rowStartWithClaudeDesc:
      "Auto-launch GitAnimals whenever a Claude Code session starts.",
    rowAutoCheckUpdates: "Automatically check for updates",
    rowAutoCheckUpdatesDesc:
      "Check for new versions in the background every 12 hours.",
    sectionUpdates: "Updates",
    updateCurrentVersion: "Current version",
    updateLatestVersion: "Latest version",
    updateLastChecked: "Last checked",
    updateNeverChecked: "Never",
    updateStatusIdle: "Ready to check for updates.",
    updateStatusChecking: "Checking GitHub for the latest release…",
    updateStatusAvailable: "A newer version is available.",
    updateStatusDownloading: "Downloading the update now…",
    updateStatusReady: "The update has been downloaded and is ready to install.",
    updateStatusError: "The last update attempt failed.",
    updateStatusUpToDate: "You're on the latest version.",
    updateCheckNow: "Check now",
    updateDownloadNow: "Download update",
    updateInstallNow: "Install update",
    updateRestartNow: "Restart to update",
    updateFlowGit: "Development checkout",
    updateFlowAuto: "Packaged app",
    rowBubbleFollow: "Bubbles follow the pet",
    rowBubbleFollowDesc:
      "Place permission and update bubbles next to the pet instead of the screen corner.",
    rowHideBubbles: "Hide all bubbles",
    rowHideBubblesDesc:
      "Suppress permission, notification, and update bubbles entirely.",
    rowShowSessionId: "Show session ID",
    rowShowSessionIdDesc:
      "Append the short session ID to bubble headers and the Sessions menu.",
    sectionMacOS: "macOS",
    rowShowInMenuBar: "Show in Menu Bar",
    rowShowInMenuBarDesc: "Display the GitAnimals icon in the macOS menu bar.",
    rowShowInDock: "Show in Dock",
    rowShowInDockDesc:
      "Display GitAnimals in the macOS Dock. At least one must stay visible.",
    sectionPrivacy: "Privacy",
    rowSendDiagnostics: "Send anonymous diagnostics",
    rowSendDiagnosticsDesc:
      "Share crash reports and anonymised event breadcrumbs so the maintainers can diagnose issues like the pet disappearing. No personal data.",
    placeholderTitle: "Coming soon",
    placeholderDesc:
      "This panel will land in a future GitAnimals release. The plan lives in docs/plan-settings-panel.md.",
    toastSaveFailed: "Couldn't save: ",
    langEnglish: "English",
    langChinese: "中文",
    themeTabTitle: "Theme",
    themeTabSubtitle:
      "Pinned themes appear in the right-click Persona submenu. At least one must stay pinned.",
    themeRefresh: "Refresh",
    themeRefreshing: "Refreshing…",
    themeRefreshDone: "Themes refreshed.",
    themeRefreshFailed: "Refresh failed: ",
    toastActiveLocked: "Cannot unpin the active theme.",
    toastMinOneRequired: "At least one theme must remain pinned.",
    toastPersonaRequired: "Get this pet at GitAnimals!",
    toastPersonaLink: "https://gitanimals.org",
    personaInfo: "Locked themes require a GitAnimals pet.",
    personaInfoLink: "Get one at gitanimals.org",
    langKorean: "한국어",
    userCardSignedIn: "Signed in",
    userCardLoading: "Loading account…",
    userCardSignOut: "Sign out",
    userCardSignInAgain: "Sign in again",
    sessionExpiredToast: "Session expired — please sign in again.",
  },
  zh: {
    settingsTitle: "设置",
    settingsSubtitle: "配置 GitAnimals 在桌面上的行为。",
    sidebarGeneral: "通用",
    sidebarAgents: "Agent 管理",
    sidebarTheme: "主题",
    sidebarAnimMap: "动画映射",
    sidebarShortcuts: "快捷键",
    sidebarAbout: "关于",
    sidebarSoon: "待推出",
    sectionAppearance: "外观",
    sectionStartup: "启动",
    sectionBubbles: "气泡",
    agentsTitle: "Agent 管理",
    agentsSubtitle:
      "按 agent 类型开关追踪。关闭后会停掉日志监视器、在 HTTP 入口丢弃 hook 事件——不会再驱动桌宠、不弹权限气泡、不记会话。",
    agentsEmpty: "没有已注册的 agent。",
    eventSourceHook: "Hook",
    eventSourceLogPoll: "日志轮询",
    eventSourcePlugin: "插件",
    badgePermissionBubble: "权限气泡",
    rowAgentPermissions: "显示弹窗",
    rowAgentPermissionsDesc:
      "关闭后让该 agent 在自己的终端里处理提示，不再弹 权限气泡。",
    rowLanguage: "语言",
    rowLanguageDesc: "菜单和气泡的界面语言。",
    rowSound: "音效",
    rowSoundDesc: "GitAnimals 完成任务或需要输入时播放提示音。",
    rowFlip: "水平翻转",
    rowFlipDesc: "镜像宠物使其面向另一方向。",
    rowOpenAtLogin: "开机自启",
    rowOpenAtLoginDesc: "登录系统时自动启动 GitAnimals。",
    rowStartWithClaude: "随 Claude Code 启动",
    rowStartWithClaudeDesc: "Claude Code 会话开始时自动拉起 GitAnimals。",
    rowAutoCheckUpdates: "自动检查更新",
    rowAutoCheckUpdatesDesc: "每 12 小时在后台检查新版本。",
    sectionUpdates: "更新",
    updateCurrentVersion: "当前版本",
    updateLatestVersion: "最新版本",
    updateLastChecked: "上次检查",
    updateNeverChecked: "从未",
    updateStatusIdle: "可以检查更新。",
    updateStatusChecking: "正在从 GitHub 检查最新发布版本…",
    updateStatusAvailable: "发现了新版本。",
    updateStatusDownloading: "正在下载更新…",
    updateStatusReady: "更新已下载完成，可以安装。",
    updateStatusError: "上次更新失败。",
    updateStatusUpToDate: "当前已是最新版本。",
    updateCheckNow: "立即检查",
    updateDownloadNow: "下载更新",
    updateInstallNow: "安装更新",
    updateRestartNow: "重启并更新",
    updateFlowGit: "开发仓库",
    updateFlowAuto: "已打包应用",
    rowBubbleFollow: "气泡跟随桌宠",
    rowBubbleFollowDesc: "把权限气泡和更新气泡放在桌宠旁边，而不是屏幕角落。",
    rowHideBubbles: "隐藏所有气泡",
    rowHideBubblesDesc: "完全屏蔽权限、通知和更新气泡。",
    rowShowSessionId: "显示会话 ID",
    rowShowSessionIdDesc: "在气泡标题和会话菜单后追加短会话 ID。",
    sectionMacOS: "macOS",
    rowShowInMenuBar: "在菜单栏中显示",
    rowShowInMenuBarDesc: "在 macOS 菜单栏中显示 GitAnimals 图标。",
    rowShowInDock: "在 Dock 中显示",
    rowShowInDockDesc:
      "在 macOS Dock 中显示 GitAnimals。菜单栏和 Dock 至少保留一个。",
    sectionPrivacy: "隐私",
    rowSendDiagnostics: "发送匿名诊断数据",
    rowSendDiagnosticsDesc:
      "共享崩溃报告和匿名化事件面包屑，帮助维护者诊断诸如桌宠消失之类的问题。不包含任何个人信息。",
    placeholderTitle: "即将推出",
    placeholderDesc:
      "此面板将在 GitAnimals 后续版本中加入，规划见 docs/plan-settings-panel.md。",
    toastSaveFailed: "保存失败：",
    langEnglish: "English",
    langChinese: "中文",
    themeTabTitle: "主题",
    themeTabSubtitle:
      "已固定的主题会出现在右键菜单的「角色」子菜单中。至少保留一个固定主题。",
    themeRefresh: "刷新",
    themeRefreshing: "刷新中…",
    themeRefreshDone: "主题已刷新。",
    themeRefreshFailed: "刷新失败：",
    toastActiveLocked: "无法取消固定当前使用的主题。",
    toastMinOneRequired: "至少需要保留一个固定主题。",
    toastPersonaRequired: "在 GitAnimals 获取这个宠物吧！",
    toastPersonaLink: "https://gitanimals.org",
    personaInfo: "锁定的主题需要 GitAnimals 宠物。",
    personaInfoLink: "前往 gitanimals.org 获取",
    langKorean: "한국어",
    userCardSignedIn: "已登录",
    userCardLoading: "加载账号…",
    userCardSignOut: "退出登录",
    userCardSignInAgain: "重新登录",
    sessionExpiredToast: "会话已过期 — 请重新登录。",
  },
  ko: {
    settingsTitle: "설정",
    settingsSubtitle: "GitAnimals의 데스크톱 동작 방식을 설정합니다.",
    sidebarGeneral: "일반",
    sidebarAgents: "Agents",
    sidebarTheme: "테마",
    sidebarAnimMap: "애니메이션 매핑",
    sidebarShortcuts: "단축키",
    sidebarAbout: "정보",
    sidebarSoon: "준비 중",
    sectionAppearance: "모양",
    sectionStartup: "시작",
    sectionBubbles: "버블",
    agentsTitle: "Agents",
    agentsSubtitle:
      "Agent별로 추적을 켜거나 끌 수 있어요. 비활성화된 agent는 로그 모니터가 멈추고 HTTP 경계에서 hook 이벤트가 드롭돼요 — 펫을 움직이지도, 권한 버블을 표시하지도, 세션을 유지하지도 않아요.",
    agentsEmpty: "등록된 agent가 없어요.",
    eventSourceHook: "Hook",
    eventSourceLogPoll: "로그 폴링",
    eventSourcePlugin: "플러그인",
    badgePermissionBubble: "권한 버블",
    rowAgentPermissions: "팝업 버블 표시",
    rowAgentPermissionsDesc:
      "끄면 이 agent가 자기 터미널에서 프롬프트를 처리하고 권한 버블을 띄우지 않아요.",
    rowLanguage: "언어",
    rowLanguageDesc: "메뉴와 버블의 인터페이스 언어예요.",
    rowSound: "효과음",
    rowSoundDesc:
      "GitAnimals가 작업을 마치거나 입력을 요청할 때 알림음을 재생해요.",
    rowFlip: "좌우 반전",
    rowFlipDesc: "펫의 좌우를 뒤집어 반대 방향을 바라보게 해요.",
    rowOpenAtLogin: "로그인 시 실행",
    rowOpenAtLoginDesc: "로그인할 때 GitAnimals를 자동으로 시작해요.",
    rowStartWithClaude: "Claude Code와 함께 시작",
    rowStartWithClaudeDesc:
      "Claude Code 세션이 시작될 때마다 GitAnimals를 자동으로 실행해요.",
    rowAutoCheckUpdates: "자동으로 업데이트 확인",
    rowAutoCheckUpdatesDesc: "12시간마다 백그라운드에서 새 버전을 확인해요.",
    sectionUpdates: "업데이트",
    updateCurrentVersion: "현재 버전",
    updateLatestVersion: "최신 버전",
    updateLastChecked: "마지막 확인",
    updateNeverChecked: "아직 없음",
    updateStatusIdle: "업데이트를 확인할 준비가 됐어요.",
    updateStatusChecking: "GitHub에서 최신 릴리스를 확인하는 중이에요…",
    updateStatusAvailable: "더 새로운 버전이 있어요.",
    updateStatusDownloading: "업데이트를 다운로드하는 중이에요…",
    updateStatusReady: "업데이트가 다운로드되었고 설치할 준비가 됐어요.",
    updateStatusError: "마지막 업데이트 시도가 실패했어요.",
    updateStatusUpToDate: "현재 최신 버전을 사용 중이에요.",
    updateCheckNow: "지금 확인",
    updateDownloadNow: "업데이트 다운로드",
    updateInstallNow: "업데이트 적용",
    updateRestartNow: "재시작 후 업데이트",
    updateFlowGit: "개발 체크아웃",
    updateFlowAuto: "패키징 앱",
    rowBubbleFollow: "버블이 펫을 따라오기",
    rowBubbleFollowDesc:
      "권한 버블과 업데이트 버블을 화면 구석 대신 펫 옆에 표시해요.",
    rowHideBubbles: "모든 버블 숨기기",
    rowHideBubblesDesc: "권한·알림·업데이트 버블을 모두 숨겨요.",
    rowShowSessionId: "세션 ID 표시",
    rowShowSessionIdDesc: "버블 헤더와 세션 메뉴에 짧은 세션 ID를 추가해요.",
    sectionMacOS: "macOS",
    rowShowInMenuBar: "메뉴 막대에 표시",
    rowShowInMenuBarDesc: "macOS 메뉴 막대에 GitAnimals 아이콘을 표시해요.",
    rowShowInDock: "Dock에 표시",
    rowShowInDockDesc:
      "macOS Dock에 GitAnimals를 표시해요. 메뉴 막대와 Dock 중 하나는 반드시 켜져 있어야 해요.",
    sectionPrivacy: "개인정보",
    rowSendDiagnostics: "익명 진단 데이터 전송",
    rowSendDiagnosticsDesc:
      "크래시 리포트와 익명화된 이벤트 기록을 공유해 주시면, 펫이 사라지는 등의 문제를 진단하는 데 도움이 돼요. 개인정보는 포함되지 않아요.",
    placeholderTitle: "곧 제공됩니다",
    placeholderDesc:
      "이 패널은 향후 GitAnimals 버전에 추가될 예정이에요. 기획은 docs/plan-settings-panel.md에 있어요.",
    toastSaveFailed: "저장하지 못했어요: ",
    langEnglish: "English",
    langChinese: "中文",
    langKorean: "한국어",
    themeTabTitle: "테마",
    themeTabSubtitle:
      "고정된 테마가 우클릭 페르소나 서브메뉴에 표시돼요. 하나 이상은 반드시 고정되어 있어야 해요.",
    themeRefresh: "새로고침",
    themeRefreshing: "새로고침 중…",
    themeRefreshDone: "테마를 새로고침했어요.",
    themeRefreshFailed: "새로고침 실패: ",
    toastActiveLocked: "현재 활성 테마는 고정 해제할 수 없어요.",
    toastMinOneRequired: "하나 이상의 테마는 반드시 고정되어 있어야 해요.",
    toastPersonaRequired: "GitAnimals에서 이 펫을 획득하세요!",
    toastPersonaLink: "https://gitanimals.org",
    personaInfo: "잠긴 테마는 GitAnimals 펫이 필요해요.",
    personaInfoLink: "gitanimals.org에서 획득하기",
    userCardSignedIn: "로그인됨",
    userCardLoading: "계정 정보 불러오는 중…",
    userCardSignOut: "로그아웃",
    userCardSignInAgain: "다시 로그인",
    sessionExpiredToast: "세션이 만료되었습니다 — 다시 로그인해 주세요.",
  },
};

const SIDEBAR_TABS = [
  {
    id: "general",
    icon: "\u2699",
    labelKey: "sidebarGeneral",
    available: true,
  },
  { id: "agents", icon: "\u26A1", labelKey: "sidebarAgents", available: true },
  { id: "theme", icon: "\u{1F3A8}", labelKey: "sidebarTheme", available: true },
  {
    id: "animMap",
    icon: "\u{1F3AC}",
    labelKey: "sidebarAnimMap",
    available: false,
  },
  {
    id: "shortcuts",
    icon: "\u2328",
    labelKey: "sidebarShortcuts",
    available: false,
  },
  { id: "about", icon: "\u2139", labelKey: "sidebarAbout", available: false },
];

function translate(snapshot, key) {
  const lang = (snapshot && snapshot.lang) || "en";
  const dict = STRINGS[lang] || STRINGS.en;
  return dict[key] || key;
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function ToastStack({ toasts }) {
  return h(
    "div",
    { className: "toast-stack", id: "toastStack" },
    toasts.map((toast) =>
      h(
        "div",
        {
          key: toast.id,
          className: cx("toast", toast.error && "error", "visible"),
        },
        toast.message,
      ),
    ),
  );
}

function Sidebar({ activeTab, setActiveTab, t }) {
  return h(
    "nav",
    { className: "sidebar", id: "sidebar" },
    SIDEBAR_TABS.map((tab) =>
      h(
        "div",
        {
          key: tab.id,
          className: cx(
            "sidebar-item",
            !tab.available && "disabled",
            tab.id === activeTab && "active",
          ),
          onClick: tab.available ? () => setActiveTab(tab.id) : undefined,
        },
        h("span", { className: "sidebar-item-icon" }, tab.icon),
        h("span", { className: "sidebar-item-label" }, t(tab.labelKey)),
        tab.available
          ? null
          : h("span", { className: "sidebar-item-soon" }, t("sidebarSoon")),
      ),
    ),
  );
}

function Section({ title, children }) {
  return h(
    "section",
    { className: "section" },
    title ? h("h2", { className: "section-title" }, title) : null,
    h("div", { className: "section-rows" }, children),
  );
}

function SwitchControl({ on, pending, disabled, onToggle }) {
  const handleKeyDown = (event) => {
    if (disabled || pending) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onToggle();
    }
  };

  return h(
    "div",
    { className: "row-control" },
    h("div", {
      className: cx(
        "switch",
        on && "on",
        pending && "pending",
        disabled && "disabled",
      ),
      role: "switch",
      tabIndex: disabled ? -1 : 0,
      "aria-checked": on ? "true" : "false",
      onClick: disabled || pending ? undefined : onToggle,
      onKeyDown: handleKeyDown,
    }),
  );
}

function SettingRow({ label, desc, control, extraClass }) {
  return h(
    "div",
    { className: cx("row", extraClass) },
    h(
      "div",
      { className: "row-text" },
      h("span", { className: "row-label" }, label),
      desc ? h("span", { className: "row-desc" }, desc) : null,
    ),
    control,
  );
}

function UserCard({ t, userInfo, pending, onLogout, onSignInAgain }) {
  return h(
    Section,
    { title: "" },
    h(
      "div",
      { className: "row" },
      h(
        "div",
        { className: "row-text" },
        h(
          "span",
          { className: "row-label" },
          userInfo
            ? `\u{1F464} @${userInfo.username}`
            : `\u{1F464} ${t("userCardLoading")}`,
        ),
        h("span", { className: "row-desc" }, t("userCardSignedIn")),
      ),
      h(
        "div",
        { className: "row-control", style: { display: "flex", gap: "6px" } },
        h(
          "button",
          {
            className: "btn",
            type: "button",
            disabled: pending,
            onClick: onLogout,
          },
          t("userCardSignOut"),
        ),
        h(
          "button",
          {
            className: "btn",
            type: "button",
            disabled: pending,
            onClick: onSignInAgain,
          },
          t("userCardSignInAgain"),
        ),
      ),
    ),
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

function UpdateSection({ t, updateState, pending, runCommand }) {
  const status = (updateState && updateState.status) || "idle";
  const currentVersion = (updateState && updateState.currentVersion) || "0.0.0";
  const latestVersion = (updateState && updateState.latestVersion) || "";
  const lastCheckedAt = updateState && updateState.lastCheckedAt;
  const lastError = (updateState && updateState.lastError) || "";
  const isUpToDate =
    status === "idle" &&
    latestVersion &&
    String(latestVersion).replace(/^v/, "") === String(currentVersion).replace(/^v/, "");

  let statusText = t("updateStatusIdle");
  if (isUpToDate) statusText = t("updateStatusUpToDate");
  else if (status === "checking") statusText = t("updateStatusChecking");
  else if (status === "available") statusText = t("updateStatusAvailable");
  else if (status === "downloading") statusText = t("updateStatusDownloading");
  else if (status === "ready") statusText = t("updateStatusReady");
  else if (status === "error") statusText = t("updateStatusError");

  const actionButtons = [];
  actionButtons.push(
    h(
      "button",
      {
        key: "check",
        className: "btn",
        type: "button",
        disabled: !!pending.checkForUpdates || !updateState || !updateState.canCheck,
        onClick: () =>
          runCommand("checkForUpdates", () =>
            window.settingsAPI.command("checkForUpdatesFromSettings"),
          ),
      },
      t("updateCheckNow"),
    ),
  );
  if (updateState && updateState.canApplyUpdate) {
    actionButtons.push(
      h(
        "button",
        {
          key: "apply",
          className: "btn primary",
          type: "button",
          disabled: !!pending.applyUpdate,
          onClick: () =>
            runCommand("applyUpdate", () =>
              window.settingsAPI.command("applyUpdateFromSettings"),
            ),
        },
        updateState.flow === "git" ? t("updateInstallNow") : t("updateDownloadNow"),
      ),
    );
  }
  if (updateState && updateState.canRestartToUpdate) {
    actionButtons.push(
      h(
        "button",
        {
          key: "restart",
          className: "btn primary",
          type: "button",
          disabled: !!pending.restartToUpdate,
          onClick: () =>
            runCommand("restartToUpdate", () =>
              window.settingsAPI.command("restartToUpdateFromSettings"),
            ),
        },
        t("updateRestartNow"),
      ),
    );
  }

  return h(
    Section,
    { title: t("sectionUpdates") },
    h(
      "div",
      { className: "update-card" },
      h(
        "div",
        { className: "update-summary" },
        h("div", { className: cx("update-status", status) }, statusText),
        h(
          "div",
          { className: "update-meta-grid" },
          h("span", { className: "update-meta-label" }, t("updateCurrentVersion")),
          h("span", { className: "update-meta-value mono" }, `v${currentVersion}`),
          h("span", { className: "update-meta-label" }, t("updateLatestVersion")),
          h(
            "span",
            { className: "update-meta-value mono" },
            latestVersion ? `v${String(latestVersion).replace(/^v/, "")}` : "—",
          ),
          h("span", { className: "update-meta-label" }, t("updateLastChecked")),
          h(
            "span",
            { className: "update-meta-value" },
            lastCheckedAt ? formatDateTime(lastCheckedAt) : t("updateNeverChecked"),
          ),
        ),
        updateState
          ? h(
              "div",
              { className: "update-flow" },
              updateState.flow === "git" ? t("updateFlowGit") : t("updateFlowAuto"),
            )
          : null,
        lastError
          ? h("div", { className: "update-error-text" }, lastError)
          : null,
      ),
      h("div", { className: "update-actions" }, actionButtons),
    ),
  );
}

function GeneralTab({ snapshot, t, pending, runUpdate, runCommand, userInfo, updateState }) {
  const soundEnabled = !snapshot.soundMuted;

  return h(
    React.Fragment,
    null,
    h("h1", null, t("settingsTitle")),
    h("p", { className: "subtitle" }, t("settingsSubtitle")),
    h(UserCard, {
      t,
      userInfo,
      pending: !!pending.auth,
      onLogout: () =>
        runCommand("auth", () => window.settingsAPI.command("logout")),
      onSignInAgain: () =>
        runCommand("auth", () => window.settingsAPI.command("signIn")),
    }),
    h(
      Section,
      { title: t("sectionAppearance") },
      h(LanguageRow, {
        snapshot,
        t,
        pending: !!pending.lang,
        onChange: (lang) => runUpdate("lang", "lang", lang),
      }),
      h(ToggleRow, {
        label: t("rowSound"),
        desc: t("rowSoundDesc"),
        on: soundEnabled,
        pending: !!pending.soundMuted,
        onToggle: () => runUpdate("soundMuted", "soundMuted", soundEnabled),
      }),
      h(ToggleRow, {
        label: t("rowFlip"),
        desc: t("rowFlipDesc"),
        on: !!snapshot.flip,
        pending: !!pending.flip,
        onToggle: () => runUpdate("flip", "flip", !snapshot.flip),
      }),
    ),
    h(
      Section,
      { title: t("sectionStartup") },
      h(ToggleRow, {
        label: t("rowOpenAtLogin"),
        desc: t("rowOpenAtLoginDesc"),
        on: !!snapshot.openAtLogin,
        pending: !!pending.openAtLogin,
        onToggle: () =>
          runUpdate("openAtLogin", "openAtLogin", !snapshot.openAtLogin),
      }),
      h(ToggleRow, {
        label: t("rowStartWithClaude"),
        desc: t("rowStartWithClaudeDesc"),
        on: !!snapshot.autoStartWithClaude,
        pending: !!pending.autoStartWithClaude,
        onToggle: () =>
          runUpdate(
            "autoStartWithClaude",
            "autoStartWithClaude",
            !snapshot.autoStartWithClaude,
          ),
      }),
      h(ToggleRow, {
        label: t("rowAutoCheckUpdates"),
        desc: t("rowAutoCheckUpdatesDesc"),
        on: !!snapshot.autoCheckForUpdates,
        pending: !!pending.autoCheckForUpdates,
        onToggle: () =>
          runUpdate(
            "autoCheckForUpdates",
            "autoCheckForUpdates",
            !snapshot.autoCheckForUpdates,
          ),
      }),
    ),
    h(UpdateSection, { t, updateState, pending, runCommand }),
    snapshot.platform === "darwin" &&
      h(
        Section,
        { title: t("sectionMacOS") },
        h(ToggleRow, {
          label: t("rowShowInMenuBar"),
          desc: t("rowShowInMenuBarDesc"),
          on: !!snapshot.showTray,
          disabled: !!snapshot.showTray && !snapshot.showDock,
          pending: !!pending.showTray,
          onToggle: () => runUpdate("showTray", "showTray", !snapshot.showTray),
        }),
        h(ToggleRow, {
          label: t("rowShowInDock"),
          desc: t("rowShowInDockDesc"),
          on: !!snapshot.showDock,
          disabled: !!snapshot.showDock && !snapshot.showTray,
          pending: !!pending.showDock,
          onToggle: () => runUpdate("showDock", "showDock", !snapshot.showDock),
        }),
      ),
    h(
      Section,
      { title: t("sectionBubbles") },
      h(ToggleRow, {
        label: t("rowBubbleFollow"),
        desc: t("rowBubbleFollowDesc"),
        on: !!snapshot.bubbleFollowPet,
        pending: !!pending.bubbleFollowPet,
        onToggle: () =>
          runUpdate(
            "bubbleFollowPet",
            "bubbleFollowPet",
            !snapshot.bubbleFollowPet,
          ),
      }),
      h(ToggleRow, {
        label: t("rowHideBubbles"),
        desc: t("rowHideBubblesDesc"),
        on: !!snapshot.hideBubbles,
        pending: !!pending.hideBubbles,
        onToggle: () =>
          runUpdate("hideBubbles", "hideBubbles", !snapshot.hideBubbles),
      }),
      h(ToggleRow, {
        label: t("rowShowSessionId"),
        desc: t("rowShowSessionIdDesc"),
        on: !!snapshot.showSessionId,
        pending: !!pending.showSessionId,
        onToggle: () =>
          runUpdate("showSessionId", "showSessionId", !snapshot.showSessionId),
      }),
    ),
    h(
      Section,
      { title: t("sectionPrivacy") },
      h(ToggleRow, {
        label: t("rowSendDiagnostics"),
        desc: t("rowSendDiagnosticsDesc"),
        on: snapshot.sendDiagnostics !== false,
        pending: !!pending.sendDiagnostics,
        onToggle: () =>
          runUpdate(
            "sendDiagnostics",
            "sendDiagnostics",
            snapshot.sendDiagnostics === false,
          ),
      }),
    ),
  );
}

function ToggleRow({
  label,
  desc,
  on,
  pending,
  disabled,
  onToggle,
  extraClass,
}) {
  return h(SettingRow, {
    label,
    desc,
    extraClass,
    control: h(SwitchControl, { on, pending, disabled, onToggle }),
  });
}

function LanguageRow({ snapshot, t, pending, onChange }) {
  const current = snapshot.lang || "en";
  const options = [
    { value: "en", label: t("langEnglish") },
    { value: "zh", label: t("langChinese") },
    { value: "ko", label: t("langKorean") },
  ];

  return h(
    "div",
    { className: "row" },
    h(
      "div",
      { className: "row-text" },
      h("span", { className: "row-label" }, t("rowLanguage")),
      h("span", { className: "row-desc" }, t("rowLanguageDesc")),
    ),
    h(
      "div",
      { className: "row-control" },
      h(
        "div",
        { className: "segmented", role: "tablist" },
        options.map((option) =>
          h(
            "button",
            {
              key: option.value,
              className: option.value === current ? "active" : "",
              disabled: pending,
              onClick: () => {
                if (option.value !== current) onChange(option.value);
              },
            },
            option.label,
          ),
        ),
      ),
    ),
  );
}

function AgentsTab({ snapshot, t, agentMetadata, pending, runCommand }) {
  return h(
    React.Fragment,
    null,
    h("h1", null, t("agentsTitle")),
    h("p", { className: "subtitle" }, t("agentsSubtitle")),
    !agentMetadata || agentMetadata.length === 0
      ? h(
          "div",
          { className: "placeholder" },
          h("div", { className: "placeholder-desc" }, t("agentsEmpty")),
        )
      : h(
          Section,
          { title: "" },
          agentMetadata.flatMap((agent) => {
            const agentState =
              (snapshot.agents && snapshot.agents[agent.id]) || {};
            const enabled = agentState.enabled !== false;
            const permissionsEnabled = agentState.permissionsEnabled !== false;
            const rows = [
              h(ToggleRow, {
                key: `${agent.id}:enabled`,
                label: agent.name || agent.id,
                desc: h(AgentBadges, { agent, t }),
                on: enabled,
                pending: !!pending[`agent:${agent.id}:enabled`],
                onToggle: () =>
                  runCommand(`agent:${agent.id}:enabled`, () =>
                    window.settingsAPI.command("setAgentFlag", {
                      agentId: agent.id,
                      flag: "enabled",
                      value: !enabled,
                    }),
                  ),
              }),
            ];

            const caps = agent.capabilities || {};
            if (caps.permissionApproval || caps.interactiveBubble) {
              rows.push(
                h(ToggleRow, {
                  key: `${agent.id}:permissionsEnabled`,
                  label: t("rowAgentPermissions"),
                  desc: t("rowAgentPermissionsDesc"),
                  extraClass: "row-sub",
                  on: permissionsEnabled,
                  pending: !!pending[`agent:${agent.id}:permissionsEnabled`],
                  onToggle: () =>
                    runCommand(`agent:${agent.id}:permissionsEnabled`, () =>
                      window.settingsAPI.command("setAgentFlag", {
                        agentId: agent.id,
                        flag: "permissionsEnabled",
                        value: !permissionsEnabled,
                      }),
                    ),
                }),
              );
            }
            return rows;
          }),
        ),
  );
}

function AgentBadges({ agent, t }) {
  const eventSourceKey =
    agent.eventSource === "log-poll"
      ? "eventSourceLogPoll"
      : agent.eventSource === "plugin-event"
        ? "eventSourcePlugin"
        : "eventSourceHook";
  return h(
    "span",
    { className: "row-desc agent-badges" },
    h("span", { className: "agent-badge" }, t(eventSourceKey)),
    agent.capabilities && agent.capabilities.permissionApproval
      ? h(
          "span",
          { className: "agent-badge accent" },
          t("badgePermissionBubble"),
        )
      : null,
  );
}

function ThemeTab({
  snapshot,
  t,
  themeMetadata,
  themeRefreshing,
  pending,
  runCommand,
  refreshThemes,
}) {
  const hasUnowned =
    Array.isArray(themeMetadata) &&
    themeMetadata.some((th) => th.type === "persona" && !th.owned);
  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "tab-header" },
      h("h1", null, t("themeTabTitle")),
      h(
        "button",
        {
          className: "btn",
          type: "button",
          disabled: themeRefreshing,
          onClick: refreshThemes,
        },
        themeRefreshing ? t("themeRefreshing") : t("themeRefresh"),
      ),
    ),
    h("p", { className: "subtitle" }, t("themeTabSubtitle")),
    themeMetadata == null
      ? h("p", { className: "subtitle" }, "…")
      : h(
          Section,
          { title: "" },
          themeMetadata.map((theme) => {
            const pinned = !!(
              snapshot.pinnedThemes && snapshot.pinnedThemes[theme.id]
            );
            const active = snapshot.theme === theme.id;
            const pendingKey = `theme:${theme.id}`;
            const unowned = theme.type === "persona" && !theme.owned;
            return h(ToggleRow, {
              key: theme.id,
              label:
                theme.name +
                (theme.builtin ? "" : " \u2746") +
                (unowned ? " \uD83D\uDD12" : ""),
              desc: null,
              on: pinned,
              disabled: active || unowned,
              pending: !!pending[pendingKey],
              onToggle: () =>
                runCommand(pendingKey, async () => {
                  const result = await window.settingsAPI.command(
                    "togglePinnedTheme",
                    { themeId: theme.id },
                  );
                  if (result && result.status === "active-locked") {
                    return { status: "error", message: t("toastActiveLocked") };
                  }
                  if (result && result.status === "min-one-required") {
                    return {
                      status: "error",
                      message: t("toastMinOneRequired"),
                    };
                  }
                  return result;
                }),
            });
          }),
        ),
    hasUnowned
      ? h(
          "div",
          {
            className: "info-bar",
            style: {
              marginTop: "12px",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            },
          },
          h("span", null, "\uD83D\uDD12"),
          h("span", null, t("personaInfo")),
          h(
            "a",
            {
              href: "#",
              style: {
                color: "#7eb8ff",
                textDecoration: "underline",
                cursor: "pointer",
                marginLeft: "4px",
                textAlign: "left",
              },
              onClick: (e) => {
                e.preventDefault();
                window.settingsAPI.openExternal(t("toastPersonaLink"));
              },
            },
            t("personaInfoLink"),
          ),
        )
      : null,
  );
}

function PlaceholderTab({ t }) {
  return h(
    "div",
    { className: "placeholder" },
    h("div", { className: "placeholder-icon" }, "\u{1F6E0}"),
    h("div", { className: "placeholder-title" }, t("placeholderTitle")),
    h("div", { className: "placeholder-desc" }, t("placeholderDesc")),
  );
}

function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [updateState, setUpdateState] = useState(null);
  const [activeTab, setActiveTab] = useState("general");
  const [agentMetadata, setAgentMetadata] = useState([]);
  const [themeMetadata, setThemeMetadata] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [themeRefreshing, setThemeRefreshing] = useState(false);
  const [pending, setPending] = useState({});
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef(new Map());
  const pendingRef = useRef({});
  const snapshotRef = useRef(null);

  const t = (key) => translate(snapshot || {}, key);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  function pushToast(message, options = {}) {
    const id = `${Date.now()}:${Math.random()}`;
    setToasts((current) =>
      current.concat([{ id, message, error: !!options.error }]),
    );
    const timer = setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      toastTimers.current.delete(id);
    }, options.ttl || 3500);
    toastTimers.current.set(id, timer);
  }

  function withPending(key, work) {
    if (pendingRef.current[key]) return Promise.resolve();
    setPending((current) => ({ ...current, [key]: true }));
    return Promise.resolve()
      .then(work)
      .then((result) => {
        if (!result || result.status !== "ok") {
          const message = (result && result.message) || "unknown error";
          pushToast(t("toastSaveFailed") + message, { error: true });
        }
        return result;
      })
      .catch((err) => {
        pushToast(t("toastSaveFailed") + (err && err.message), { error: true });
        return null;
      })
      .finally(() => {
        setPending((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      });
  }

  function runUpdate(pendingKey, key, value) {
    return withPending(pendingKey, () => window.settingsAPI.update(key, value));
  }

  function runCommand(pendingKey, work) {
    return withPending(pendingKey, work);
  }

  function refreshThemes() {
    if (themeRefreshing) return;
    setThemeRefreshing(true);
    window.settingsAPI
      .command("refreshThemes")
      .then((result) => {
        if (!result || result.status !== "ok") {
          pushToast(
            t("themeRefreshFailed") +
              ((result && result.message) || result.status || "unknown error"),
            { error: true },
          );
          return null;
        }
        pushToast(t("themeRefreshDone"));
        return window.settingsAPI.listThemes();
      })
      .then((list) => {
        if (Array.isArray(list)) setThemeMetadata(list);
      })
      .catch((err) => {
        pushToast(t("themeRefreshFailed") + (err && err.message), {
          error: true,
        });
      })
      .finally(() => {
        setThemeRefreshing(false);
      });
  }

  useEffect(() => {
    let mounted = true;

    window.settingsAPI.getSnapshot().then((nextSnapshot) => {
      if (mounted) setSnapshot(nextSnapshot || {});
    });
    window.settingsAPI.getUpdateState().then((nextUpdateState) => {
      if (mounted) setUpdateState(nextUpdateState || null);
    });

    window.settingsAPI
      .listAgents()
      .then((list) => {
        if (mounted) setAgentMetadata(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.warn("settings: listAgents failed", err);
        if (mounted) setAgentMetadata([]);
      });

    window.settingsAPI
      .listThemes()
      .then((list) => {
        if (mounted) setThemeMetadata(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.warn("settings: listThemes failed", err);
        if (mounted) setThemeMetadata([]);
      });

    window.settingsAPI
      .getUser()
      .then((user) => {
        if (mounted) setUserInfo(user && user.username ? user : null);
      })
      .catch(() => {
        if (mounted) setUserInfo(null);
      });

    const offChanged = window.settingsAPI.onChanged((payload) => {
      setSnapshot((current) => {
        if (payload && payload.snapshot) return payload.snapshot;
        if (payload && payload.changes && current)
          return { ...current, ...payload.changes };
        return current;
      });
    });
    const offUpdateState = window.settingsAPI.onUpdateStateChanged((nextUpdateState) => {
      if (mounted) setUpdateState(nextUpdateState || null);
    });

    const offTab = window.settingsAPI.onSetTab((tab) => {
      const next = SIDEBAR_TABS.find(
        (entry) => entry.id === tab && entry.available,
      );
      if (next) setActiveTab(next.id);
    });

    const offExpired = window.settingsAPI.onSessionExpired(() => {
      pushToast(translate(snapshotRef.current || {}, "sessionExpiredToast"), {
        error: true,
        ttl: 8000,
      });
    });

    return () => {
      mounted = false;
      offChanged();
      offUpdateState();
      offTab();
      offExpired();
      for (const timer of toastTimers.current.values()) clearTimeout(timer);
      toastTimers.current.clear();
    };
  }, []);

  const content = useMemo(() => {
    const safeSnapshot = snapshot || {};
    if (activeTab === "general") {
      return h(GeneralTab, {
        snapshot: safeSnapshot,
        t,
        pending,
        runUpdate,
        runCommand,
        userInfo,
        updateState,
      });
    }
    if (activeTab === "agents") {
      return h(AgentsTab, {
        snapshot: safeSnapshot,
        t,
        agentMetadata,
        pending,
        runCommand,
      });
    }
    if (activeTab === "theme") {
      return h(ThemeTab, {
        snapshot: safeSnapshot,
        t,
        themeMetadata,
        themeRefreshing,
        pending,
        runCommand,
        refreshThemes,
      });
    }
    return h(PlaceholderTab, { t });
  }, [
    activeTab,
    agentMetadata,
    pending,
    snapshot,
    themeMetadata,
    themeRefreshing,
    userInfo,
    updateState,
  ]);

  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "app" },
      h(Sidebar, { activeTab, setActiveTab, t }),
      h("main", { className: "content", id: "content" }, content),
    ),
    h(ToastStack, { toasts }),
  );
}

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot
  ? ReactDOM.createRoot(rootElement)
  : { render: (node) => ReactDOM.render(node, rootElement) };

root.render(h(App));
