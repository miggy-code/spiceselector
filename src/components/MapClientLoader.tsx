'use client';

import dynamic from 'next/dynamic';
import React, { useState, useMemo, useEffect, useSyncExternalStore, useRef } from 'react';
import { motion } from 'framer-motion';
import NavDrawer from '@/components/NavDrawer';
import SubstitutionView from '@/components/SubstitutionView';
import MapPairingPanel from '@/components/pairing/MapPairingPanel';
import SpiceSearch from '@/components/SpiceSearch';
import { useSelection } from '@/context/SelectionContext';
import { parseBlendParam } from '@/lib/blend-url';
import type { SpiceProfile } from '@/types/spice';
import type { MapMorph } from '@/components/FlavorMap3D';
import { normalizeFamily } from '@/lib/colors';

// Read the intended SVG positions, including the endpoint of any CSS movement.
function captureAtlasTargets(layer: HTMLDivElement, stage: DOMRect): MapMorph['targets'] {
  const targets: MapMorph['targets'] = new Map();
  const frames = new Map<SVGSVGElement, DOMRect>();
  layer.querySelectorAll<SVGGElement>('[data-spice-id]').forEach(node => {
    if (node.closest('[hidden]')) return;
    const circle = node.querySelector<SVGCircleElement>('.atlas-dot circle');
    const svg = node.ownerSVGElement;
    if (!circle || !svg) return;
    const rect = frames.get(svg) ?? svg.getBoundingClientRect();
    frames.set(svg, rect);
    const box = svg.viewBox.baseVal;
    if (!box.width || !box.height) return;
    const position = new DOMMatrix(node.style.transform);
    const scale = Math.min(rect.width / box.width, rect.height / box.height);
    const left = rect.left + (rect.width - box.width * scale) / 2;
    const top = rect.top + (rect.height - box.height * scale) / 2;
    targets.set(node.dataset.spiceId!, {
      x: ((left + (position.m41 - box.x) * scale - stage.left) / stage.width) * 2 - 1,
      y: 1 - ((top + (position.m42 - box.y) * scale - stage.top) / stage.height) * 2,
      radius: circle.r.baseVal.value * scale,
      opacity: Number(node.style.opacity || 1),
    });
  });
  return targets;
}

function ViewLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-board">
      <p className="font-display text-title text-chalk-3">{label}</p>
    </div>
  );
}

const FlavorMap3D = dynamic(() => import('@/components/FlavorMap3D'), {
  ssr: false,
  loading: () => <ViewLoading label="Setting out the spices…" />,
});

const FlavorExplorer2D = dynamic(() => import('@/components/FlavorExplorer2D'), {
  ssr: false,
  loading: () => <ViewLoading label="Drawing the atlas…" />,
});

export type View = '3d-map' | '2d-map';
export type HeatLevel = 'mild' | 'medium' | 'hot' | 'extreme';

const ALL_HEAT_LEVELS: HeatLevel[] = ['mild', 'medium', 'hot', 'extreme'];

const VIEWS: { id: View; label: string }[] = [
  { id: '3d-map', label: 'Map' },
  { id: '2d-map', label: 'Atlas' },
];

interface MapClientLoaderProps {
  data: SpiceProfile[];
}

export default function MapClientLoader({ data }: MapClientLoaderProps) {
  const morph = useRef<MapMorph>({ progress: 0, active: false, targets: new Map() });
  const mapLayer = useRef<HTMLDivElement>(null);
  const atlasLayer = useRef<HTMLDivElement>(null);
  const animation = useRef<number>(0);
  const [transitioning, setTransitioning] = useState(false);
  useEffect(() => () => cancelAnimationFrame(animation.current), []);
  const [currentView, setCurrentView] = useState<View>('3d-map');
  const [heatFilter, setHeatFilter] = useState<Set<HeatLevel>>(new Set(ALL_HEAT_LEVELS));
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [panelInsets, setPanelInsets] = useState({ right: 360, bottom: 0 });
  const isMobile = useMediaQuery('(max-width: 767px)');
  useEffect(() => {
    if (!morph.current.active) return;
    const frame = requestAnimationFrame(() => {
      const stage = mapLayer.current?.getBoundingClientRect();
      if (stage && atlasLayer.current && morph.current.active) {
        morph.current.targets = captureAtlasTargets(atlasLayer.current, stage);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [panelInsets]);
  // null = follow the default: on phones the pairings sheet stays tucked away
  // until the first spice is chosen, so the map gets the screen.
  const [collapsedPref, setCollapsedPref] = useState<boolean | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Set when the pairing panel hands a spice off to the Substitution Finder.
  const [substitutionFocus, setSubstitutionFocus] = useState<string | null>(null);
  const [substitutionsOpen, setSubstitutionsOpen] = useState(false);
  const { selectedSpiceIds, selectSpices } = useSelection();

  // Shared-blend links (?b=cinnamon~cumin): select the blend on first load.
  useEffect(() => {
    const shared = parseBlendParam(window.location.search);
    if (!shared) return;
    const known = new Set(data.map((d) => d.id));
    const slugs = shared.slugs.filter((s) => known.has(s));
    if (slugs.length > 0) selectSpices(slugs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleHeat = (level: HeatLevel) => {
    setHeatFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
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
      result = result.filter((d) => heatFilter.has(((d.heat_level as HeatLevel) || 'mild')));
    }
    if (cuisineFilter) {
      result = result.filter((d) => d.cuisine_names.includes(cuisineFilter));
    }
    return result;
  }, [data, heatFilter, cuisineFilter]);

  const familyCount = useMemo(() => new Set(data.map((d) => normalizeFamily(d.family))).size, [data]);

  // Cuisines worth filtering by: enough spices that the lensed map isn't empty.
  const cuisines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of data) for (const c of d.cuisine_names) counts.set(c, (counts.get(c) ?? 0) + 1);
    return Array.from(counts.entries())
      .filter(([, n]) => n >= 4)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [data]);

  const activeFilterCount =
    (heatFilter.size !== ALL_HEAT_LEVELS.length ? 1 : 0) + (cuisineFilter ? 1 : 0);

  const pairingCollapsed = collapsedPref ?? (isMobile && selectedSpiceIds.size === 0);
  const setPairingCollapsed = setCollapsedPref;

  function changeView(view: View) {
    setSubstitutionsOpen(false);
    if (view === currentView) return;
    cancelAnimationFrame(animation.current);
    const stage = mapLayer.current?.getBoundingClientRect();
    if (stage && atlasLayer.current) {
      if (!morph.current.active) {
        morph.current.targets = captureAtlasTargets(atlasLayer.current, stage);
      }
      // This deliberately requested view transformation preserves spatial
      // continuity even when the system suppresses incidental UI animation.
      if (morph.current.targets.size > 0) {
        const from = morph.current.progress;
        const to = view === '2d-map' ? 1 : 0;
        const started = performance.now();
        const duration = 950 * Math.max(0.25, Math.abs(to - from));
        morph.current.active = true;
        setTransitioning(true);
        setCurrentView(view);
        const tick = (now: number) => {
          const t = Math.min(1, (now - started) / duration);
          const eased = t * t * (3 - 2 * t);
          const p = from + (to - from) * eased;
          morph.current.progress = p;
          if (mapLayer.current) mapLayer.current.dataset.morphProgress = p.toFixed(3);
          // The geometry completes the entire move before the SVG takes over.
          const atlasOpacity = 0;
          if (mapLayer.current) mapLayer.current.style.opacity = String(1 - atlasOpacity);
          if (atlasLayer.current) atlasLayer.current.style.opacity = String(atlasOpacity);
          if (t < 1) animation.current = requestAnimationFrame(tick);
          else {
            // Give WebGL a complete frame at the exact flat/expanded endpoint
            // before handing interaction over to the destination view.
            animation.current = requestAnimationFrame(() => {
              animation.current = requestAnimationFrame(() => {
                morph.current.active = false;
                setTransitioning(false);
                if (mapLayer.current) mapLayer.current.style.opacity = '1';
                if (atlasLayer.current) atlasLayer.current.style.opacity = view === '2d-map' ? '1' : '0';
                if (view === '2d-map' && isMobile) setPairingCollapsed(true);
              });
            });
          }
        };
        animation.current = requestAnimationFrame(tick);
        return;
      }
    }
    morph.current.progress = view === '2d-map' ? 1 : 0;
    morph.current.active = false;
    setTransitioning(false);
    setCurrentView(view);
    if (view === '2d-map' && isMobile) setPairingCollapsed(true);
  }

  return (
    <div className="flex h-full w-full flex-col bg-board text-chalk">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-6 border-b border-rule bg-board px-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)] md:px-5">
        <h1 className="font-display text-[23px] leading-none text-chalk">Spice Selector</h1>

        <nav aria-label="Views" className="hidden h-full items-stretch gap-1 md:flex">
          {VIEWS.map((v) => (
            <ViewTab key={v.id} active={currentView === v.id} onClick={() => changeView(v.id)}>
              {v.label}
            </ViewTab>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SpiceSearch data={data} inline />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex h-9 items-center gap-2 rounded-md bg-board-high px-3 text-small font-medium text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.14)] transition-[box-shadow,background-color] duration-150 hover:bg-[#424950] hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.28)] active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <path d="M1.5 3.5h11M3.5 7h7M5.5 10.5h3" />
            </svg>
            <span className="max-sm:sr-only">Filters</span>
            {activeFilterCount > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-chalk px-1 text-micro font-semibold text-board">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile view tabs */}
      <nav aria-label="Views" className="relative z-40 flex h-11 shrink-0 items-stretch border-b border-rule bg-board px-2 md:hidden">
        {VIEWS.map((v) => (
          <ViewTab key={v.id} active={currentView === v.id} onClick={() => changeView(v.id)} grow>
            {v.label}
          </ViewTab>
        ))}
      </nav>

      <NavDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        heatFilter={heatFilter}
        onHeatToggle={toggleHeat}
        onHeatReset={() => setHeatFilter(new Set(ALL_HEAT_LEVELS))}
        spiceCount={data.length}
        shownCount={filteredData.length}
        familyCount={familyCount}
        cuisines={cuisines}
        cuisineFilter={cuisineFilter}
        onCuisineChange={setCuisineFilter}
      />

      {/* ── Stage ───────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Keep one WebGL scene alive; suspend its frame loop while in the atlas. */}
        <div
          ref={mapLayer}
          className={`absolute inset-0 ${transitioning ? 'map-morphing' : ''}`}
          aria-hidden={currentView !== '3d-map' || transitioning}
          inert={currentView !== '3d-map' || transitioning}
          style={{ visibility: 'visible', opacity: 1 }}
        >
          <FlavorMap3D data={filteredData} panelInsets={panelInsets} morph={morph} active={currentView === '3d-map'} transitioning={transitioning} />
        </div>
        <div
          ref={atlasLayer}
          className="absolute inset-0"
          aria-hidden={currentView !== '2d-map' || transitioning}
          inert={currentView !== '2d-map' || transitioning}
          style={{ visibility: currentView === '2d-map' || transitioning ? 'visible' : 'hidden', opacity: transitioning ? (morph.current.progress === 1 ? 1 : 0) : currentView === '2d-map' ? 1 : 0 }}
        >
          <FlavorExplorer2D data={filteredData} panelInsets={panelInsets} cuisine={cuisineFilter} />
        </div>
        {substitutionsOpen && (
          <motion.div className="absolute inset-0 z-30 bg-board" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="h-full pt-12">
              <SubstitutionView data={data} initialFocusId={substitutionFocus} onViewInMap={() => { setSubstitutionsOpen(false); changeView('3d-map'); }} />
            </div>
            <button
              type="button"
              onClick={() => setSubstitutionsOpen(false)}
              className="absolute right-4 top-2 z-10 rounded-md border border-rule-strong bg-board-high px-3 py-1.5 text-small text-chalk-2 hover:text-chalk"
              aria-label="Close substitutes and return to the map"
            >
              Return to {currentView === '3d-map' ? 'Map' : 'Atlas'}
            </button>
          </motion.div>
        )}

        {/* Active lens — a quiet, dismissible statement of what is hidden */}
        {cuisineFilter && !substitutionsOpen && (
          <button
            type="button"
            onClick={() => setCuisineFilter(null)}
            className="absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-md border border-rule-strong bg-board-raised px-3 py-1.5 text-small text-chalk max-md:bottom-auto max-md:top-3"
            title="Clear cuisine lens"
          >
            {cuisineFilter} · {filteredData.length}
            <span aria-hidden className="text-chalk-3">✕</span>
          </button>
        )}

        {!substitutionsOpen && (
          <MapPairingPanel
            data={data}
            collapsed={pairingCollapsed}
            collapseOnMobile={currentView === '2d-map'}
            onCollapsedChange={setPairingCollapsed}
            onLayoutChange={setPanelInsets}
            onFindSubstitutes={(slug) => {
              setSubstitutionFocus(slug);
              setSubstitutionsOpen(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
  grow,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center justify-center px-3.5 text-body font-medium transition-colors duration-150 ${grow ? 'flex-1' : ''} ${
        active ? 'text-chalk' : 'text-chalk-3 hover:text-chalk'
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId={grow ? 'tab-underline-mobile' : 'tab-underline'}
          aria-hidden
          className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-chalk"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        />
      )}
    </button>
  );
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
