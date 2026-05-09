const React = window.React;
const ReactDOM = window.ReactDOM;

if (!React || !ReactDOM) {
  throw new Error("Settings renderer requires React and ReactDOM globals");
}

type SetStateAction<T> = T | ((prev: T) => T);
type Dispatch<T> = (action: SetStateAction<T>) => void;

type UseStateFn = <T>(
  initial: T | (() => T),
) => [T, Dispatch<T>];

type UseRefFn = <T>(initial: T) => { current: T };

type UseEffectFn = (
  effect: () => void | (() => void),
  deps?: ReadonlyArray<unknown>,
) => void;

type UseMemoFn = <T>(
  factory: () => T,
  deps?: ReadonlyArray<unknown>,
) => T;

const useState = React.useState as UseStateFn;
const useRef = React.useRef as UseRefFn;
const useEffect = React.useEffect as UseEffectFn;
const useMemo = React.useMemo as UseMemoFn;
const h = React.createElement;

export { React, ReactDOM, h, useEffect, useMemo, useRef, useState };
