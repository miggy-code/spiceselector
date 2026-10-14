'use client';

import { useSelection } from '@/context/SelectionContext';
import type { BridgeAnalysis, BridgeCandidate } from '@/lib/bridge-finder';
import { spiceName } from '@/lib/spice-list';
import { Swatch, AddButton, useSpiceHover } from './ui';

interface BridgeRowProps {
  bridge: BridgeAnalysis;
  /** taxonomy dot-id → map slug. */
  tidToSlug: Map<string, string>;
}

/**
 * The weakest pair in the blend and up to two spices that connect both ends.
 * One compact row per candidate; the scores live in the tooltip.
 */
export default function BridgeRow({ bridge, tidToSlug }: BridgeRowProps) {
  const { toggleSpice } = useSelection();
  const { hoverProps, setHovered } = useSpiceHover();
  const a = spiceName(bridge.a);
  const b = spiceName(bridge.b);
  const direct = bridge.direct ? `${a} and ${b} score ${bridge.direct.score.toFixed(2)} together.` : `${a} and ${b} share no evidence.`;

  return (
    <section className="border-t border-rule px-5 py-3" aria-label="Bridge the weakest link">
      <p className="text-small text-chalk-2" title={direct}>
        Bridge <span className="text-chalk">{a}</span> ↔ <span className="text-chalk">{b}</span>
      </p>
      <ul className="mt-1.5 grid gap-1">
        {bridge.bridges.slice(0, 2).map((c: BridgeCandidate) => {
          const slug = tidToSlug.get(c.spiceId);
          return (
            <li
              key={c.spiceId}
              className="flex items-center gap-2.5"
              title={`${c.legs[0].evidence.score.toFixed(2)} with ${c.legs[0].spiceName}, ${c.legs[1].evidence.score.toFixed(2)} with ${c.legs[1].spiceName}`}
              {...hoverProps(slug)}
            >
              <Swatch tid={c.spiceId} size={16} />
              <span className="min-w-0 flex-1 truncate text-body text-chalk">{c.spiceName}</span>
              {slug ? (
                <AddButton
                  label={`Add ${c.spiceName}`}
                  onClick={() => {
                    setHovered(null);
                    toggleSpice(slug);
                  }}
                />
              ) : (
                <span className="text-small text-chalk-3" title="Not plotted on this map">–</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
