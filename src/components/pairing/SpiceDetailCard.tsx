"use client";

import { useMemo } from "react";
import { useSelection } from "@/context/SelectionContext";
import { getScoredPairingsForSpice } from "@/lib/pairing-engine";
import { ringColor } from "@/lib/colors";
import taxonomyData from "@/data/spice-taxonomy.json";
import type { FlavorNode } from "@/types/spice";

function findNode(tree: FlavorNode, id: string): FlavorNode | null {
  if (tree.id === id) return tree;
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function breadcrumb(id: string): string {
  const parts = id.split(".");
  return parts
    .slice(0, -1)
    .map((p) =>
      p
        .split("-")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ")
    )
    .join(" > ");
}

export default function SpiceDetailCard() {
  const { hoveredSpiceId, selectedSpiceIds } = useSelection();

  const displayId = hoveredSpiceId ?? Array.from(selectedSpiceIds).pop() ?? null;

  const node = useMemo(() => {
    if (!displayId) return null;
    return findNode(taxonomyData as FlavorNode, displayId);
  }, [displayId]);

  const pairings = useMemo(() => {
    if (!displayId) return [];
    return getScoredPairingsForSpice(displayId);
  }, [displayId]);

  if (!node || node.level === "root") return null;

  const familyId = displayId!.split(".")[0];

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-800/80">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: ringColor(familyId, node.level as "family" | "subcategory" | "spice") }}
        />
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
          {node.name}
        </h3>
      </div>
      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-1">
        {breadcrumb(displayId!)}
      </p>
      {node.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-3">
          {node.description}
        </p>
      )}
      {node.level === "spice" && pairings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            Known pairings
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pairings.slice(0, 8).map((p) => (
              <span
                key={p.spiceId}
                className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              >
                {p.spiceId
                  .split(".")
                  .pop()!
                  .split("-")
                  .map((w) => w[0].toUpperCase() + w.slice(1))
                  .join(" ")}
                {p.affinityScore !== null && (
                  <span className="ml-1 tabular-nums text-cyan-600 dark:text-cyan-300">
                    {p.affinityScore.toFixed(2)}
                  </span>
                )}
                {p.compoundOverlap && p.compoundOverlap.sharedAromaCount > 0 && (
                  <span
                    className="ml-1 tabular-nums text-emerald-600 dark:text-emerald-400"
                    title={`Shares ${p.compoundOverlap.sharedAromaCount} aroma compounds`}
                  >
                    ▲{p.compoundOverlap.sharedAromaCount}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
