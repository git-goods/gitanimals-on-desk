export interface ThemeListItem {
  id: string;
  name: string;
  builtin: boolean;
  source?: string;
}

export type AnchorDef = {
  parentId: string;
  transform?: string;
} | null;

export interface AccessoryDef {
  name: string;
  file: string;
  anchors: Record<string, AnchorDef>;
}

export interface MiniMode {
  supported: boolean;
  states: Record<string, string[]>;
  timings?: any;
  flipAssets?: boolean;
  offsetRatio?: number;
}

export interface ThemeConfig {
  viewBox: { x: number; y: number; width: number; height: number };
  layout?: any;
  assetsPath: string;
  sourceAssetsPath?: string;
  eyeTracking?: any;
  objectScale?: {
    widthRatio: number;
    heightRatio: number;
    offsetX: number;
    offsetY: number;
    objBottom?: number;
  };
  states: Record<string, string[]>;
  miniMode?: MiniMode;
  accessories: Record<string, AccessoryDef>;
  activeAccessories: string[];
  transitions?: any;
  error?: string;
}

export interface LayoutOverrides {
  baselineY: number;
  visibleHeightRatio: number;
  baselineBottomRatio: number;
  centerX: number;
}

export const MAIN_STATES = [
  "idle", "thinking", "working", "juggling", "carrying", "sweeping",
  "attention", "notification", "error",
  "sleeping", "idle-look", "yawning", "dozing", "collapsing", "waking",
] as const;
