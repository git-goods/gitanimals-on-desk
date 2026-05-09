declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

interface Window {
  React: any;
  ReactDOM: any;
  settingsAPI: any;
}
