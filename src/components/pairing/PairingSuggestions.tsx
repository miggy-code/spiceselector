"use client";

import { useMemo } from "react";
import { useSelection } from "@/context/SelectionContext";
import {
  getCuratedPairings,
  buildRankedPairing,
  type RankedPairing,
} from "@/lib/pairing-engine";
import { ringColor } from "@/lib/colors";
import WhyPopover, { ScoreBar } from "./WhyPopover";

const affinityBadge: Record<string, { label: string; className: string }> = {
  classic: {
    label: "Classic",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  complementary: {
    label: "Complementary",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  surprising: {
    label: "Surprising",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
};

function familyFromId(id: string): string {
  return id.split(".")[0];
}

export default function PairingSuggestions() {
  const { selectedSpiceIds, aiMode, aiSuggestions, isAiLoading } = useSelection();

  const curatedPairings = useMemo(
    () => getCuratedPairings(selectedSpiceIds),
    [selectedSpiceIds]
  );

  if (selectedSpiceIds.size === 0) {
    return (
      <div className="text-center py-8 text-neutral-400 dark:text-neutral-500">
        <p className="text-sm">Select spices from the wheel</p>
        <p className="text-xs mt-1">to see pairing suggestions</p>
      </div>
    );
  }

  if (aiMode) {
    if (isAiLoading) {
      return (
        <div className="flex items-center justify-center py-8 gap-2 text-neutral-400">
          <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          <span className="text-sm">Thinking...</span>
        </div>
      );
    }

    if (!aiSuggestions || aiSuggestions.length === 0) {
      return (
        <div className="text-center py-8 text-neutral-400 text-sm">
          <p>AI suggestions not available.</p>
          <p className="text-xs mt-1">Set NEXT_PUBLIC_AI_ENABLED=true and add an API key.</p>
        </div>
      );
    }
  }

  const pairings: RankedPairing[] = aiMode
    ? (aiSuggestions ?? []).map((s) =>
        buildRankedPairing(s, 1, Array.from(selectedSpiceIds))
      )
    : curatedPairings;

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 px-1">
        {pairings.length} suggestion{pairings.length !== 1 ? "s" : ""}
      </p>
      <ul className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {pairings.map((p) => {
          const badge = affinityBadge[p.affinity];
          const familyId = familyFromId(p.spiceId);
          return (
            <li
              key={p.spiceId}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: ringColor(familyId, "family") }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {p.spiceName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  {p.matchCount > 1 && (
                    <span className="text-[10px] text-neutral-400">
                      {p.matchCount} matches
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 pr-1">
                  <ScoreBar score={p.blendedScore} />
                  <span className="text-[10px] tabular-nums text-cyan-600 dark:text-cyan-300">
                    {p.blendedScore.toFixed(2)}
                  </span>
                </div>
                {p.compoundOverlap && p.compoundOverlap.sharedAromaCount > 0 && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    shares {p.compoundOverlap.sharedAromaCount} aroma compound
                    {p.compoundOverlap.sharedAromaCount !== 1 ? "s" : ""}
                  </p>
                )}
                {p.note && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {p.note}
                  </p>
                )}
                {p.cuisines && p.cuisines.length > 0 && (
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {p.cuisines.join(" · ")}
                  </p>
                )}
              </div>
              <WhyPopover pairing={p} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
