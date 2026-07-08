'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { pickSurprise, type SurprisePairing } from '@/lib/surprise-finder';
import { FAMILY_COLORS } from '@/lib/colors';

function familyColorForTid(tid: string): string {
  return FAMILY_COLORS[tid.split('.')[0]] ?? '#22d3ee';
}

/** Human explanation of *why* this pairing counts as surprising. */
function noveltyFacts(s: SurprisePairing): string[] {
  const facts: string[] = [];
  if (s.taxonomyFamiliarity === 0) {
    facts.push('they come from different flavor families');
  }
  if (!s.compoundOverlap || s.compoundOverlap.sharedAromaCount === 0) {
    facts.push('they share almost no flavor chemistry');
  } else if (s.compoundOverlap.sharedAromaCount <= 3) {
    facts.push(
      `they share only ${s.compoundOverlap.sharedAromaCount} aroma compound${
        s.compoundOverlap.sharedAromaCount !== 1 ? 's' : ''
      }`
    );
  }
  if (!s.curatedLabel) {
    facts.push('no cookbook pairing lists them together');
  }
  return facts;
}

/**
 * The flavor notes the pair's few shared compounds carry — friendlier than
 * raw IUPAC compound names in a card meant to be fun.
 */
function sharedFlavorWords(s: SurprisePairing): string[] {
  if (!s.compoundOverlap) return [];
  const words = new Set<string>();
  for (const c of s.compoundOverlap.shared) {
    for (const f of c.flavors) words.add(f);
  }
  return Array.from(words).slice(0, 5);
}

interface SurpriseSectionProps {
  /** taxonomy dot-id → map slug, for putting the pair on the map. */
  tidToSlug: Map<string, string>;
  /** Current selection in taxonomy-id space; a single spice scopes the roll. */
  selectedTaxonomyIds: Set<string>;
}

/**
 * "Surprise me" (PLAN.md Step 7): rolls a high-affinity, low-familiarity
 * pairing from the surprise engine. With exactly one spice selected the roll
 * is scoped to that spice; otherwise it samples the global pool.
 */
export default function SurpriseSection({ tidToSlug, selectedTaxonomyIds }: SurpriseSectionProps) {
  const { selectSpices } = useSelection();
  const [surprise, setSurprise] = useState<SurprisePairing | null>(null);
  // Bumped on every roll so framer-motion re-animates the card.
  const [rollCount, setRollCount] = useState(0);

  const roll = useCallback(() => {
    const forSpiceId =
      selectedTaxonomyIds.size === 1 ? Array.from(selectedTaxonomyIds)[0] : undefined;
    let next: SurprisePairing | null = null;
    // Re-sample a few times so consecutive rolls feel fresh.
    for (let i = 0; i < 6; i++) {
      next = pickSurprise({ forSpiceId });
      if (!next) break;
      if (!surprise || next.a !== surprise.a || next.b !== surprise.b) break;
    }
    setSurprise(next);
    setRollCount((c) => c + 1);
  }, [selectedTaxonomyIds, surprise]);

  const slugA = surprise ? tidToSlug.get(surprise.a) : undefined;
  const slugB = surprise ? tidToSlug.get(surprise.b) : undefined;
  const canTry = !!(slugA && slugB);

  return (
    <div className="px-4 py-3 border-b border-white/8 bg-amber-400/[0.04]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-amber-300/70 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
          Surprise me
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={roll}
            className="text-[11px] px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 hover:bg-amber-400/25 hover:shadow-[0_0_12px_rgba(251,191,36,0.4)] active:scale-95 transition-all"
          >
            {surprise ? '⟳ another' : '🎲 roll one'}
          </button>
          {surprise && (
            <button
              type="button"
              onClick={() => setSurprise(null)}
              aria-label="Dismiss surprise"
              className="text-white/30 hover:text-white/70 text-[13px] leading-none px-1 transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {!surprise && (
        <p className="text-[11px] text-white/40 mt-1">
          {selectedTaxonomyIds.size === 1
            ? 'An unexpected partner for your selected spice.'
            : 'A pairing that works in real recipes — but no cookbook will tell you about.'}
        </p>
      )}

      <AnimatePresence mode="wait">
        {surprise && (
          <motion.div
            key={`${surprise.a}×${surprise.b}×${rollCount}`}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="mt-2 rounded-xl border border-amber-400/25 bg-white/[0.03] p-3"
          >
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: familyColorForTid(surprise.a) }}
                />
                <span className="text-sm font-semibold text-white/95">{surprise.aName}</span>
              </span>
              <span className="text-amber-300/80 text-base leading-none">×</span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: familyColorForTid(surprise.b) }}
                />
                <span className="text-sm font-semibold text-white/95">{surprise.bName}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[9px] uppercase tracking-wider text-white/35 w-14">recipes</span>
              <div className="h-1.5 flex-1 rounded-full bg-neutral-700/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
                  style={{ width: `${Math.round(surprise.affinity * 100)}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-amber-300 w-8 text-right">
                {surprise.affinity.toFixed(2)}
              </span>
            </div>

            <p className="text-[11px] text-white/55 mt-2 leading-relaxed">
              Real recipes pair these constantly — yet {noveltyFacts(surprise).join(', ')}.
            </p>

            {sharedFlavorWords(surprise).length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-[10px] text-white/35 mr-0.5">common ground:</span>
                {sharedFlavorWords(surprise).map((flavor) => (
                  <span
                    key={flavor}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  >
                    {flavor}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-2.5">
              {canTry ? (
                <button
                  type="button"
                  onClick={() => selectSpices([slugA!, slugB!])}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 hover:bg-amber-400/25 hover:shadow-[0_0_12px_rgba(251,191,36,0.4)] transition-all"
                >
                  Try it on the map →
                </button>
              ) : (
                <span className="text-[10px] text-white/30" title="One of these spices isn't plotted on this map">
                  not fully on this map
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
