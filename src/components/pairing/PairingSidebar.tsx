"use client";

import AIToggle from "./AIToggle";
import PairingSuggestions from "./PairingSuggestions";
import SpiceDetailCard from "./SpiceDetailCard";

export default function PairingSidebar() {
  return (
    <aside className="flex flex-col gap-4 p-4 lg:p-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
          Pairing Suggestions
        </h2>
        <AIToggle />
      </div>
      <PairingSuggestions />
      <SpiceDetailCard />
    </aside>
  );
}
