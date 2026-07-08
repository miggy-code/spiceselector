'use client';

import dynamic from 'next/dynamic';
import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import NavDrawer from '@/components/NavDrawer';
import SubstitutionView from '@/components/SubstitutionView';
import MapPairingPanel from '@/components/pairing/MapPairingPanel';
import SpiceSearch from '@/components/SpiceSearch';
import { useSelection } from '@/context/SelectionContext';
import { parseBlendParam } from '@/lib/blend-url';

const FlavorMap3D = dynamic(() => import('@/components/FlavorMap3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#ffc107] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white/40 text-sm tracking-widest uppercase">Loading Flavor Space...</div>
      </div>
    </div>
  ),
});

const FlavorMap2D = dynamic(() => import('@/components/FlavorMap2D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#ffc107] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white/40 text-sm tracking-widest uppercase">Loading Flavor Map...</div>
      </div>
    </div>
  ),
});

export type View = '3d-map' | '2d-map' | 'substitutions';
export type HeatLevel = 'mild' | 'medium' | 'hot' | 'extreme';

const ALL_HEAT_LEVELS: HeatLevel[] = ['mild', 'medium', 'hot', 'extreme'];

interface MapClientLoaderProps {
  data: any[];
}

export default function MapClientLoader({ data }: MapClientLoaderProps) {
  const [currentView, setCurrentView] = useState<View>('3d-map');
  const [heatFilter, setHeatFilter] = useState<Set<HeatLevel>>(new Set(ALL_HEAT_LEVELS));
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  // Set when the pairing panel hands a spice off to the Substitution Finder.
  const [substitutionFocus, setSubstitutionFocus] = useState<string | null>(null);
  const { selectedSpiceIds, selectSpices } = useSelection();

  // Shared-blend links (?b=cinnamon~cumin): select the blend on first load.
  useEffect(() => {
    const shared = parseBlendParam(window.location.search);
    if (!shared) return;
    const known = new Set(data.map((d) => d.id as string));
    const slugs = shared.slugs.filter((s) => known.has(s));
    if (slugs.length > 0) selectSpices(slugs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First-visit hint: shown until the user makes their first selection.
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    if (selectedSpiceIds.size > 0) setHintDismissed(true);
  }, [selectedSpiceIds]);

  const toggleHeat = (level: HeatLevel) => {
    setHeatFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const filteredData = useMemo(() => {
    let result = data;
    if (heatFilter.size !== ALL_HEAT_LEVELS.length) {
      result = result.filter((d) => {
        const level = (d.heat_level as HeatLevel) || 'mild';
        return heatFilter.has(level);
      });
    }
    if (cuisineFilter) {
      result = result.filter((d) => (d.cuisine_names as string[])?.includes(cuisineFilter));
    }
    return result;
  }, [data, heatFilter, cuisineFilter]);

  const familyCount = useMemo(() => new Set(data.map((d) => d.family)).size, [data]);

  // Cuisines worth filtering by: enough spices that the lensed map isn't empty.
  const cuisines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of data) {
      for (const c of (d.cuisine_names as string[]) ?? []) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .filter(([, n]) => n >= 4)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [data]);

  const showHint =
    !hintDismissed && currentView !== 'substitutions' && selectedSpiceIds.size === 0;

  return (
    <div className="relative w-full h-full bg-black">
      <NavDrawer
        currentView={currentView}
        onViewChange={setCurrentView}
        heatFilter={heatFilter}
        onHeatToggle={toggleHeat}
        spiceCount={data.length}
        familyCount={familyCount}
        cuisines={cuisines}
        cuisineFilter={cuisineFilter}
        onCuisineChange={setCuisineFilter}
      />

      {/* Active lens badge */}
      {cuisineFilter && currentView !== 'substitutions' && (
        <button
          type="button"
          onClick={() => setCuisineFilter(null)}
          className="absolute top-4 left-16 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffc107]/12 border border-[#ffc107]/35 text-[#ffc107] text-[11px] hover:bg-[#ffc107]/20 transition-colors"
          title="Clear cuisine lens"
        >
          {cuisineFilter} lens · {filteredData.length} spices
          <span className="text-[#ffc107]/70">×</span>
        </button>
      )}

      {currentView === '3d-map' && <FlavorMap3D data={filteredData} />}
      {currentView === '2d-map' && (
        <div className="w-full h-full overflow-auto">
          <FlavorMap2D data={filteredData} />
        </div>
      )}
      {currentView === 'substitutions' && (
        <SubstitutionView
          data={data}
          initialFocusId={substitutionFocus}
          onViewInMap={() => setCurrentView('3d-map')}
        />
      )}

      {/* First-visit hint */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 1.2, duration: 0.5 } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.25 } }}
            className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 z-30"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur border border-cyan-400/25 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              <span className="text-[12px] text-white/75">
                Click a glowing spice to reveal its pairings
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spice search palette */}
      {currentView !== 'substitutions' && (
        <SpiceSearch data={data} />
      )}

      {/* Unified pairing panel — overlays both map views */}
      {currentView !== 'substitutions' && (
        <MapPairingPanel
          data={data}
          onFindSubstitutes={(slug) => {
            setSubstitutionFocus(slug);
            setCurrentView('substitutions');
          }}
        />
      )}
    </div>
  );
}
