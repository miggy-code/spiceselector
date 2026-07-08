"use client";

import { useSelection } from "@/context/SelectionContext";

const aiEnabled = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

export default function AIToggle() {
  const { aiMode, toggleAiMode } = useSelection();

  if (!aiEnabled) return null;

  return (
    <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
      <button
        onClick={!aiMode ? undefined : toggleAiMode}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          !aiMode
            ? "bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm"
            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
        }`}
      >
        Curated
      </button>
      <button
        onClick={aiMode ? undefined : toggleAiMode}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          aiMode
            ? "bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm"
            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
        }`}
      >
        AI Creative
      </button>
    </div>
  );
}
