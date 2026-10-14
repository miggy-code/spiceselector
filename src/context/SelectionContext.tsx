"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

interface SelectionState {
  selectedSpiceIds: Set<string>;
  /** Map slug id hovered in any view (map, atlas, or panel row), for cross-highlighting. */
  hoveredSpiceId: string | null;
}

interface SelectionActions {
  toggleSpice: (id: string) => void;
  /** Replace the whole selection at once (e.g. "try this pairing"). */
  selectSpices: (ids: string[]) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
}

const SelectionContext = createContext<
  (SelectionState & SelectionActions) | null
>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedSpiceIds, setSelectedSpiceIds] = useState<Set<string>>(
    new Set()
  );
  const [hoveredSpiceId, setHoveredSpiceId] = useState<string | null>(null);

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
  }, []);

  const setHovered = useCallback((id: string | null) => {
    setHoveredSpiceId(id);
  }, []);

  const value = useMemo(
    () => ({
      selectedSpiceIds,
      hoveredSpiceId,
      toggleSpice,
      selectSpices,
      clearSelection,
      setHovered,
    }),
    [selectedSpiceIds, hoveredSpiceId, toggleSpice, selectSpices, clearSelection, setHovered]
  );

  return (
    <SelectionContext.Provider value={value}>
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
