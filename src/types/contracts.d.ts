export type AgentId =
  | "claude-code"
  | "codex"
  | "copilot-cli"
  | "cursor-agent"
  | "gemini-cli"
  | "codebuddy"
  | "kiro-cli"
  | "opencode";

export type AgentEventSource = "hook" | "log-poll" | "plugin";

export type PetState =
  | "idle"
  | "thinking"
  | "working"
  | "attention"
  | "notification"
  | "error"
  | "sweeping"
  | "carrying"
  | "juggling"
  | "conducting"
  | "building"
  | "sleeping"
  | "dozing"
  | "collapsing"
  | "waking"
  | "yawning"
  | "mini-idle"
  | "mini-peek"
  | "mini-alert"
  | "mini-happy"
  | "mini-sleep"
  | "codex-permission"
  | "checking"
  | "downloading";

export interface AgentFlags {
  enabled: boolean;
  permissionsEnabled: boolean;
}

export interface ThemeOverrideEntry {
  sourceThemeId: string;
  file: string;
}

export interface SettingsSnapshot {
  version: number;
  x: number;
  y: number;
  positionSaved: boolean;
  size: string;
  miniMode: boolean;
  miniEdge: "left" | "right";
  preMiniX: number;
  preMiniY: number;
  lang: "en" | "zh" | "ko";
  showTray: boolean;
  showDock: boolean;
  autoStartWithClaude: boolean;
  openAtLogin: boolean;
  openAtLoginHydrated: boolean;
  bubbleFollowPet: boolean;
  hideBubbles: boolean;
  showSessionId: boolean;
  soundMuted: boolean;
  sendDiagnostics: boolean;
  theme: string;
  agents: Record<string, Partial<AgentFlags>>;
  themeOverrides: Record<string, Record<string, ThemeOverrideEntry>>;
  pinnedThemes: Record<string, true>;
}

export interface AgentDefinition {
  id: AgentId | string;
  name: string;
  processNames: {
    win: string[];
    mac: string[];
    linux?: string[];
  };
  eventSource: AgentEventSource | string;
  eventMap?: Record<string, PetState | string | null>;
  logEventMap?: Record<string, PetState | string | null>;
  capabilities: {
    httpHook: boolean;
    permissionApproval: boolean;
    sessionEnd: boolean;
    subagent: boolean;
    interactiveBubble?: boolean;
  };
  hookConfig?: Record<string, unknown>;
  logConfig?: Record<string, unknown>;
  stdinFormat?: string;
  pidField?: string;
}

export interface ThemeHitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ThemeManifest {
  name?: string;
  states: Record<string, string[]>;
  timings: {
    minDisplay: Record<string, number>;
    autoReturn: Record<string, number>;
    yawnDuration: number;
    wakeDuration: number;
    deepSleepTimeout: number;
    mouseIdleTimeout?: number;
    mouseSleepTimeout?: number;
    dndSkipYawn?: boolean;
    collapseDuration?: number;
  };
  hitBoxes: {
    default: ThemeHitBox;
    sleeping: ThemeHitBox;
    wide: ThemeHitBox;
  };
  sounds?: Record<string, string>;
  displayHintMap?: Record<string, string>;
  wideHitboxFiles?: string[];
  sleepingHitboxFiles?: string[];
  miniMode?: {
    states?: Record<string, string[]>;
  };
}

export interface HookStatePayload {
  state: PetState | string;
  session_id?: string;
  event?: string;
  svg?: string;
  display_svg?: string | null;
  source_pid?: number | null;
  cwd?: string;
  editor?: string | null;
  pid_chain?: number[] | null;
  agent_pid?: number | null;
  agent_id?: AgentId | string;
  host?: string | null;
  headless?: boolean;
}

export interface PermissionRequestPayload {
  session_id?: string;
  agent_id?: AgentId | string;
  tool_name: string;
  tool_input?: unknown;
  permission_suggestions?: string[];
  request_id?: string;
  bridge_url?: string;
}

export interface SessionRecord {
  state: PetState | string;
  updatedAt: number;
  sourcePid?: number | null;
  cwd?: string;
  editor?: string | null;
  pidChain?: number[] | null;
  agentPid?: number | null;
  agentId?: AgentId | string;
  host?: string | null;
  headless?: boolean;
  displayHint?: string | null;
}
