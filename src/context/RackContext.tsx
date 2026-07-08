"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

/**
 * "My rack": which spices the user actually owns (map slug ids), persisted in
 * localStorage — no auth needed. `rackOnly` filters suggestions/substitutes
 * down to what's in the house.
 */

const STORAGE_KEY = "spice-rack";
const RACK_ONLY_KEY = "spice-rack-only";

interface RackState {
  rackIds: Set<string>;
  rackOnly: boolean;
  toggleRack: (id: string) => void;
  setRackOnly: (on: boolean) => void;
}

const RackContext = createContext<RackState | null>(null);

export function RackProvider({ children }: { children: ReactNode }) {
  // Start empty and hydrate from localStorage after mount so server and
  // client render the same initial markup.
  const [rackIds, setRackIds] = useState<Set<string>>(new Set());
  const [rackOnly, setRackOnlyState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRackIds(new Set(JSON.parse(stored) as string[]));
      setRackOnlyState(localStorage.getItem(RACK_ONLY_KEY) === "true");
    } catch {
      // Corrupt storage — start fresh.
    }
  }, []);

  const toggleRack = useCallback((id: string) => {
    setRackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const setRackOnly = useCallback((on: boolean) => {
    setRackOnlyState(on);
    try {
      localStorage.setItem(RACK_ONLY_KEY, String(on));
    } catch {}
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
