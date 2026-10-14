/**
 * A tiny external store backed by a single localStorage key, for use with
 * React's `useSyncExternalStore`.
 *
 * Hydration-safe: the server snapshot (and therefore the server render and the
 * first hydration pass) is always `initial`; React then switches to the stored
 * value on the client without a set-state-in-effect round trip, and without a
 * hydration mismatch.
 *
 * Storage is read lazily on the first client snapshot. Corrupt or unavailable
 * storage falls back to `initial`, and failed writes are ignored — in-memory
 * state still updates, so the UI keeps working (it just won't persist).
 */

type Listener = () => void;

export interface LocalStore<T> {
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  /** Replace the value via an updater (like a setState updater) and persist it. */
  update: (updater: (prev: T) => T) => void;
}

export function createLocalStore<T>(
  key: string,
  initial: T,
  decode: (raw: string) => T,
  encode: (value: T) => string
): LocalStore<T> {
  const listeners = new Set<Listener>();
  let value = initial;
  let loaded = false;

  function getSnapshot(): T {
    if (!loaded) {
      loaded = true;
      try {
        const raw = localStorage.getItem(key);
        if (raw) value = decode(raw);
      } catch {
        // Corrupt or unavailable storage — start fresh.
      }
    }
    return value;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot,
    getServerSnapshot: () => initial,
    update(updater) {
      value = updater(getSnapshot());
      try {
        localStorage.setItem(key, encode(value));
      } catch {}
      for (const listener of listeners) listener();
    },
  };
}
