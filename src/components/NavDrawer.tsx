'use client';

import React, { useEffect } from 'react';
import type { HeatLevel } from '@/components/MapClientLoader';
import { useRack } from '@/context/RackContext';

const HEAT_LEVELS: { level: HeatLevel; label: string; detail: string }[] = [
  { level: 'mild', label: 'Mild', detail: 'no real burn' },
  { level: 'medium', label: 'Medium', detail: 'a noticeable warmth' },
  { level: 'hot', label: 'Hot', detail: 'clear chili heat' },
  { level: 'extreme', label: 'Extreme', detail: 'use by the pinch' },
];

interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  heatFilter: Set<HeatLevel>;
  onHeatToggle: (level: HeatLevel) => void;
  onHeatReset: () => void;
  spiceCount: number;
  shownCount: number;
  familyCount: number;
  cuisines: string[];
  cuisineFilter: string | null;
  onCuisineChange: (cuisine: string | null) => void;
}

/** Filters and settings: heat, cuisine lens, "my rack", plus data credits. */
export default function NavDrawer({
  open,
  onClose,
  heatFilter,
  onHeatToggle,
  onHeatReset,
  spiceCount,
  shownCount,
  familyCount,
  cuisines,
  cuisineFilter,
  onCuisineChange,
}: FiltersDrawerProps) {
  const { rackIds, rackOnly, setRackOnly } = useRack();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-50 bg-board-deep/60" onClick={onClose} aria-hidden="true" />}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-[320px] max-w-[88vw] flex-col border-l border-rule bg-board-raised shadow-[-24px_0_48px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <div>
            <h2 className="font-display text-title text-chalk">Filters</h2>
            <p className="mt-0.5 text-small text-chalk-3">
              Showing {shownCount} of {spiceCount} spices
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-chalk-3 transition-colors hover:bg-board-high hover:text-chalk"
            aria-label="Close filters"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 pb-12 pt-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-body font-medium text-chalk">Heat</h3>
              {heatFilter.size < 4 && (
                <button onClick={onHeatReset} className="text-small text-chalk-3 underline-offset-2 hover:text-chalk hover:underline">
                  Show all
                </button>
              )}
            </div>
            <div className="grid gap-1">
              {HEAT_LEVELS.map(({ level, label, detail }, i) => {
                const active = heatFilter.has(level);
                return (
                  <label
                    key={level}
                    title={detail}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-board-high"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => onHeatToggle(level)}
                      className="h-4 w-4 accent-[#efebe4]"
                    />
                    <span className="flex gap-[3px]" aria-hidden>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <span key={j} className={`h-2.5 w-1 rounded-full ${j <= i ? 'bg-[#D1462F]' : 'bg-rule-strong'}`} />
                      ))}
                    </span>
                    <span className={`text-body ${active ? 'text-chalk' : 'text-chalk-3'}`}>{label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-body font-medium text-chalk">Cuisine</h3>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={cuisineFilter === null} onClick={() => onCuisineChange(null)}>
                Any cuisine
              </Chip>
              {cuisines.map((c) => (
                <Chip key={c} active={cuisineFilter === c} onClick={() => onCuisineChange(cuisineFilter === c ? null : c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-body font-medium text-chalk">My rack</h3>
            <p className="mb-3 text-small text-chalk-3">
              {rackIds.size === 0 ? 'Mark owned spices in Substitutes.' : `${rackIds.size} on your shelf.`}
            </p>
            <button
              onClick={() => setRackOnly(!rackOnly)}
              role="switch"
              aria-checked={rackOnly}
              className="flex w-full items-center gap-3 rounded-md border border-rule px-3 py-2 text-left transition-colors hover:border-rule-strong"
            >
              <span className="flex-1 text-body text-chalk-2">Only suggest what I have</span>
              <span className={`flex h-5 w-9 rounded-full p-0.5 transition-colors ${rackOnly ? 'justify-end bg-chalk' : 'justify-start bg-board-high'}`}>
                <span className={`block h-4 w-4 rounded-full ${rackOnly ? 'bg-board' : 'bg-chalk-3'}`} />
              </span>
            </button>
          </section>
        </div>

        <footer className="border-t border-rule px-5 py-3 text-small leading-relaxed text-chalk-3">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-chalk-2 hover:text-chalk">
              {spiceCount} spices in {familyCount} families. Data sources
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="transition-transform group-open:rotate-180"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </summary>
            <p className="mt-1.5 pb-1">
              Recipes: FlavorGraph (Park et al. 2021), CulinaryDB. Chemistry: FlavorDB2 (Garg et al. 2018), FooDB, USDA
              Dr. Duke&apos;s. Tradition: curated labels. Flavor profiles are model-generated and curated.
            </p>
          </details>
        </footer>
      </div>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-small transition-colors ${
        active ? 'border-chalk bg-chalk text-board' : 'border-rule text-chalk-2 hover:border-rule-strong hover:text-chalk'
      }`}
    >
      {children}
    </button>
  );
}
