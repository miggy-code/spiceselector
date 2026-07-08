'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { View, HeatLevel } from '@/components/MapClientLoader';
import { useRack } from '@/context/RackContext';

const HEAT_LEVELS: { level: HeatLevel; label: string; icon: string }[] = [
  { level: 'mild', label: 'Mild', icon: '○' },
  { level: 'medium', label: 'Medium', icon: '◑' },
  { level: 'hot', label: 'Hot', icon: '●' },
  { level: 'extreme', label: 'Extreme', icon: '🔥' },
];

const VIEWS: { id: View; label: string; description: string; icon: string }[] = [
  {
    id: '3d-map',
    label: 'Flavor Map',
    description: '3D interactive space',
    icon: '✦',
  },
  {
    id: '2d-map',
    label: 'Scatter Plot',
    description: '2D axis comparison',
    icon: '⊹',
  },
  {
    id: 'substitutions',
    label: 'Substitution Finder',
    description: 'Find spice swaps',
    icon: '⇄',
  },
];

interface NavDrawerProps {
  currentView: View;
  onViewChange: (view: View) => void;
  heatFilter: Set<HeatLevel>;
  onHeatToggle: (level: HeatLevel) => void;
  spiceCount: number;
  familyCount: number;
  cuisines: string[];
  cuisineFilter: string | null;
  onCuisineChange: (cuisine: string | null) => void;
}

export default function NavDrawer({
  currentView,
  onViewChange,
  heatFilter,
  onHeatToggle,
  spiceCount,
  familyCount,
  cuisines,
  cuisineFilter,
  onCuisineChange,
}: NavDrawerProps) {
  const [open, setOpen] = useState(false);
  const { rackIds, rackOnly, setRackOnly } = useRack();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleViewChange = (view: View) => {
    onViewChange(view);
    setOpen(false);
  };

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all"
        aria-label="Open menu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="3" width="14" height="1.5" rx="0.75" />
          <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" />
          <rect x="1" y="11.5" width="14" height="1.5" rx="0.75" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-neutral-950 border-r border-white/10 flex flex-col transform transition-transform duration-250 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <div>
            <div className="text-white font-semibold tracking-tight text-sm">SpiceSelection</div>
            <div className="text-white/30 text-xs mt-0.5">Flavor intelligence</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/8 transition-colors"
            aria-label="Close menu"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
        {/* Views */}
        <div className="px-3 pt-4 pb-2">
          <div className="text-white/30 text-[10px] uppercase tracking-widest px-2 mb-2">Views</div>
          <div className="flex flex-col gap-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => handleViewChange(v.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  currentView === v.id
                    ? 'bg-[#ffc107]/15 text-[#ffc107]'
                    : 'text-white/60 hover:text-white hover:bg-white/6'
                }`}
              >
                <span className="text-base w-5 text-center leading-none">{v.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{v.label}</div>
                  <div className={`text-[11px] mt-0.5 ${currentView === v.id ? 'text-[#ffc107]/60' : 'text-white/30'}`}>
                    {v.description}
                  </div>
                </div>
                {currentView === v.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ffc107] shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 my-2 border-t border-white/8" />

        {/* Heat filter */}
        <div className="px-3 pb-4">
          <div className="text-white/30 text-[10px] uppercase tracking-widest px-2 mb-2">
            Heat level
          </div>
          <div className="flex flex-col gap-0.5">
            {HEAT_LEVELS.map(({ level, label, icon }) => {
              const active = heatFilter.has(level);
              return (
                <button
                  key={level}
                  onClick={() => onHeatToggle(level)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    active
                      ? 'text-white/80 hover:bg-white/6'
                      : 'text-white/25 hover:text-white/50 hover:bg-white/4'
                  }`}
                >
                  <span className="w-5 text-center text-sm leading-none">{icon}</span>
                  <span className="text-sm">{label}</span>
                  <div className={`ml-auto w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    active ? 'border-white/40 bg-white/10' : 'border-white/15'
                  }`}>
                    {active && (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1.5 4.5l2 2 4-4" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {heatFilter.size < 4 && (
            <button
              onClick={() => {
                ['mild', 'medium', 'hot', 'extreme'].forEach((l) => {
                  if (!heatFilter.has(l as HeatLevel)) onHeatToggle(l as HeatLevel);
                });
              }}
              className="mt-2 w-full text-center text-[11px] text-white/30 hover:text-white/50 transition-colors py-1"
            >
              Show all heat levels
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 my-2 border-t border-white/8" />

        {/* Cuisine lens */}
        <div className="px-3 pb-4">
          <div className="text-white/30 text-[10px] uppercase tracking-widest px-2 mb-2">
            Cuisine lens
          </div>
          <div className="flex flex-wrap gap-1.5 px-2">
            <button
              onClick={() => onCuisineChange(null)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                cuisineFilter === null
                  ? 'bg-[#ffc107]/15 border-[#ffc107]/40 text-[#ffc107]'
                  : 'border-white/12 text-white/45 hover:text-white/80 hover:border-white/25'
              }`}
            >
              All
            </button>
            {cuisines.map((c) => (
              <button
                key={c}
                onClick={() => onCuisineChange(cuisineFilter === c ? null : c)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  cuisineFilter === c
                    ? 'bg-[#ffc107]/15 border-[#ffc107]/40 text-[#ffc107]'
                    : 'border-white/12 text-white/45 hover:text-white/80 hover:border-white/25'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 my-2 border-t border-white/8" />

        {/* My rack */}
        <div className="px-3 pb-4">
          <div className="text-white/30 text-[10px] uppercase tracking-widest px-2 mb-2">
            My rack · {rackIds.size} spice{rackIds.size !== 1 ? 's' : ''}
          </div>
          <button
            onClick={() => setRackOnly(!rackOnly)}
            role="switch"
            aria-checked={rackOnly}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-white/60 hover:text-white hover:bg-white/6"
          >
            <span className="text-sm flex-1">Only show my rack</span>
            <span
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex ${
                rackOnly ? 'bg-emerald-500/70 justify-end' : 'bg-white/15 justify-start'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-white block" />
            </span>
          </button>
          <p className="px-3 mt-1 text-[10px] text-white/25 leading-relaxed">
            Mark what you own in the Substitution Finder list; suggestions and
            substitutes then stick to your shelf.
          </p>
        </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-5 py-4 border-t border-white/8">
          <div className="text-white/20 text-[10px]">
            {spiceCount} spices · {familyCount} families
          </div>
          <div className="text-white/15 text-[9px] mt-1">
            Pairing data: FlavorGraph (Park 2021) · Ahn 2011 · USDA
          </div>
        </div>
      </div>
    </>
  );
}
