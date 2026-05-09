const React = window.React;
const ReactDOM = window.ReactDOM;
if (!React || !ReactDOM) {
    throw new Error("Settings renderer requires React and ReactDOM globals");
}
const useState = React.useState;
const useRef = React.useRef;
const useEffect = React.useEffect;
const useMemo = React.useMemo;
const h = React.createElement;
export { React, ReactDOM, h, useEffect, useMemo, useRef, useState };
