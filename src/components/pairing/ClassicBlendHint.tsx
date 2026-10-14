'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { matchClassicBlends } from '@/lib/classic-blends';
import { spiceName } from '@/lib/spice-list';
import { Section, Swatch, Meter, SmallButton } from './ui';

interface ClassicBlendHintProps {
  /** Selected spices in taxonomy-id space. */
  selectedTids: string[];
  /** taxonomy dot-id → map slug, for the "Add" buttons. */
  tidToSlug: Map<string, string>;
}

/**
 * Shows the top 1-2 classic blend matches for the current selection.
 * A match requires ≥ 2 matched spices AND fraction ≥ 1/3.
 * Each match shows progress, the blend's description, and small buttons for
 * the missing spices (or a plain note when a spice isn't on the map).
 */
export default function ClassicBlendHint({ selectedTids, tidToSlug }: ClassicBlendHintProps) {
  const { toggleSpice } = useSelection();

  const matches = useMemo(
    () => matchClassicBlends(selectedTids).slice(0, 2),
    [selectedTids]
  );

  if (matches.length === 0) return null;

  return (
    <Section
      title="Close to a classic"
      description="Your picks overlap with a well-known blend. Add what is missing to complete it."
    >
      <AnimatePresence initial={false}>
        <ul className="divide-y divide-rule">
          {matches.map(({ blend, matchedIds, missingIds, fraction }) => {
            const matched = matchedIds.length;
            const total = blend.spiceIds.length;

            return (
              <motion.li
                key={blend.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                className="py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-lead leading-tight text-chalk">{blend.name}</p>
                  <span className="shrink-0 text-small text-chalk-2">
                    {matched} of {total}
                  </span>
                </div>
                {blend.origin && <p className="text-small text-chalk-3">{blend.origin}</p>}

                <Meter value={fraction} className="mt-2" />

                <p className="mt-2 text-small leading-snug text-chalk-2">{blend.description}</p>

                {missingIds.length > 0 && (
                  <div className="mt-2.5">
                    <p className="mb-1.5 text-small text-chalk-3">
                      Still missing {missingIds.length === 1 ? 'one spice' : `${missingIds.length} spices`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingIds.map((tid) => {
                        const slug = tidToSlug.get(tid);
                        return slug ? (
                          <SmallButton key={tid} onClick={() => toggleSpice(slug)} className="gap-1.5">
                            <Swatch tid={tid} size={10} />
                            Add {spiceName(tid)}
                          </SmallButton>
                        ) : (
                          <span
                            key={tid}
                            title={`${spiceName(tid)} is not plotted on this map`}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-rule px-2.5 text-small text-chalk-3"
                          >
                            <Swatch tid={tid} size={10} />
                            {spiceName(tid)}, not on the map
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
    </Section>
  );
}
