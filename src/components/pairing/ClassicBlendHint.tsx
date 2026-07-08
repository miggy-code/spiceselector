'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { matchClassicBlends } from '@/lib/classic-blends';
import { spiceName } from '@/lib/spice-list';
import { FAMILY_COLORS } from '@/lib/colors';

interface ClassicBlendHintProps {
  /** Selected spices in taxonomy-id space. */
  selectedTids: string[];
  /** taxonomy dot-id → map slug, for the "+ add" buttons. */
  tidToSlug: Map<string, string>;
}

function familyColorForTid(tid: string): string {
  return FAMILY_COLORS[tid.split('.')[0]] ?? '#f43f5e';
}

/**
 * Shows the top 1-2 classic blend matches for the current selection.
 * A match requires ≥ 2 matched spices AND fraction ≥ 1/3.
 * Each card shows progress, the blend's description, and chips for the
 * missing spices with "+ add" buttons (or "off-map" labels).
 */
export default function ClassicBlendHint({ selectedTids, tidToSlug }: ClassicBlendHintProps) {
  const { toggleSpice } = useSelection();

  const matches = useMemo(
    () => matchClassicBlends(selectedTids).slice(0, 2),
    [selectedTids]
  );

  if (matches.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-white/8 bg-rose-500/[0.04]">
      <p className="text-[10px] uppercase tracking-widest text-rose-300/70 mb-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
        Classic blends
      </p>

      <AnimatePresence initial={false}>
        <ul className="space-y-2.5">
          {matches.map(({ blend, matchedIds, missingIds, fraction }) => {
            const matched = matchedIds.length;
            const total = blend.spiceIds.length;
            const pct = Math.round(fraction * 100);

            return (
              <motion.li
                key={blend.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                className="rounded-xl border border-rose-400/20 bg-white/[0.03] p-2.5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-white/90 leading-tight">
                      {blend.name}
                    </p>
                    <p className="text-[10px] text-white/40">{blend.origin}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-medium text-rose-300 tabular-nums">
                    {matched}/{total}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="h-1.5 flex-1 rounded-full bg-neutral-700/80 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400"
                      style={{ boxShadow: '0 0 6px rgba(244,63,94,0.6)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-rose-300">{pct}%</span>
                </div>

                <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">
                  {blend.description}
                </p>

                {/* Missing spice chips */}
                {missingIds.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-white/35 mb-1.5">
                      Still need{missingIds.length === 1 ? '' : ` ${missingIds.length}`}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingIds.map((tid) => {
                        const slug = tidToSlug.get(tid);
                        return slug ? (
                          <button
                            key={tid}
                            type="button"
                            onClick={() => toggleSpice(slug)}
                            className="flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-400/25 text-rose-100 text-[10px] hover:bg-rose-500/20 hover:shadow-[0_0_8px_rgba(244,63,94,0.35)] transition-all"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: familyColorForTid(tid) }}
                            />
                            + {spiceName(tid)}
                          </button>
                        ) : (
                          <span
                            key={tid}
                            title={`${spiceName(tid)} — not plotted on this map`}
                            className="flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full border border-white/10 text-white/25 text-[10px]"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: familyColorForTid(tid) }}
                            />
                            {spiceName(tid)}
                            <span className="text-[9px] text-white/20 ml-0.5">off-map</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      </AnimatePresence>
    </div>
  );
}
