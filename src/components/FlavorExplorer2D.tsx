'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FlavorMap2D from './FlavorMap2D';
import FlavorAtlas from './FlavorAtlas';
import { SmallButton } from '@/components/pairing/ui';
import { useSelection } from '@/context/SelectionContext';
import type { SpiceProfile } from '@/types/spice';

interface Props {
  data: SpiceProfile[];
  panelInsets: { right: number; bottom: number };
  cuisine: string | null;
}

const MODES = [
  { id: 'atlas', label: 'Neighborhoods', hint: 'Spices with similar overall flavor sit together. Position blends all five flavor qualities, so distances are approximate.' },
  { id: 'axes', label: 'Two flavors', hint: 'Compare any two flavor qualities directly. Position is the 0 to 100 score; dot size is intensity.' },
] as const;

export default function FlavorExplorer2D({ data, panelInsets, cuisine }: Props) {
  const [view, setView] = useState<'atlas' | 'axes'>('atlas');
  const [pairingFocus, setPairingFocus] = useState(true);
  const { selectedSpiceIds, setHovered } = useSelection();
  const hasSelection = data.some((s) => selectedSpiceIds.has(s.id));
  return (
    <section
      className="slate flex h-full min-h-0 flex-col text-chalk"
      style={{ paddingRight: panelInsets.right, paddingBottom: panelInsets.bottom }}
      aria-label="Flavor atlas"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-1 pt-4 md:px-6">
        <h2 className="min-w-0 font-display text-heading leading-tight text-chalk">
          {cuisine ? `${data.length} spices of ${cuisine} cooking` : `${data.length} spices`}
        </h2>
        <div className="flex items-center gap-3">
          {view === 'atlas' && hasSelection && (
            <SmallButton
              role="switch"
              aria-checked={pairingFocus}
              onClick={() => setPairingFocus((v) => !v)}
              title="Your spices sit in the middle, ringed by their strongest recipe partners. Lines show recipe partners, not flavor similarity."
            >
              {pairingFocus ? 'Show whole atlas' : 'Focus on pairings'}
            </SmallButton>
          )}
          <div className="relative flex rounded-lg bg-board-high p-1 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.12)]" role="group" aria-label="Map type">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={view === m.id}
                title={m.hint}
                onClick={() => { setView(m.id); setHovered(null); }}
                className={`relative h-8 rounded-md px-3.5 text-small font-medium transition-colors duration-150 ${
                  view === m.id ? 'text-board' : 'text-chalk-2 hover:text-chalk'
                }`}
              >
                {view === m.id && (
                  <motion.span
                    layoutId="explorer-mode"
                    className="absolute inset-0 rounded-md bg-chalk shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <span className="relative">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Keep both mounted so each view's settings survive the toggle. */}
      <div className="min-h-0 flex-1" hidden={view !== 'atlas'}><FlavorAtlas data={data} pairingFocus={pairingFocus} /></div>
      <div className="min-h-0 flex-1" hidden={view !== 'axes'}><FlavorMap2D data={data} /></div>
    </section>
  );
}
