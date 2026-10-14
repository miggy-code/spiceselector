"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from "react";
import { createLocalStore } from "@/lib/local-store";

/**
 * "My rack": which spices the user actually owns (map slug ids), persisted in
 * localStorage — no auth needed. `rackOnly` filters suggestions/substitutes
 * down to what's in the house.
 */

const STORAGE_KEY = "spice-rack";
const RACK_ONLY_KEY = "spice-rack-only";

const rackStore = createLocalStore<Set<string>>(
  STORAGE_KEY,
  new Set(),
  (raw) => {
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids)) throw new Error("corrupt rack");
    return new Set(ids as string[]);
  },
  (ids) => JSON.stringify(Array.from(ids))
);

const rackOnlyStore = createLocalStore<boolean>(
  RACK_ONLY_KEY,
  false,
  (raw) => raw === "true",
  (on) => String(on)
);

interface RackState {
  rackIds: Set<string>;
  rackOnly: boolean;
  toggleRack: (id: string) => void;
  setRackOnly: (on: boolean) => void;
}

const RackContext = createContext<RackState | null>(null);

export function RackProvider({ children }: { children: ReactNode }) {
  // Server render + first hydration pass use the empty defaults; the stored
  // values swap in on the client (see createLocalStore), so markup matches.
  const rackIds = useSyncExternalStore(
    rackStore.subscribe,
    rackStore.getSnapshot,
    rackStore.getServerSnapshot
  );
  const rackOnly = useSyncExternalStore(
    rackOnlyStore.subscribe,
    rackOnlyStore.getSnapshot,
    rackOnlyStore.getServerSnapshot
  );

  const toggleRack = useCallback((id: string) => {
    rackStore.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setRackOnly = useCallback((on: boolean) => {
    rackOnlyStore.update(() => on);
  }, []);

  return (
    <RackContext.Provider value={{ rackIds, rackOnly, toggleRack, setRackOnly }}>
      {children}
    </RackContext.Provider>
  );
}

export function useRack() {
  const context = useContext(RackContext);
  if (!context) {
    throw new Error("useRack must be used within a RackProvider");
  }
  return context;
}
