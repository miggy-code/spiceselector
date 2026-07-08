"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { PairingLink } from "@/types/pairing";

interface SelectionState {
  selectedSpiceIds: Set<string>;
  hoveredSpiceId: string | null;
  aiMode: boolean;
  aiSuggestions: PairingLink[] | null;
  isAiLoading: boolean;
}

interface SelectionActions {
  toggleSpice: (id: string) => void;
  /** Replace the whole selection at once (e.g. "try this pairing"). */
  selectSpices: (ids: string[]) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  toggleAiMode: () => void;
  setAiSuggestions: (suggestions: PairingLink[] | null) => void;
  setIsAiLoading: (loading: boolean) => void;
}

const SelectionContext = createContext<
  (SelectionState & SelectionActions) | null
>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedSpiceIds, setSelectedSpiceIds] = useState<Set<string>>(
    new Set()
  );
  const [hoveredSpiceId, setHoveredSpiceId] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<PairingLink[] | null>(
    null
  );
  const [isAiLoading, setIsAiLoading] = useState(false);

  const toggleSpice = useCallback((id: string) => {
    setSelectedSpiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectSpices = useCallback((ids: string[]) => {
    setSelectedSpiceIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSpiceIds(new Set());
    setAiSuggestions(null);
  }, []);

  const setHovered = useCallback((id: string | null) => {
    setHoveredSpiceId(id);
  }, []);

  const toggleAiMode = useCallback(() => {
    setAiMode((prev) => !prev);
    setAiSuggestions(null);
  }, []);

  return (
    <SelectionContext.Provider
      value={{
        selectedSpiceIds,
        hoveredSpiceId,
        aiMode,
        aiSuggestions,
        isAiLoading,
        toggleSpice,
        selectSpices,
        clearSelection,
        setHovered,
        toggleAiMode,
        setAiSuggestions,
        setIsAiLoading,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
