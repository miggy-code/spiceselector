'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { getCuratedPairings, type RankedPairing } from '@/lib/pairing-engine';
import { findBridges, findWeakestPair, type BridgeCandidate } from '@/lib/bridge-finder';
import { spiceName } from '@/lib/spice-list';
import { toTaxonomyId } from '@/lib/spice-id-map';
import { spiceColor } from '@/lib/spice-colors';
import WhyDetails from './WhyPopover';
import SurpriseSection from './SurpriseSection';
import BlendSection from './BlendSection';
import DishSection from './DishSection';
import SavedBlendsList from './SavedBlendsList';
import ClassicBlendHint from './ClassicBlendHint';
import ClassicBlendStarters from './ClassicBlendStarters';
import { Section, Swatch, Meter, SmallButton, AFFINITY_WORDS } from './ui';
import { useRack } from '@/context/RackContext';

interface MapSpice {
  id: string;
  name: string;
  family: string;
}

interface MapPairingPanelProps {
  data: MapSpice[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  collapseOnMobile?: boolean;
  onLayoutChange?: (insets: { right: number; bottom: number }) => void;
  /** Open the Substitution Finder focused on this spice (slug id). */
  onFindSubstitutes?: (slug: string) => void;
}

const SUGGESTIONS_SHOWN = 8;

/** Thresholds for calling a signal "strong" — each is roughly its top quartile. */
function strongSignals(p: RankedPairing) {
  return {
    recipes: p.affinityScore !== null && p.affinityScore >= 0.7,
    chemistry: p.compoundOverlap !== null && p.compoundOverlap.compoundScore >= 0.66,
    tradition: p.affinity === 'classic',
  };
}

export default function MapPairingPanel({ data, onFindSubstitutes, onLayoutChange, collapsed, onCollapsedChange, collapseOnMobile }: MapPairingPanelProps) {
  const { selectedSpiceIds, toggleSpice, clearSelection } = useSelection();
  const { rackIds, rackOnly } = useRack();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapseOnMobile) return;
    const media = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => { if (event.matches) onCollapsedChange(true); };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [collapseOnMobile, onCollapsedChange]);

  useEffect(() => {
    const element = panelRef.current;
    if (!element || !onLayoutChange) return;
    const reportSize = () => {
      const { width, height } = element.getBoundingClientRect();
      onLayoutChange(window.matchMedia('(min-width: 768px)').matches
        ? { right: Math.ceil(width), bottom: 0 }
        : { right: 0, bottom: Math.ceil(height) });
    };
    const observer = new ResizeObserver(reportSize);
    observer.observe(element);
    window.addEventListener('resize', reportSize);
    reportSize();
    return () => { observer.disconnect(); window.removeEventListener('resize', reportSize); };
  }, [onLayoutChange]);

  const { slugToTid, tidToSlug, slugToSpice } = useMemo(() => {
    const slugToTid = new Map<string, string>();
    const tidToSlug = new Map<string, string>();
    const slugToSpice = new Map<string, MapSpice>();
    for (const d of data) {
      slugToSpice.set(d.id, d);
      const tid = toTaxonomyId(d.id, d.name);
      if (tid) {
        slugToTid.set(d.id, tid);
        if (!tidToSlug.has(tid)) tidToSlug.set(tid, d.id);
      }
    }
    return { slugToTid, tidToSlug, slugToSpice };
  }, [data]);

  const selectedTaxonomyIds = useMemo(() => {
    const set = new Set<string>();
    for (const slug of selectedSpiceIds) {
      const tid = slugToTid.get(slug);
      if (tid) set.add(tid);
    }
    return set;
  }, [selectedSpiceIds, slugToTid]);

  const allSuggestions = useMemo(() => getCuratedPairings(selectedTaxonomyIds), [selectedTaxonomyIds]);

  const suggestions = useMemo(() => {
    if (!rackOnly) return allSuggestions;
    return allSuggestions.filter((p) => {
      const slug = tidToSlug.get(p.spiceId);
      return !!slug && rackIds.has(slug);
    });
  }, [allSuggestions, rackOnly, rackIds, tidToSlug]);
  const rackHiddenCount = allSuggestions.length - suggestions.length;

  const bridge = useMemo(() => {
    const ids = Array.from(selectedTaxonomyIds);
    if (ids.length < 2) return null;
    const weakest = findWeakestPair(ids);
    if (!weakest) return null;
    const analysis = findBridges(weakest.a, weakest.b, { excludeIds: ids, limit: 3 });
    if (!analysis.needsBridge || analysis.bridges.length === 0) return null;
    return analysis;
  }, [selectedTaxonomyIds]);

  const selectedList = useMemo(
    () => Array.from(selectedSpiceIds).map((slug) => slugToSpice.get(slug)).filter(Boolean) as MapSpice[],
    [selectedSpiceIds, slugToSpice]
  );

  const hasSelection = selectedSpiceIds.size > 0;
  const blendTids = Array.from(selectedTaxonomyIds);

  const slugFamilies = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data) map.set(d.id, d.family);
    return map;
  }, [data]);

  return (
    <div
      ref={panelRef}
      className="pointer-events-none absolute right-0 top-0 z-20 flex h-full items-stretch max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-auto max-md:flex-col"
    >
      {/* Collapse handle — desktop: tab on the panel edge; mobile: sheet grab bar */}
      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="pointer-events-auto -mr-px grid h-14 w-7 place-items-center self-center rounded-l-lg border border-r-0 border-rule bg-board-raised text-chalk-2 shadow-[-6px_0_16px_rgba(0,0,0,0.25)] transition-colors hover:text-chalk max-md:mr-0 max-md:flex max-md:w-full max-md:items-center max-md:justify-center max-md:gap-3 max-md:self-auto max-md:rounded-none max-md:rounded-t-xl max-md:border-x-0 max-md:border-b-0 max-md:border-t max-md:py-2"
        aria-label={collapsed ? 'Show pairings' : 'Hide pairings'}
        aria-expanded={!collapsed}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`hidden transition-transform duration-200 md:block ${collapsed ? 'rotate-180' : ''}`}><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="block h-1 w-10 rounded-full bg-chalk-3 md:hidden" aria-hidden />
        {collapsed && (
          <span className="text-small text-chalk-2 md:hidden">
            {hasSelection ? `Pairings for ${selectedList.map((s) => s.name).join(', ')}` : 'Pairings'}
          </span>
        )}
      </button>

      {!collapsed && hasSelection && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-t from-black/45 via-black/15 to-transparent md:hidden" />
      )}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.aside
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-auto flex h-full w-[360px] flex-col border-l border-rule bg-board-raised max-md:h-[52vh] max-md:w-full max-md:border-l-0"
            aria-label="Pairings"
          >
            {/* Header + selection */}
            <div className="shrink-0 px-5 pb-4 pt-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-heading leading-none text-chalk">
                  {hasSelection ? 'Pairs well with' : 'Pairings'}
                </h2>
                {hasSelection && (
                  <button type="button" onClick={clearSelection} className="text-small text-chalk-3 underline-offset-2 hover:text-chalk hover:underline">
                    Clear
                  </button>
                )}
              </div>
              {hasSelection ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpice(s.id)}
                      className="rise-in group flex h-9 items-center gap-2 rounded-full bg-board pl-1.5 pr-3 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.16)] transition-[box-shadow,background-color] duration-150 hover:bg-board-high hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.3)]"
                      title={`Remove ${s.name}`}
                    >
                      <Swatch color={spiceColor(s.id, s.name, s.family)} size={24} />
                      <span className="text-body text-chalk">{s.name}</span>
                      <span aria-hidden className="text-small text-chalk-3 group-hover:text-chalk">✕</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-body leading-snug text-chalk-2">
                  Choose a spice on the map, or start from a blend below. Every suggestion shows its evidence: recipes, chemistry and tradition.
                </p>
              )}
              {onFindSubstitutes && selectedList.length === 1 && (
                <button
                  type="button"
                  onClick={() => onFindSubstitutes(selectedList[0].id)}
                  className="mt-2.5 text-small text-chalk-3 underline-offset-2 hover:text-chalk hover:underline"
                >
                  Out of {selectedList[0].name}? See what can replace it
                </button>
              )}
            </div>

            {/* One scroll container for everything below the header */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {!hasSelection ? (
                <>
                  <ClassicBlendStarters tidToSlug={tidToSlug} />
                  <SavedBlendsList slugFamilies={slugFamilies} />
                  <DishSection tidToSlug={tidToSlug} selectedTids={selectedTaxonomyIds} />
                  <SurpriseSection tidToSlug={tidToSlug} selectedTaxonomyIds={selectedTaxonomyIds} />
                </>
              ) : (
                <>
                  <Suggestions
                    suggestions={suggestions}
                    rackOnly={rackOnly}
                    rackHiddenCount={rackHiddenCount}
                    tidToSlug={tidToSlug}
                    onAdd={(slug) => toggleSpice(slug)}
                  />

                  {blendTids.length >= 2 && <BlendSection selectedTids={blendTids} tidToSlug={tidToSlug} />}

                  {bridge && (
                    <Section
                      title="Bridge the weakest link"
                      description={
                        <>
                          {spiceName(bridge.a)} and {spiceName(bridge.b)}{' '}
                          {bridge.direct ? `score only ${bridge.direct.score.toFixed(2)} together.` : 'have no shared evidence.'} These connect both.
                        </>
                      }
                    >
                      <ul className="grid gap-2">
                        {bridge.bridges.map((c: BridgeCandidate) => {
                          const slug = tidToSlug.get(c.spiceId);
                          return (
                            <li key={c.spiceId} className="flex items-center gap-3">
                              <Swatch tid={c.spiceId} size={16} />
                              <div className="min-w-0 flex-1">
                                <p className="text-body text-chalk">
                                  {c.spiceName}
                                  {c.gain > 0 && <span className="ml-2 text-small text-chalk-3">+{c.gain.toFixed(2)} over direct</span>}
                                </p>
                                <p className="text-small text-chalk-3">
                                  {c.legs[0].evidence.score.toFixed(2)} with {c.legs[0].spiceName}, {c.legs[1].evidence.score.toFixed(2)} with {c.legs[1].spiceName}
                                </p>
                              </div>
                              {slug ? (
                                <SmallButton onClick={() => toggleSpice(slug)}>Add</SmallButton>
                              ) : (
                                <span className="text-small text-chalk-3" title="Not plotted on this map">Not on map</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </Section>
                  )}

                  {blendTids.length >= 2 && <ClassicBlendHint selectedTids={blendTids} tidToSlug={tidToSlug} />}
                  <DishSection tidToSlug={tidToSlug} selectedTids={selectedTaxonomyIds} />
                  <SurpriseSection tidToSlug={tidToSlug} selectedTaxonomyIds={selectedTaxonomyIds} />
                </>
              )}
              <p className="border-t border-rule px-5 pb-8 pt-4 text-micro leading-relaxed text-chalk-3">
                Recipes: FlavorGraph (Park et al. 2021). Chemistry: FlavorDB2, FooDB, USDA Dr. Duke&apos;s. Tradition: curated labels.
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function Suggestions({
  suggestions,
  rackOnly,
  rackHiddenCount,
  tidToSlug,
  onAdd,
}: {
  suggestions: RankedPairing[];
  rackOnly: boolean;
  rackHiddenCount: number;
  tidToSlug: Map<string, string>;
  onAdd: (slug: string) => void;
}) {
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  if (suggestions.length === 0) {
    return (
      <p className="px-5 pb-5 text-body text-chalk-2">
        {rackOnly && rackHiddenCount > 0
          ? `All ${rackHiddenCount} suggestions are spices you haven't marked as owned. Turn off "Only suggest what I have" in Filters to see them.`
          : 'No curated pairings for this selection yet.'}
      </p>
    );
  }
  const shown = suggestions.slice(0, SUGGESTIONS_SHOWN);
  return (
    <section className="px-5 pb-5" aria-label="Suggested pairings">
      <div className="mb-1 grid grid-cols-[1fr_46px_46px_32px] gap-x-3 border-b border-rule pb-2 text-micro text-chalk-2 [&>span:nth-child(n+2)]:text-right">
        <span>
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
          {rackOnly && rackHiddenCount > 0 ? `, ${rackHiddenCount} not on your shelf` : ''}
        </span>
        <span title="FlavorGraph: how often they meet in ~1M recipes">Recipes</span>
        <span title="Shared aroma molecules (FlavorDB2, FooDB, USDA)">Chemistry</span>
        <span />
      </div>
      <ul key={shown.map((p) => p.spiceId).join("|")} className="">
        {shown.map((p, i) => {
          const slug = tidToSlug.get(p.spiceId);
          const strong = strongSignals(p);
          const agree = Number(strong.recipes) + Number(strong.chemistry) + Number(strong.tradition);
          return (
            <li
              key={p.spiceId}
              className={`rise-in -mx-2 my-1 rounded-xl px-2 py-0.5 transition-colors duration-200 ${openWhy === p.spiceId ? 'bg-board-high/60 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.1)]' : ''}`}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpenWhy(openWhy === p.spiceId ? null : p.spiceId)}
                  aria-expanded={openWhy === p.spiceId}
                  title="Show the evidence"
                  className={`-ml-2 grid min-w-0 flex-1 grid-cols-[1fr_46px_46px] items-center gap-x-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 ${
                    openWhy === p.spiceId ? '' : 'hover:bg-board-high/70'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Swatch tid={p.spiceId} size={22} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-body font-medium text-chalk">{p.spiceName}</span>
                        <svg
                          width="10" height="10" viewBox="0 0 10 10" aria-hidden
                          className={`shrink-0 text-chalk-3 transition-transform duration-200 ${openWhy === p.spiceId ? 'rotate-180' : ''}`}
                        >
                          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="block text-micro leading-snug text-chalk-2">
                        {AFFINITY_WORDS[p.affinity]}
                        {p.matchCount > 1 ? `, ${p.matchCount} of yours` : ''}
                      </span>
                      {agree === 3 && <span className="block text-micro font-medium leading-snug text-chalk">Strong on all three</span>}
                    </span>
                  </span>
                  <EvidenceCell value={p.affinityScore} strong={strong.recipes} />
                  <EvidenceCell value={p.compoundOverlap?.compoundScore ?? null} strong={strong.chemistry} />
                </button>
                {slug ? (
                  <button
                    type="button"
                    onClick={() => onAdd(slug)}
                    aria-label={`Add ${p.spiceName} to your blend`}
                    title={`Add ${p.spiceName} to your blend`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-board-high text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.16)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-chalk hover:text-board active:scale-90"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                  </button>
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center text-micro text-chalk-3" title="Not on the map yet">–</span>
                )}
              </div>
              {openWhy === p.spiceId && <div className="pb-3 pl-[34px]"><WhyDetails pairing={p} /></div>}
            </li>
          );
        })}
      </ul>
      {suggestions.length > SUGGESTIONS_SHOWN && (
        <p className="pt-2 text-small text-chalk-3">
          {suggestions.length - SUGGESTIONS_SHOWN} more with weaker evidence. Add a spice to refine the list.
        </p>
      )}
    </section>
  );
}

function EvidenceCell({ value, strong }: { value: number | null; strong: boolean }) {
  if (value === null) return <span className="text-right text-small text-chalk-3" title="No data for this pair">—</span>;
  return (
    <span className="grid gap-1 text-right" title={value.toFixed(2)}>
      <span className={`text-small ${strong ? 'font-semibold text-chalk' : 'text-chalk-2'}`}>{value.toFixed(2)}</span>
      <Meter value={value} muted={!strong} />
    </span>
  );
}
