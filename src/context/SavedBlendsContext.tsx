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
 * Saved blends, persisted in localStorage (map slug ids) — the Blend
 * Builder's retention loop without a backend.
 */

const STORAGE_KEY = "spice-blends";

export interface SavedBlend {
  id: string;
  name: string;
  slugs: string[];
  createdAt: number;
}

interface SavedBlendsState {
  blends: SavedBlend[];
  saveBlend: (name: string, slugs: string[]) => SavedBlend;
  deleteBlend: (id: string) => void;
}

const SavedBlendsContext = createContext<SavedBlendsState | null>(null);

const NO_BLENDS: SavedBlend[] = [];

const blendsStore = createLocalStore<SavedBlend[]>(
  STORAGE_KEY,
  NO_BLENDS,
  (raw) => {
    const blends: unknown = JSON.parse(raw);
    if (!Array.isArray(blends)) throw new Error("corrupt blends");
    return blends as SavedBlend[];
  },
  (blends) => JSON.stringify(blends)
);

export function SavedBlendsProvider({ children }: { children: ReactNode }) {
  // Server render + first hydration pass see no blends; stored blends swap in
  // on the client (see createLocalStore), so markup matches.
  const blends = useSyncExternalStore(
    blendsStore.subscribe,
    blendsStore.getSnapshot,
    blendsStore.getServerSnapshot
  );

  const saveBlend = useCallback((name: string, slugs: string[]) => {
    const blend: SavedBlend = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Untitled blend",
      slugs,
      createdAt: Date.now(),
    };
    blendsStore.update((prev) => [blend, ...prev]);
    return blend;
  }, []);

  const deleteBlend = useCallback((id: string) => {
    blendsStore.update((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return (
    <SavedBlendsContext.Provider value={{ blends, saveBlend, deleteBlend }}>
      {children}
    </SavedBlendsContext.Provider>
  );
}

export function useSavedBlends() {
  const context = useContext(SavedBlendsContext);
  if (!context) {
    throw new Error("useSavedBlends must be used within a SavedBlendsProvider");
  }
  return context;
}
