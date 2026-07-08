"use client";

import { useEffect, useRef, useState } from "react";
import type { RankedPairing } from "@/lib/pairing-engine";

function nameFromId(id: string): string {
  return id
    .split(".")
    .pop()!
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const affinityLabel: Record<string, string> = {
  classic: "a classic pairing",
  complementary: "a complementary pairing",
  surprising: "a surprising pairing",
};

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 flex-1 rounded-full bg-neutral-200 dark:bg-neutral-700/80 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]"
        style={{ width: `${Math.round(score * 100)}%` }}
      />
    </div>
  );
}

/**
 * "Why?" popover: shows the visible breakdown behind a pairing score —
 * FlavorGraph affinity per selected spice plus the curated label.
 */
export default function WhyPopover({ pairing }: { pairing: RankedPairing }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/10 hover:shadow-[0_0_8px_rgba(34,211,238,0.35)] transition-all"
      >
        why?
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-64 rounded-xl border border-cyan-500/25 bg-white dark:bg-neutral-900 p-3 shadow-xl shadow-cyan-500/10">
          <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
            Why {pairing.spiceName}?
          </p>

          {pairing.affinityDetails.length > 0 ? (
            <div className="space-y-1.5 mb-2">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Recipe affinity (FlavorGraph)
              </p>
              {pairing.affinityDetails.map((d) => (
                <div key={d.spiceId} className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-600 dark:text-neutral-300 w-20 truncate">
                    {nameFromId(d.spiceId)}
                  </span>
                  <ScoreBar score={d.score} />
                  <span className="text-[11px] tabular-nums text-cyan-600 dark:text-cyan-300 w-8 text-right">
                    {d.score.toFixed(2)}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Learned from ~1M real recipes + chemical compound data.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
              No FlavorGraph embedding for this pair yet — score comes from
              the curated label below.
            </p>
          )}

          {pairing.compoundOverlap &&
            pairing.compoundOverlap.sharedAromaCount > 0 && (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700/70">
                <p className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-1">
                  Shares {pairing.compoundOverlap.sharedAromaCount} aroma
                  compound
                  {pairing.compoundOverlap.sharedAromaCount !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  {pairing.compoundOverlap.shared.map((c) => (
                    <span
                      key={c.name}
                      title={c.flavors.join(", ")}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

          <div className="pt-2 mt-2 border-t border-neutral-200 dark:border-neutral-700/70">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-0.5">
              Curated label
            </p>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
              Tagged as {affinityLabel[pairing.affinity]}
              {pairing.note ? ` — ${pairing.note}` : "."}
            </p>
          </div>

          <p className="mt-2 text-[9px] text-neutral-400 dark:text-neutral-600">
            Derived from FlavorGraph (Park et al. 2021) and Ahn et al. (2011)
          </p>
        </div>
      )}
    </div>
  );
}
