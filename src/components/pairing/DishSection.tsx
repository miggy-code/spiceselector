'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { useRack } from '@/context/RackContext';
import { dishesByCategory, getDish, getDishSpiceRanking } from '@/lib/dish-affinity';
import { Section, Swatch, Meter, SmallButton } from './ui';

interface DishSectionProps {
  /** taxonomy dot-id → map slug. */
  tidToSlug: Map<string, string>;
  /** Already-selected spices (taxonomy ids) — excluded from the ranking. */
  selectedTids: Set<string>;
}

/**
 * Dish anchoring: pick a base ingredient ("Cooking salmon?") and see the
 * spices FlavorGraph ranks highest for it, straight from ~1M recipes.
 */
export default function DishSection({ tidToSlug, selectedTids }: DishSectionProps) {
  const { toggleSpice } = useSelection();
  const { rackIds, rackOnly } = useRack();
  const [dishId, setDishId] = useState<string>('');

  const categories = useMemo(() => dishesByCategory(), []);

  const ranking = useMemo(() => {
    if (!dishId) return [];
    // Over-fetch so rack/off-map filtering still leaves a full list.
    const all = getDishSpiceRanking(dishId, { limit: 24, excludeIds: selectedTids });
    const usable = all.filter((r) => {
      const slug = tidToSlug.get(r.spiceId);
      if (!slug) return false;
      if (rackOnly && !rackIds.has(slug)) return false;
      return true;
    });
    return usable.slice(0, 6);
  }, [dishId, selectedTids, tidToSlug, rackOnly, rackIds]);

  const dish = dishId ? getDish(dishId) : undefined;

  return (
    <Section
      title="Cooking something?"
      description="Pick your main ingredient and see which spices cooks reach for most."
    >
        <select
        value={dishId}
        onChange={(e) => setDishId(e.target.value)}
        aria-label="Pick a main ingredient"
        className="h-10 w-full cursor-pointer rounded-lg px-3 text-body font-medium text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.16)] outline-none transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.3)]"
      >
        <option value="">Pick an ingredient</option>
        {categories.map(([category, dishes]) => (
          <optgroup key={category} label={category}>
            {dishes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <AnimatePresence initial={false}>
        {dish && (
          <motion.div
            key={dish.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-small text-chalk-2">
              Best spices for <span className="text-chalk">{dish.name.toLowerCase()}</span>
              {rackOnly ? ' from your rack' : ''}, learned from about a million recipes.
            </p>
            {ranking.length === 0 ? (
              <p className="mt-2 text-small text-chalk-3">
                {rackOnly
                  ? 'Nothing in your rack scores for this. Turn off “Only suggest what I have” in Filters to see them all.'
                  : 'No scored spices for this ingredient.'}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-rule">
                {ranking.map((r, i) => {
                  const slug = tidToSlug.get(r.spiceId)!;
                  return (
                    <motion.li
                      key={r.spiceId}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-2.5 py-2"
                    >
                      <Swatch tid={r.spiceId} size={14} />
                      <span className="w-24 truncate text-body text-chalk">{r.spiceName}</span>
                      <Meter value={r.relative} className="flex-1" />
                      <span className="w-8 text-right text-small text-chalk-2">{r.score.toFixed(2)}</span>
                      <SmallButton onClick={() => toggleSpice(slug)} className="shrink-0">
                        Add
                      </SmallButton>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
