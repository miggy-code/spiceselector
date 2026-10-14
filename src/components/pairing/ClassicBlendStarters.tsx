'use client';

import { useMemo } from 'react';
import { useSelection } from '@/context/SelectionContext';
import { allClassicBlends } from '@/lib/classic-blends';
import { Section, SwatchStack } from './ui';

interface ClassicBlendStartersProps {
  /** taxonomy dot-id → map slug, to translate blend spices to selectable slugs. */
  tidToSlug: Map<string, string>;
}

const FEATURED_IDS = ['garam-masala', 'chinese-five-spice', 'zaatar', 'herbes-de-provence', 'berbere'];

/**
 * "Start from a blend": each classic is drawn as a stack of its spices' real
 * colors, so the list reads like jars on a shelf.
 */
export default function ClassicBlendStarters({ tidToSlug }: ClassicBlendStartersProps) {
  const { selectSpices } = useSelection();
  const featured = useMemo(() => allClassicBlends.filter((b) => FEATURED_IDS.includes(b.id)), []);

  return (
    <Section title="Start from a blend">
      <ul className="-mx-2 grid">
        {featured.map((blend) => {
          const onMapSlugs = blend.spiceIds.map((tid) => tidToSlug.get(tid)).filter((s): s is string => !!s);
          return (
            <li key={blend.id}>
              <button
                type="button"
                onClick={() => selectSpices(onMapSlugs)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-board-high"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lead leading-tight text-chalk">{blend.name}</p>
                  <p className="text-small text-chalk-3">
                    {blend.origin}, {blend.spiceIds.length} spices
                  </p>
                </div>
                <SwatchStack tids={blend.spiceIds} max={7} size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
