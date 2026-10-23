// Written with the help of Claude
// AI Usage: minimal shared store over useSyncExternalStore; reviewed by Daryna Halytska.
import { useSyncExternalStore } from 'react';

// App-wide client state without a library: a value, a setter and a hook that re-renders on change.
export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();

  const get = () => value;
  const set = (update: Partial<T> | ((current: T) => Partial<T>)) => {
    value = { ...value, ...(typeof update === 'function' ? update(value) : update) };
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get, get);

  return { get, set, use };
}
