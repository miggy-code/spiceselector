'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FlavorMap2D from './FlavorMap2D';
import FlavorAtlas from './FlavorAtlas';
import type { SpiceProfile } from '@/types/spice';

interface Props {
  data: SpiceProfile[];
  panelInsets: { right: number; bottom: number };
  cuisine: string | null;
}

const MODES = [
  { id: 'atlas', label: 'Neighborhoods', blurb: 'Spices with similar overall flavor sit together.' },
  { id: 'axes', label: 'Two flavors', blurb: 'Compare any two flavor qualities directly.' },
] as const;

export default function FlavorExplorer2D({ data, panelInsets, cuisine }: Props) {
  const [view, setView] = useState<'atlas' | 'axes'>('atlas');
  const mode = MODES.find((m) => m.id === view)!;
  return (
    <section
      className="slate flex h-full min-h-0 flex-col text-chalk"
      style={{ paddingRight: panelInsets.right, paddingBottom: panelInsets.bottom }}
      aria-label="Flavor atlas"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pb-2 pt-5 md:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-heading leading-tight text-chalk">
            {cuisine ? `${data.length} spices of ${cuisine} cooking` : `${data.length} spices`}
          </h2>
          <p className="mt-0.5 text-body text-chalk-2">{mode.blurb}</p>
        </div>
        <div className="relative flex rounded-lg bg-board-high p-1 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.12)]" role="group" aria-label="Map type">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={view === m.id}
              onClick={() => setView(m.id)}
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
      {/* Keep both mounted so each view's settings survive the toggle. */}
      <div className="min-h-0 flex-1" hidden={view !== 'atlas'}><FlavorAtlas data={data} /></div>
      <div className="min-h-0 flex-1" hidden={view !== 'axes'}><FlavorMap2D data={data} /></div>
    </section>
  );
}
