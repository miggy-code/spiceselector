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

function persist(blends: SavedBlend[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blends));
  } catch {}
}

export function SavedBlendsProvider({ children }: { children: ReactNode }) {
  // Hydrate after mount so server and client render identical initial markup.
  const [blends, setBlends] = useState<SavedBlend[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setBlends(JSON.parse(stored) as SavedBlend[]);
    } catch {}
  }, []);

  const saveBlend = useCallback((name: string, slugs: string[]) => {
    const blend: SavedBlend = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Untitled blend",
      slugs,
      createdAt: Date.now(),
    };
    setBlends((prev) => {
      const next = [blend, ...prev];
      persist(next);
      return next;
    });
    return blend;
  }, []);

  const deleteBlend = useCallback((id: string) => {
    setBlends((prev) => {
      const next = prev.filter((b) => b.id !== id);
      persist(next);
      return next;
    });
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
