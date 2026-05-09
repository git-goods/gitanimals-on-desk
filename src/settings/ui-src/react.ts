const React = window.React;
const ReactDOM = window.ReactDOM;

if (!React || !ReactDOM) {
  throw new Error("Settings renderer requires React and ReactDOM globals");
}

const { useEffect, useMemo, useRef, useState } = React;
const h = React.createElement;

export { React, ReactDOM, h, useEffect, useMemo, useRef, useState };
