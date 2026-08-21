import { useSyncExternalStore } from "react";

/**
 * Minimal external store: keeps high-frequency visual/gesture state out of
 * React render cycles unless a component explicitly subscribes.
 */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();

  const get = () => state;

  const set = (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
    const next = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useStore = <S,>(selector: (s: T) => S): S =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(initial),
    );

  return { get, set, subscribe, useStore };
}