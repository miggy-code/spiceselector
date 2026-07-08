'use client';

import { useMemo } from 'react';
import { useSelection } from '@/context/SelectionContext';
import { allClassicBlends } from '@/lib/classic-blends';
import { FAMILY_COLORS } from '@/lib/colors';

interface ClassicBlendStartersProps {
  /** taxonomy dot-id → map slug, to translate blend spices to selectable slugs. */
  tidToSlug: Map<string, string>;
}

/** IDs of the blends to feature in the "Start from a classic" list. */
const FEATURED_IDS = [
  'garam-masala',
  'chinese-five-spice',
  'zaatar',
  'herbes-de-provence',
  'berbere',
];

function familyColorForTid(tid: string): string {
  return FAMILY_COLORS[tid.split('.')[0]] ?? '#888';
}

/**
 * Compact "Start from a classic" list shown in the empty-selection state.
 * Clicking a blend calls selectSpices() with its on-map spice slugs,
 * letting the user explore the blend on the Flavor Map straight away.
 */
export default function ClassicBlendStarters({ tidToSlug }: ClassicBlendStartersProps) {
  const { selectSpices } = useSelection();

  const featured = useMemo(
    () => allClassicBlends.filter((b) => FEATURED_IDS.includes(b.id)),
    []
  );

  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-widest text-rose-300/60 mb-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
        Start from a classic
      </p>
      <ul className="space-y-1.5">
        {featured.map((blend) => {
          const onMapSlugs = blend.spiceIds
            .map((tid) => tidToSlug.get(tid))
            .filter((s): s is string => !!s);

          return (
            <li key={blend.id}>
              <button
                type="button"
                onClick={() => selectSpices(onMapSlugs)}
                className="w-full text-left group rounded-xl border border-white/8 bg-white/[0.03] hover:bg-rose-500/[0.06] hover:border-rose-400/25 p-2.5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium text-white/85 group-hover:text-white/95 block truncate transition-colors">
                      {blend.name}
                    </span>
                    <span className="text-[10px] text-white/35">{blend.origin}</span>
                  </div>
                  {/* Color dots for the on-map spices */}
                  <span className="flex items-center gap-0.5 flex-shrink-0">
                    {blend.spiceIds.slice(0, 6).map((tid) => (
                      <span
                        key={tid}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: familyColorForTid(tid),
                          opacity: tidToSlug.has(tid) ? 1 : 0.3,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
