'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { useRack } from '@/context/RackContext';
import { dishesByCategory, getDish, getDishSpiceRanking } from '@/lib/dish-affinity';
import { FAMILY_COLORS } from '@/lib/colors';

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
    <div className="px-4 py-3 border-b border-white/8 bg-lime-400/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-lime-300/70 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.9)]" />
          Cooking something?
        </p>
        <select
          value={dishId}
          onChange={(e) => setDishId(e.target.value)}
          aria-label="Pick a base ingredient"
          className="text-[11px] bg-neutral-900 border border-white/15 rounded-lg px-2 py-1 text-white/80 focus:outline-none focus:border-lime-400/50 max-w-[150px]"
        >
          <option value="">Pick a base…</option>
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
      </div>

      <AnimatePresence initial={false}>
        {dish && (
          <motion.div
            key={dish.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[11px] text-white/50 mt-2">
              Best spices for <span className="text-white/85">{dish.name.toLowerCase()}</span>
              {rackOnly ? ' from your rack' : ''}, learned from ~1M recipes:
            </p>
            {ranking.length === 0 ? (
              <p className="text-[11px] text-white/35 mt-1.5">
                {rackOnly
                  ? 'Nothing in your rack scores for this — turn off “only my rack” to see all.'
                  : 'No scored spices for this base.'}
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {ranking.map((r, i) => {
                  const slug = tidToSlug.get(r.spiceId)!;
                  return (
                    <motion.li
                      key={r.spiceId}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: FAMILY_COLORS[r.spiceId.split('.')[0]] ?? '#888' }}
                      />
                      <span className="text-[12px] text-white/85 w-24 truncate">{r.spiceName}</span>
                      <div className="h-1 flex-1 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 shadow-[0_0_5px_rgba(163,230,53,0.6)]"
                          style={{ width: `${Math.round(r.relative * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-lime-300 w-8 text-right">
                        {r.score.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSpice(slug)}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime-500/15 border border-lime-400/30 text-lime-200 hover:bg-lime-500/25 transition-all flex-shrink-0"
                      >
                        + add
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
