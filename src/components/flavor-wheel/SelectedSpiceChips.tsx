"use client";

import { useSelection } from "@/context/SelectionContext";
import { ringColor } from "@/lib/colors";

function spiceNameFromId(id: string): string {
  const parts = id.split(".");
  const last = parts[parts.length - 1];
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function familyFromId(id: string): string {
  return id.split(".")[0];
}

export default function SelectedSpiceChips() {
  const { selectedSpiceIds, toggleSpice, clearSelection } = useSelection();

  if (selectedSpiceIds.size === 0) {
    return (
      <div className="text-center py-3 text-sm text-neutral-400 dark:text-neutral-500">
        Click on the outer ring to select spices
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3">
      {Array.from(selectedSpiceIds).map((id) => {
        const familyId = familyFromId(id);
        return (
          <button
            key={id}
            onClick={() => toggleSpice(id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white transition-all hover:scale-105 hover:shadow-md"
            style={{ backgroundColor: ringColor(familyId, "family") }}
          >
            {spiceNameFromId(id)}
            <span className="ml-0.5 opacity-70 hover:opacity-100">&times;</span>
          </button>
        );
      })}
      {selectedSpiceIds.size > 1 && (
        <button
          onClick={clearSelection}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
