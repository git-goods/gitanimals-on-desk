import type { SettingsAPI } from "./types";

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare global {
  interface Window {
    React: any;
    ReactDOM: any;
    settingsAPI: SettingsAPI;
  }
}

export {};
