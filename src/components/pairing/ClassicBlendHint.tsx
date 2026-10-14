'use client';

import { useMemo } from 'react';
import { useSelection } from '@/context/SelectionContext';
import { matchClassicBlends } from '@/lib/classic-blends';
import { spiceName } from '@/lib/spice-list';
import { Swatch, SmallButton, useSpiceHover } from './ui';

interface ClassicBlendHintProps {
  /** Selected spices in taxonomy-id space. */
  selectedTids: string[];
  /** taxonomy dot-id → map slug, for the "Add" button. */
  tidToSlug: Map<string, string>;
}

/**
 * One row for the closest classic blend: how far away it is, plus a button
 * that adds what is missing. A match requires ≥ 2 matched spices AND
 * fraction ≥ 1/3. The blend's origin and description live in the tooltip.
 */
export default function ClassicBlendHint({ selectedTids, tidToSlug }: ClassicBlendHintProps) {
  const { selectedSpiceIds, selectSpices } = useSelection();
  const { hoverProps, setHovered } = useSpiceHover();

  const match = useMemo(() => matchClassicBlends(selectedTids)[0], [selectedTids]);
  if (!match) return null;

  const { blend, missingIds } = match;
  const missingSlugs = missingIds.map((tid) => tidToSlug.get(tid)).filter((s): s is string => !!s);
  const single = missingIds.length === 1 ? missingIds[0] : null;
  const tooltip = [blend.origin, blend.description].filter(Boolean).join('. ');

  return (
    <section className="border-t border-rule px-5 py-3" aria-label="Close to a classic">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-small text-chalk-2" title={tooltip}>
          {missingIds.length === 0 ? (
            <>You have <span className="text-chalk">{blend.name}</span></>
          ) : (
            <>{missingIds.length} away from <span className="text-chalk">{blend.name}</span></>
          )}
        </p>
        {missingSlugs.length > 0 && (
          <SmallButton
            className="h-7 shrink-0 gap-1.5 px-2.5"
            onClick={() => {
              setHovered(null);
              selectSpices([...selectedSpiceIds, ...missingSlugs]);
            }}
            title={`Add ${missingIds.map((tid) => spiceName(tid)).join(', ')}${missingSlugs.length < missingIds.length ? ' (some are not on the map)' : ''}`}
            {...hoverProps(single ? tidToSlug.get(single) : undefined)}
          >
            {single ? (
              <>
                <Swatch tid={single} size={10} />
                {spiceName(single)}
              </>
            ) : (
              `Add ${missingSlugs.length}`
            )}
          </SmallButton>
        )}
      </div>
    </section>
  );
}
