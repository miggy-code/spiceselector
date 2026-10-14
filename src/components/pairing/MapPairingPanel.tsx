'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { getCuratedPairings, type RankedPairing } from '@/lib/pairing-engine';
import { findBridges, findWeakestPair } from '@/lib/bridge-finder';
import { toTaxonomyId } from '@/lib/spice-id-map';
import { spiceColor } from '@/lib/spice-colors';
import WhyDetails from './WhyPopover';
import SurpriseSection from './SurpriseSection';
import BlendSection from './BlendSection';
import DishSection from './DishSection';
import SavedBlendsList from './SavedBlendsList';
import ClassicBlendHint from './ClassicBlendHint';
import ClassicBlendStarters from './ClassicBlendStarters';
import BridgeRow from './BridgeRow';
import { Swatch, AddButton, SmallButton, useSpiceHover } from './ui';
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

const SUGGESTIONS_SHOWN = 6;
/** Selected chips shown before collapsing the rest into a "+N" chip (about two rows). */
const CHIPS_SHOWN = 5;

type Tab = 'pairings' | 'blend' | 'ideas';
const TABS: { id: Tab; label: string }[] = [
  { id: 'pairings', label: 'Pairings' },
  { id: 'blend', label: 'Blend' },
  { id: 'ideas', label: 'Ideas' },
];

/** Thresholds for calling a signal "strong" — each is roughly its top quartile. */
function strongSignals(p: RankedPairing) {
  return {
    recipes: p.affinityScore !== null && p.affinityScore >= 0.7,
    chemistry: p.compoundOverlap !== null && p.compoundOverlap.compoundScore >= 0.66,
    tradition: p.affinity === 'classic',
  };
}

const TRADITION_WORDS: Record<string, string> = { classic: 'Classic', complementary: 'Complementary', surprising: 'Surprising' };

export default function MapPairingPanel({ data, onFindSubstitutes, onLayoutChange, collapsed, onCollapsedChange, collapseOnMobile }: MapPairingPanelProps) {
  const { selectedSpiceIds, toggleSpice, clearSelection, setHovered } = useSelection();
  const { rackIds, rackOnly } = useRack();
  const panelRef = useRef<HTMLDivElement>(null);
  const [chosenTab, setChosenTab] = useState<Tab>('ideas');
  const [chipsExpanded, setChipsExpanded] = useState(false);

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
    const analysis = findBridges(weakest.a, weakest.b, { excludeIds: ids, limit: 2 });
    if (!analysis.needsBridge || analysis.bridges.length === 0) return null;
    return analysis;
  }, [selectedTaxonomyIds]);

  const selectedList = useMemo(
    () => Array.from(selectedSpiceIds).map((slug) => slugToSpice.get(slug)).filter(Boolean) as MapSpice[],
    [selectedSpiceIds, slugToSpice]
  );

  const hasSelection = selectedSpiceIds.size > 0;
  const blendTids = Array.from(selectedTaxonomyIds);
  const canBlend = blendTids.length >= 2;

  // Selection going 0 → some jumps to Pairings, and back to Ideas at 0; otherwise the user's tab sticks.
  const [prevHasSelection, setPrevHasSelection] = useState(hasSelection);
  if (prevHasSelection !== hasSelection) {
    setPrevHasSelection(hasSelection);
    setChosenTab(hasSelection ? 'pairings' : 'ideas');
  }
  // A tab that has become unavailable (e.g. Blend after removing spices) falls back.
  const tab: Tab = chosenTab === 'blend' && !canBlend ? (hasSelection ? 'pairings' : 'ideas')
    : chosenTab === 'pairings' && !hasSelection ? 'ideas'
    : chosenTab;
  const tabEnabled = (id: Tab) => (id === 'pairings' ? hasSelection : id === 'blend' ? canBlend : true);

  const slugFamilies = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data) map.set(d.id, d.family);
    return map;
  }, [data]);

  const overflowChips = selectedList.length > CHIPS_SHOWN + 1;
  const visibleChips = overflowChips && !chipsExpanded ? selectedList.slice(0, CHIPS_SHOWN) : selectedList;

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
            onMouseLeave={() => setHovered(null)}
            className="pointer-events-auto flex h-full w-[360px] flex-col border-l border-rule bg-board-raised max-md:h-[52vh] max-md:w-full max-md:border-l-0"
            aria-label="Pairings"
          >
            {/* Header + selection */}
            <div className="shrink-0 px-5 pb-3 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-heading leading-none text-chalk">
                  {hasSelection ? 'Your spices' : 'Pairings'}
                </h2>
                {hasSelection && (
                  <div className="flex items-baseline gap-3">
                    {onFindSubstitutes && selectedList.length === 1 && (
                      <button
                        type="button"
                        onClick={() => onFindSubstitutes(selectedList[0].id)}
                        title={`Out of ${selectedList[0].name}? See what can replace it`}
                        className="text-small text-chalk-3 underline-offset-2 hover:text-chalk hover:underline"
                      >
                        Find a substitute →
                      </button>
                    )}
                    <button type="button" onClick={clearSelection} className="text-small text-chalk-3 underline-offset-2 hover:text-chalk hover:underline">
                      Clear
                    </button>
                  </div>
                )}
              </div>
              {hasSelection ? (
                <SelectedChips
                  spices={visibleChips}
                  hiddenCount={selectedList.length - visibleChips.length}
                  expanded={chipsExpanded}
                  canCollapse={overflowChips}
                  onToggleExpanded={() => setChipsExpanded((v) => !v)}
                  onRemove={(slug) => { setHovered(null); toggleSpice(slug); }}
                />
              ) : (
                <p className="mt-2 text-small text-chalk-2">Pick a spice on the map, or start from a blend.</p>
              )}

              {/* Tabs */}
              <div role="tablist" aria-label="Panel sections" className="mt-3 grid grid-cols-3 gap-0.5 rounded-lg bg-board p-0.5 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.1)]">
                {TABS.map(({ id, label }) => {
                  const enabled = tabEnabled(id);
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={!enabled}
                      onClick={() => setChosenTab(id)}
                      className={`relative h-7 rounded-md text-small font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
                        active ? 'text-board' : enabled ? 'text-chalk-2 hover:text-chalk' : 'text-chalk-3'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="pairing-tab"
                          className="absolute inset-0 rounded-md bg-chalk shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_1px_2px_rgba(0,0,0,0.3)]"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Each tab scrolls on its own; the key resets scroll when switching */}
            <div key={tab} role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-rule pb-4">
              {tab === 'pairings' && (
                <Suggestions
                  suggestions={suggestions}
                  rackOnly={rackOnly}
                  rackHiddenCount={rackHiddenCount}
                  tidToSlug={tidToSlug}
                  onAdd={(slug) => { setHovered(null); toggleSpice(slug); }}
                />
              )}

              {tab === 'blend' && (
                <>
                  <BlendSection selectedTids={blendTids} tidToSlug={tidToSlug} />
                  {bridge && <BridgeRow bridge={bridge} tidToSlug={tidToSlug} />}
                  <ClassicBlendHint selectedTids={blendTids} tidToSlug={tidToSlug} />
                </>
              )}

              {tab === 'ideas' && (
                <>
                  <ClassicBlendStarters tidToSlug={tidToSlug} />
                  <SavedBlendsList slugFamilies={slugFamilies} />
                  <DishSection tidToSlug={tidToSlug} selectedTids={selectedTaxonomyIds} />
                  <SurpriseSection tidToSlug={tidToSlug} selectedTaxonomyIds={selectedTaxonomyIds} />
                </>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Compact chips for the selection; extra ones fold into a "+N" chip that expands the list. */
function SelectedChips({
  spices,
  hiddenCount,
  expanded,
  canCollapse,
  onToggleExpanded,
  onRemove,
}: {
  spices: MapSpice[];
  hiddenCount: number;
  expanded: boolean;
  canCollapse: boolean;
  onToggleExpanded: () => void;
  onRemove: (slug: string) => void;
}) {
  const { hoverProps } = useSpiceHover();
  const chip = 'rise-in group flex h-7 items-center gap-1.5 rounded-full bg-board pl-1.5 pr-2.5 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.16)] transition-[box-shadow,background-color] duration-150 hover:bg-board-high hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.3)]';
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {spices.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onRemove(s.id)}
          className={chip}
          title={`Remove ${s.name}`}
          {...hoverProps(s.id)}
        >
          <Swatch color={spiceColor(s.id, s.name, s.family)} size={16} />
          <span className="text-small text-chalk">{s.name}</span>
          <span aria-hidden className="text-micro text-chalk-3 group-hover:text-chalk">✕</span>
        </button>
      ))}
      {canCollapse && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex h-7 items-center rounded-full px-2.5 text-small text-chalk-2 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.16)] transition-colors hover:text-chalk"
          aria-expanded={expanded}
          title={expanded ? 'Show fewer' : 'Show all selected spices'}
        >
          {expanded ? 'Less' : `+${hiddenCount}`}
        </button>
      )}
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
  const [showAll, setShowAll] = useState(false);
  const { hoveredSpiceId, hoverProps } = useSpiceHover();
  if (suggestions.length === 0) {
    return (
      <p className="px-5 py-4 text-small text-chalk-2">
        {rackOnly && rackHiddenCount > 0
          ? "None on your shelf. Turn off 'Only what I have' in Filters."
          : 'No curated pairings for this selection yet.'}
      </p>
    );
  }
  const shown = showAll ? suggestions : suggestions.slice(0, SUGGESTIONS_SHOWN);
  const hiddenCount = suggestions.length - shown.length;
  return (
    <section className="px-5 pt-2" aria-label="Suggested pairings">
      <div className="flex justify-end pb-1 pr-9 text-micro text-chalk-3" aria-hidden>
        Recipes · Chemistry · Tradition
      </div>
      <ul>
        {shown.map((p, i) => {
          const slug = tidToSlug.get(p.spiceId);
          const open = openWhy === p.spiceId;
          const lit = !!slug && hoveredSpiceId === slug;
          return (
            <li
              key={p.spiceId}
              className={`rise-in -mx-2 rounded-xl px-2 transition-colors duration-150 ${
                open ? 'bg-board-high/60 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.1)]' : lit ? 'bg-board-high/60' : ''
              }`}
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              {...hoverProps(slug)}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpenWhy(open ? null : p.spiceId)}
                  aria-expanded={open}
                  title="Show the evidence"
                  className="-ml-2 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
                >
                  <Swatch tid={p.spiceId} size={20} />
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-chalk">{p.spiceName}</span>
                  <EvidencePips pairing={p} />
                </button>
                {slug ? (
                  <AddButton label={`Add ${p.spiceName} to your blend`} onClick={() => onAdd(slug)} />
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center text-micro text-chalk-3" title="Not on the map yet">–</span>
                )}
              </div>
              {open && <div className="pb-2.5 pl-[30px]"><WhyDetails pairing={p} /></div>}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <SmallButton onClick={() => setShowAll(true)} className="mt-2 h-7">
          Show {hiddenCount} more
        </SmallButton>
      )}
    </section>
  );
}

/** Three pips — Recipes, Chemistry, Tradition. Filled = strong, ring = present but weaker, dot = no data. */
function EvidencePips({ pairing }: { pairing: RankedPairing }) {
  const strong = strongSignals(pairing);
  const pips = [
    { label: 'Recipes', value: pairing.affinityScore, text: pairing.affinityScore?.toFixed(2), strong: strong.recipes },
    { label: 'Chemistry', value: pairing.compoundOverlap?.compoundScore ?? null, text: pairing.compoundOverlap?.compoundScore.toFixed(2), strong: strong.chemistry },
    { label: 'Tradition', value: 1, text: TRADITION_WORDS[pairing.affinity], strong: strong.tradition },
  ];
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {pips.map((pip) => {
        const present = pip.value !== null;
        return (
          <span
            key={pip.label}
            title={present ? `${pip.label} ${pip.text}` : `${pip.label}: no data`}
            className="grid h-3 w-3 place-items-center"
          >
            <span
              className={`block rounded-full ${
                !present
                  ? 'h-[3px] w-[3px] bg-chalk-3/50'
                  : pip.strong
                    ? 'h-2.5 w-2.5 bg-chalk'
                    : 'h-2.5 w-2.5 shadow-[inset_0_0_0_1.5px_rgba(243,239,232,0.4)]'
              }`}
            />
          </span>
        );
      })}
    </span>
  );
}
