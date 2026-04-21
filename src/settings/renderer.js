"use strict";

// ── Settings panel renderer ──
//
// Strict unidirectional flow (plan §4.2):
//
//   1. UI clicks → settingsAPI.update(key, value) → main → controller
//   2. Controller commits → broadcasts settings-changed
//   3. settingsAPI.onChanged fires → renderUI() rebuilds the affected row(s)
//
// We never optimistically toggle a switch in the click handler. The visual
// state always reflects what the store says — period. Failures show a toast
// and the switch stays in its previous position because the store was never
// committed.

// ── i18n (mirror src/i18n.js — bubbles can't require electron modules) ──
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
    agentsSubtitle: "Turn tracking on or off per agent. Disabled agents stop log monitors and drop hook events at the HTTP boundary — they won't drive the pet, show permission bubbles, or keep sessions.",
    agentsEmpty: "No agents registered.",
    eventSourceHook: "Hook",
    eventSourceLogPoll: "Log poll",
    eventSourcePlugin: "Plugin",
    badgePermissionBubble: "Permission bubble",
    rowAgentPermissions: "Show pop-up bubbles",
    rowAgentPermissionsDesc: "Turn off to let this agent handle prompts in its own terminal instead of showing a permission bubble.",
    rowLanguage: "Language",
    rowLanguageDesc: "Interface language for menus and bubbles.",
    rowSound: "Sound effects",
    rowSoundDesc: "Play a chime when GitAnimals finishes a task or asks for input.",
    rowOpenAtLogin: "Open at login",
    rowOpenAtLoginDesc: "Start GitAnimals automatically when you log in.",
    rowStartWithClaude: "Start with Claude Code",
    rowStartWithClaudeDesc: "Auto-launch GitAnimals whenever a Claude Code session starts.",
    rowBubbleFollow: "Bubbles follow the pet",
    rowBubbleFollowDesc: "Place permission and update bubbles next to the pet instead of the screen corner.",
    rowHideBubbles: "Hide all bubbles",
    rowHideBubblesDesc: "Suppress permission, notification, and update bubbles entirely.",
    rowShowSessionId: "Show session ID",
    rowShowSessionIdDesc: "Append the short session ID to bubble headers and the Sessions menu.",
    sectionPrivacy: "Privacy",
    rowSendDiagnostics: "Send anonymous diagnostics",
    rowSendDiagnosticsDesc: "Share crash reports and anonymised event breadcrumbs so the maintainers can diagnose issues like the pet disappearing. No personal data.",
    placeholderTitle: "Coming soon",
    placeholderDesc: "This panel will land in a future GitAnimals release. The plan lives in docs/plan-settings-panel.md.",
    toastSaveFailed: "Couldn't save: ",
    langEnglish: "English",
    langChinese: "中文",
    themeTabTitle: "Theme",
    themeTabSubtitle: "Pinned themes appear in the right-click Persona submenu. At least one must stay pinned.",
    themeColPin: "Pin",
    themeRefresh: "Refresh",
    themeRefreshing: "Refreshing…",
    themeRefreshDone: "Themes refreshed.",
    themeRefreshFailed: "Refresh failed: ",
    toastActiveLocked: "Cannot unpin the active theme.",
    toastMinOneRequired: "At least one theme must remain pinned.",
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
    agentsSubtitle: "按 agent 类型开关追踪。关闭后会停掉日志监视器、在 HTTP 入口丢弃 hook 事件——不会再驱动桌宠、不弹权限气泡、不记会话。",
    agentsEmpty: "没有已注册的 agent。",
    eventSourceHook: "Hook",
    eventSourceLogPoll: "日志轮询",
    eventSourcePlugin: "插件",
    badgePermissionBubble: "权限气泡",
    rowAgentPermissions: "显示弹窗",
    rowAgentPermissionsDesc: "关闭后让该 agent 在自己的终端里处理提示，不再弹 权限气泡。",
    rowLanguage: "语言",
    rowLanguageDesc: "菜单和气泡的界面语言。",
    rowSound: "音效",
    rowSoundDesc: "GitAnimals 完成任务或需要输入时播放提示音。",
    rowOpenAtLogin: "开机自启",
    rowOpenAtLoginDesc: "登录系统时自动启动 GitAnimals。",
    rowStartWithClaude: "随 Claude Code 启动",
    rowStartWithClaudeDesc: "Claude Code 会话开始时自动拉起 GitAnimals。",
    rowBubbleFollow: "气泡跟随桌宠",
    rowBubbleFollowDesc: "把权限气泡和更新气泡放在桌宠旁边，而不是屏幕角落。",
    rowHideBubbles: "隐藏所有气泡",
    rowHideBubblesDesc: "完全屏蔽权限、通知和更新气泡。",
    rowShowSessionId: "显示会话 ID",
    rowShowSessionIdDesc: "在气泡标题和会话菜单后追加短会话 ID。",
    sectionPrivacy: "隐私",
    rowSendDiagnostics: "发送匿名诊断数据",
    rowSendDiagnosticsDesc: "共享崩溃报告和匿名化事件面包屑，帮助维护者诊断诸如桌宠消失之类的问题。不包含任何个人信息。",
    placeholderTitle: "即将推出",
    placeholderDesc: "此面板将在 GitAnimals 后续版本中加入，规划见 docs/plan-settings-panel.md。",
    toastSaveFailed: "保存失败：",
    langEnglish: "English",
    langChinese: "中文",
    themeTabTitle: "主题",
    themeTabSubtitle: "已固定的主题会出现在右键菜单的「角色」子菜单中。至少保留一个固定主题。",
    themeColPin: "固定",
    themeRefresh: "刷新",
    themeRefreshing: "刷新中…",
    themeRefreshDone: "主题已刷新。",
    themeRefreshFailed: "刷新失败：",
    toastActiveLocked: "无法取消固定当前使用的主题。",
    toastMinOneRequired: "至少需要保留一个固定主题。",
  },
};

let snapshot = null;
let activeTab = "general";
let agentMetadata = null;
let themeMetadata = null;

function t(key) {
  const lang = (snapshot && snapshot.lang) || "en";
  const dict = STRINGS[lang] || STRINGS.en;
  return dict[key] || key;
}

// ── Toast ──
const toastStack = document.getElementById("toastStack");
function showToast(message, { error = false, ttl = 3500 } = {}) {
  const node = document.createElement("div");
  node.className = "toast" + (error ? " error" : "");
  node.textContent = message;
  toastStack.appendChild(node);
  // Force reflow then add visible class so the transition runs.
  // eslint-disable-next-line no-unused-expressions
  node.offsetHeight;
  node.classList.add("visible");
  setTimeout(() => {
    node.classList.remove("visible");
    setTimeout(() => node.remove(), 240);
  }, ttl);
}

// ── Sidebar ──
const SIDEBAR_TABS = [
  { id: "general", icon: "\u2699", labelKey: "sidebarGeneral", available: true },
  { id: "agents", icon: "\u26A1", labelKey: "sidebarAgents", available: true },
  { id: "theme", icon: "\u{1F3A8}", labelKey: "sidebarTheme", available: true },
  { id: "animMap", icon: "\u{1F3AC}", labelKey: "sidebarAnimMap", available: false },
  { id: "shortcuts", icon: "\u2328", labelKey: "sidebarShortcuts", available: false },
  { id: "about", icon: "\u2139", labelKey: "sidebarAbout", available: false },
];

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "";
  for (const tab of SIDEBAR_TABS) {
    const item = document.createElement("div");
    item.className = "sidebar-item";
    if (!tab.available) item.classList.add("disabled");
    if (tab.id === activeTab) item.classList.add("active");
    item.innerHTML =
      `<span class="sidebar-item-icon">${tab.icon}</span>` +
      `<span class="sidebar-item-label">${escapeHtml(t(tab.labelKey))}</span>` +
      (tab.available ? "" : `<span class="sidebar-item-soon">${escapeHtml(t("sidebarSoon"))}</span>`);
    if (tab.available) {
      item.addEventListener("click", () => {
        activeTab = tab.id;
        renderSidebar();
        renderContent();
      });
    }
    sidebar.appendChild(item);
  }
}

// ── Content ──
function renderContent() {
  const content = document.getElementById("content");
  content.innerHTML = "";
  if (activeTab === "general") {
    renderGeneralTab(content);
  } else if (activeTab === "agents") {
    renderAgentsTab(content);
  } else if (activeTab === "theme") {
    renderThemeTab(content);
  } else {
    renderPlaceholder(content);
  }
}

function renderAgentsTab(parent) {
  const h1 = document.createElement("h1");
  h1.textContent = t("agentsTitle");
  parent.appendChild(h1);

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = t("agentsSubtitle");
  parent.appendChild(subtitle);

  if (!agentMetadata || agentMetadata.length === 0) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.innerHTML = `<div class="placeholder-desc">${escapeHtml(t("agentsEmpty"))}</div>`;
    parent.appendChild(empty);
    return;
  }

  const rows = agentMetadata.flatMap((agent) => buildAgentRows(agent));
  parent.appendChild(buildSection("", rows));
}

function buildAgentRows(agent) {
  const rows = [
    buildAgentSwitchRow({
      agent,
      flag: "enabled",
      extraClass: null,
      buildText: (text) => {
        const label = document.createElement("span");
        label.className = "row-label";
        label.textContent = agent.name || agent.id;
        text.appendChild(label);
        const badges = document.createElement("span");
        badges.className = "row-desc agent-badges";
        const esKey = agent.eventSource === "log-poll" ? "eventSourceLogPoll"
          : agent.eventSource === "plugin-event" ? "eventSourcePlugin"
          : "eventSourceHook";
        const esBadge = document.createElement("span");
        esBadge.className = "agent-badge";
        esBadge.textContent = t(esKey);
        badges.appendChild(esBadge);
        if (agent.capabilities && agent.capabilities.permissionApproval) {
          const permBadge = document.createElement("span");
          permBadge.className = "agent-badge accent";
          permBadge.textContent = t("badgePermissionBubble");
          badges.appendChild(permBadge);
        }
        text.appendChild(badges);
      },
    }),
  ];
  const caps = agent.capabilities || {};
  if (caps.permissionApproval || caps.interactiveBubble) {
    rows.push(buildAgentSwitchRow({
      agent,
      flag: "permissionsEnabled",
      extraClass: "row-sub",
      buildText: (text) => {
        const label = document.createElement("span");
        label.className = "row-label";
        label.textContent = t("rowAgentPermissions");
        text.appendChild(label);
        const desc = document.createElement("span");
        desc.className = "row-desc";
        desc.textContent = t("rowAgentPermissionsDesc");
        text.appendChild(desc);
      },
    }));
  }
  return rows;
}

function buildAgentSwitchRow({ agent, flag, extraClass, buildText }) {
  const row = document.createElement("div");
  row.className = extraClass ? `row ${extraClass}` : "row";

  const text = document.createElement("div");
  text.className = "row-text";
  buildText(text);
  row.appendChild(text);

  const ctrl = document.createElement("div");
  ctrl.className = "row-control";
  const sw = document.createElement("div");
  sw.className = "switch";
  sw.setAttribute("role", "switch");
  sw.setAttribute("tabindex", "0");
  const readFlag = () => {
    const entry = snapshot && snapshot.agents && snapshot.agents[agent.id];
    return entry ? entry[flag] !== false : true;
  };
  const on = readFlag();
  if (on) sw.classList.add("on");
  sw.setAttribute("aria-checked", on ? "true" : "false");
  attachSwitchToggle(sw, () =>
    window.settingsAPI.command("setAgentFlag", {
      agentId: agent.id,
      flag,
      value: !readFlag(),
    })
  );
  ctrl.appendChild(sw);
  row.appendChild(ctrl);
  return row;
}

let _themeRefreshing = false;

function renderThemeTab(parent) {
  const header = document.createElement("div");
  header.className = "tab-header";
  const h1 = document.createElement("h1");
  h1.textContent = t("themeTabTitle");
  header.appendChild(h1);

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "btn";
  refreshBtn.type = "button";
  refreshBtn.textContent = _themeRefreshing ? t("themeRefreshing") : t("themeRefresh");
  refreshBtn.disabled = _themeRefreshing;
  refreshBtn.addEventListener("click", () => _handleThemeRefresh());
  header.appendChild(refreshBtn);
  parent.appendChild(header);

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = t("themeTabSubtitle");
  parent.appendChild(subtitle);

  if (!themeMetadata) {
    const loading = document.createElement("p");
    loading.className = "subtitle";
    loading.textContent = "…";
    parent.appendChild(loading);
    return;
  }

  const activeId = snapshot && snapshot.theme;
  const pinned = (snapshot && snapshot.pinnedThemes) || {};
  const rows = themeMetadata.map(theme => buildThemePinRow(theme, activeId, pinned));
  parent.appendChild(buildSection("", rows));
}

async function _handleThemeRefresh() {
  if (_themeRefreshing) return;
  _themeRefreshing = true;
  if (activeTab === "theme") renderContent();
  try {
    const result = await window.settingsAPI.command("refreshThemes");
    if (result && result.status !== "ok") {
      showToast(t("themeRefreshFailed") + (result.message || result.status), { error: true });
    } else {
      showToast(t("themeRefreshDone"));
    }
    if (typeof window.settingsAPI.listThemes === "function") {
      try {
        const list = await window.settingsAPI.listThemes();
        themeMetadata = Array.isArray(list) ? list : [];
      } catch (e) { console.warn("settings: listThemes failed", e); }
    }
  } catch (err) {
    showToast(t("themeRefreshFailed") + (err && err.message), { error: true });
  } finally {
    _themeRefreshing = false;
    if (activeTab === "theme") renderContent();
  }
}

function buildThemePinRow(theme, activeId, pinned) {
  const row = document.createElement("div");
  row.className = "row";

  const text = document.createElement("div");
  text.className = "row-text";
  const label = document.createElement("span");
  label.className = "row-label";
  label.textContent = theme.name + (theme.builtin ? "" : " \u2746");
  text.appendChild(label);
  row.appendChild(text);

  const ctrl = document.createElement("div");
  ctrl.className = "row-control";
  const sw = document.createElement("div");
  sw.className = "switch";
  sw.setAttribute("role", "switch");
  const isActive = theme.id === activeId;
  const isPinned = pinned[theme.id] === true;
  if (isPinned) sw.classList.add("on");
  sw.setAttribute("aria-checked", isPinned ? "true" : "false");

  if (isActive) {
    sw.classList.add("disabled");
    sw.setAttribute("tabindex", "-1");
    sw.title = t("toastActiveLocked");
  } else {
    sw.setAttribute("tabindex", "0");
    attachSwitchToggle(sw, async () => {
      const result = await window.settingsAPI.command("togglePinnedTheme", { themeId: theme.id });
      if (result && result.status === "active-locked") {
        return { status: "error", message: t("toastActiveLocked") };
      }
      if (result && result.status === "min-one-required") {
        return { status: "error", message: t("toastMinOneRequired") };
      }
      return result;
    });
  }

  ctrl.appendChild(sw);
  row.appendChild(ctrl);
  return row;
}

function renderPlaceholder(parent) {
  const div = document.createElement("div");
  div.className = "placeholder";
  div.innerHTML =
    `<div class="placeholder-icon">\u{1F6E0}</div>` +
    `<div class="placeholder-title">${escapeHtml(t("placeholderTitle"))}</div>` +
    `<div class="placeholder-desc">${escapeHtml(t("placeholderDesc"))}</div>`;
  parent.appendChild(div);
}

function renderGeneralTab(parent) {
  const h1 = document.createElement("h1");
  h1.textContent = t("settingsTitle");
  parent.appendChild(h1);

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = t("settingsSubtitle");
  parent.appendChild(subtitle);

  // Section: Appearance
  parent.appendChild(buildSection(t("sectionAppearance"), [
    buildLanguageRow(),
    buildSwitchRow({
      key: "soundMuted",
      labelKey: "rowSound",
      descKey: "rowSoundDesc",
      // soundMuted is inverse: ON-switch means sound enabled.
      invert: true,
    }),
  ]));

  // Section: Startup
  parent.appendChild(buildSection(t("sectionStartup"), [
    buildSwitchRow({
      key: "openAtLogin",
      labelKey: "rowOpenAtLogin",
      descKey: "rowOpenAtLoginDesc",
    }),
    buildSwitchRow({
      key: "autoStartWithClaude",
      labelKey: "rowStartWithClaude",
      descKey: "rowStartWithClaudeDesc",
    }),
  ]));

  // Section: Bubbles
  parent.appendChild(buildSection(t("sectionBubbles"), [
    buildSwitchRow({
      key: "bubbleFollowPet",
      labelKey: "rowBubbleFollow",
      descKey: "rowBubbleFollowDesc",
    }),
    buildSwitchRow({
      key: "hideBubbles",
      labelKey: "rowHideBubbles",
      descKey: "rowHideBubblesDesc",
    }),
    buildSwitchRow({
      key: "showSessionId",
      labelKey: "rowShowSessionId",
      descKey: "rowShowSessionIdDesc",
    }),
  ]));

  // Section: Privacy — diagnostic telemetry opt-out.
  parent.appendChild(buildSection(t("sectionPrivacy"), [
    buildSwitchRow({
      key: "sendDiagnostics",
      labelKey: "rowSendDiagnostics",
      descKey: "rowSendDiagnosticsDesc",
    }),
  ]));
}

function buildSection(title, rows) {
  const section = document.createElement("section");
  section.className = "section";
  if (title) {
    const heading = document.createElement("h2");
    heading.className = "section-title";
    heading.textContent = title;
    section.appendChild(heading);
  }
  const wrap = document.createElement("div");
  wrap.className = "section-rows";
  for (const row of rows) wrap.appendChild(row);
  section.appendChild(wrap);
  return section;
}

// Wire click + Space/Enter keydown on a `.switch` to an async invoker that
// returns a `Promise<{status, message?}>`. Handles pending state, error
// toasts, and keyboard activation identically across all rows — so
// `buildSwitchRow` (pure prefs) and `buildAgentRow` (command-backed) share
// a single toggle behavior.
function attachSwitchToggle(sw, invoke) {
  const run = () => {
    if (sw.classList.contains("pending")) return;
    sw.classList.add("pending");
    Promise.resolve()
      .then(invoke)
      .then((result) => {
        sw.classList.remove("pending");
        if (!result || result.status !== "ok") {
          const msg = (result && result.message) || "unknown error";
          showToast(t("toastSaveFailed") + msg, { error: true });
        }
      })
      .catch((err) => {
        sw.classList.remove("pending");
        showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      });
  };
  sw.addEventListener("click", run);
  sw.addEventListener("keydown", (ev) => {
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      run();
    }
  });
}

function buildSwitchRow({ key, labelKey, descKey, invert = false }) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML =
    `<div class="row-text">` +
      `<span class="row-label"></span>` +
      `<span class="row-desc"></span>` +
    `</div>` +
    `<div class="row-control"><div class="switch" role="switch" tabindex="0"></div></div>`;
  row.querySelector(".row-label").textContent = t(labelKey);
  row.querySelector(".row-desc").textContent = t(descKey);
  const sw = row.querySelector(".switch");
  const rawValue = !!(snapshot && snapshot[key]);
  const visualOn = invert ? !rawValue : rawValue;
  if (visualOn) sw.classList.add("on");
  sw.setAttribute("aria-checked", visualOn ? "true" : "false");
  // No optimistic update — visual state flips on broadcast, not on click.
  // If the action fails, the broadcast never fires and the switch stays.
  attachSwitchToggle(sw, () => {
    const currentRaw = !!(snapshot && snapshot[key]);
    const currentVisual = invert ? !currentRaw : currentRaw;
    const nextRaw = invert ? currentVisual : !currentVisual;
    return window.settingsAPI.update(key, nextRaw);
  });
  return row;
}

function buildLanguageRow() {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML =
    `<div class="row-text">` +
      `<span class="row-label"></span>` +
      `<span class="row-desc"></span>` +
    `</div>` +
    `<div class="row-control">` +
      `<div class="segmented" role="tablist">` +
        `<button data-lang="en"></button>` +
        `<button data-lang="zh"></button>` +
      `</div>` +
    `</div>`;
  row.querySelector(".row-label").textContent = t("rowLanguage");
  row.querySelector(".row-desc").textContent = t("rowLanguageDesc");
  const buttons = row.querySelectorAll(".segmented button");
  buttons[0].textContent = t("langEnglish");
  buttons[1].textContent = t("langChinese");
  const current = (snapshot && snapshot.lang) || "en";
  for (const btn of buttons) {
    if (btn.dataset.lang === current) btn.classList.add("active");
    btn.addEventListener("click", () => {
      const next = btn.dataset.lang;
      if (next === ((snapshot && snapshot.lang) || "en")) return;
      window.settingsAPI.update("lang", next).then((result) => {
        if (!result || result.status !== "ok") {
          const msg = (result && result.message) || "unknown error";
          showToast(t("toastSaveFailed") + msg, { error: true });
        }
      }).catch((err) => {
        showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      });
    });
  }
  return row;
}

// ── Boot ──
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

window.settingsAPI.onChanged((payload) => {
  if (payload && payload.snapshot) {
    snapshot = payload.snapshot;
  } else if (payload && payload.changes && snapshot) {
    snapshot = { ...snapshot, ...payload.changes };
  }
  // Guard against an early broadcast that lands before `getSnapshot()`
  // resolves — rendering with a null snapshot blanks the UI and the
  // initial render later would need to re-fetch static language state.
  if (!snapshot) return;
  renderSidebar();
  renderContent();
});

window.settingsAPI.getSnapshot().then((snap) => {
  snapshot = snap || {};
  renderSidebar();
  renderContent();
});

if (typeof window.settingsAPI.listAgents === "function") {
  window.settingsAPI
    .listAgents()
    .then((list) => {
      agentMetadata = Array.isArray(list) ? list : [];
      if (activeTab === "agents") renderContent();
    })
    .catch((err) => {
      console.warn("settings: listAgents failed", err);
      agentMetadata = [];
    });
}

if (typeof window.settingsAPI.listThemes === "function") {
  window.settingsAPI
    .listThemes()
    .then((list) => {
      themeMetadata = Array.isArray(list) ? list : [];
      if (activeTab === "theme") renderContent();
    })
    .catch((err) => {
      console.warn("settings: listThemes failed", err);
      themeMetadata = [];
    });
}
