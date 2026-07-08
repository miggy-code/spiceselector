'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { getCuratedPairings, type RankedPairing } from '@/lib/pairing-engine';
import { findBridges, findWeakestPair, type BridgeCandidate } from '@/lib/bridge-finder';
import { spiceName } from '@/lib/spice-list';
import { toTaxonomyId } from '@/lib/spice-id-map';
import { FAMILY_COLORS } from '@/lib/colors';
import WhyPopover, { ScoreBar } from './WhyPopover';
import SurpriseSection from './SurpriseSection';
import BlendSection from './BlendSection';
import DishSection from './DishSection';
import SavedBlendsList from './SavedBlendsList';
import ClassicBlendHint from './ClassicBlendHint';
import ClassicBlendStarters from './ClassicBlendStarters';
import { useRack } from '@/context/RackContext';

interface MapSpice {
  id: string;
  name: string;
  family: string;
}

interface MapPairingPanelProps {
  data: MapSpice[];
  /** Open the Substitution Finder focused on this spice (slug id). */
  onFindSubstitutes?: (slug: string) => void;
}

const affinityBadge: Record<string, { label: string; className: string }> = {
  classic: { label: 'Classic', className: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  complementary: { label: 'Complementary', className: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
  surprising: { label: 'Surprising', className: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25' },
};

function familyColorForTid(tid: string): string {
  return FAMILY_COLORS[tid.split('.')[0]] ?? '#22d3ee';
}

/**
 * Unified pairing panel that overlays the Flavor Map. Translates the map's slug
 * selection to taxonomy ids, runs the pairing engine, and lets the user click a
 * suggestion to add it back to the map selection — closing the explore loop.
 */
export default function MapPairingPanel({ data, onFindSubstitutes }: MapPairingPanelProps) {
  const { selectedSpiceIds, toggleSpice, clearSelection } = useSelection();
  const { rackIds, rackOnly } = useRack();
  const [collapsed, setCollapsed] = useState(false);

  // Bidirectional slug <-> taxonomy-id maps derived from the plotted spices.
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

  const allSuggestions = useMemo(
    () => getCuratedPairings(selectedTaxonomyIds),
    [selectedTaxonomyIds]
  );

  // "Only my rack": keep suggestions the user can actually cook with tonight.
  const suggestions = useMemo(() => {
    if (!rackOnly) return allSuggestions;
    return allSuggestions.filter((p) => {
      const slug = tidToSlug.get(p.spiceId);
      return !!slug && rackIds.has(slug);
    });
  }, [allSuggestions, rackOnly, rackIds, tidToSlug]);
  const rackHiddenCount = allSuggestions.length - suggestions.length;

  // Bridge finder (Step 6): when the blend has a weak link, surface the spices
  // that connect its two ends.
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

  const slugFamilies = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data) map.set(d.id, d.family);
    return map;
  }, [data]);

  function addSuggestion(p: RankedPairing) {
    const slug = tidToSlug.get(p.spiceId);
    if (slug) toggleSpice(slug);
  }

  return (
    <div className="dark pointer-events-none absolute top-0 right-0 h-full z-20 flex items-stretch max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-auto max-md:flex-col max-md:items-stretch">
      {/* Collapse handle — desktop: left-side tab; mobile: centered top grab-bar */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="pointer-events-auto self-center -mr-px rounded-l-lg border border-white/10 border-r-0 bg-neutral-900/80 backdrop-blur px-1.5 py-4 text-white/50 hover:text-cyan-300 hover:bg-neutral-800/80 transition-colors max-md:self-auto max-md:mr-0 max-md:w-full max-md:py-2.5 max-md:flex max-md:justify-center max-md:items-center max-md:rounded-none max-md:rounded-t-2xl max-md:border-x-0 max-md:border-t max-md:border-b-0"
        aria-label={collapsed ? 'Show pairings' : 'Hide pairings'}
      >
        <span className="hidden md:block text-xs">{collapsed ? '‹' : '›'}</span>
        <span className="md:hidden">
          <span className="block w-10 h-1 rounded-full bg-white/30" />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="pointer-events-auto w-[340px] h-full flex flex-col border-l border-white/10 bg-neutral-950/85 backdrop-blur-xl shadow-2xl max-md:w-full max-md:h-auto max-md:max-h-[55vh] max-md:border-l-0 max-md:border-t"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                  Pairing Lab
                </h2>
                <p className="text-[11px] text-white/40 mt-0.5">Evidence-backed spice matches</p>
              </div>
              {hasSelection && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-[11px] text-white/45 hover:text-white/80 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Selected chips */}
            {hasSelection && (
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
                  Selected · {selectedList.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpice(s.id)}
                      className="group flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full bg-white/6 border border-white/10 hover:border-white/25 transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: FAMILY_COLORS[s.family] ?? '#888' }}
                      />
                      <span className="text-[11px] text-white/85">{s.name}</span>
                      <span className="text-white/30 group-hover:text-white/70 text-[13px] leading-none">×</span>
                    </button>
                  ))}
                </div>
                {onFindSubstitutes && selectedList.length === 1 && (
                  <button
                    type="button"
                    onClick={() => onFindSubstitutes(selectedList[0].id)}
                    className="mt-2 text-[11px] text-white/40 hover:text-cyan-300 transition-colors flex items-center gap-1"
                  >
                    <span aria-hidden>⇄</span> Out of {selectedList[0].name}? Find substitutes
                  </button>
                )}
              </div>
            )}

            {/* Blend Builder: radar + cohesion + gap suggestions */}
            {selectedTaxonomyIds.size >= 2 && (
              <BlendSection selectedTids={Array.from(selectedTaxonomyIds)} tidToSlug={tidToSlug} />
            )}

            {/* Classic blend constellations */}
            {selectedTaxonomyIds.size >= 2 && (
              <ClassicBlendHint selectedTids={Array.from(selectedTaxonomyIds)} tidToSlug={tidToSlug} />
            )}

            {/* Dish anchoring: "what goes on salmon?" */}
            <DishSection tidToSlug={tidToSlug} selectedTids={selectedTaxonomyIds} />

            {/* Surprise generator (Step 7) */}
            <SurpriseSection tidToSlug={tidToSlug} selectedTaxonomyIds={selectedTaxonomyIds} />

            {/* Bridge finder */}
            {bridge && (
              <div className="px-4 py-3 border-b border-white/8 bg-fuchsia-500/[0.04]">
                <p className="text-[10px] uppercase tracking-widest text-fuchsia-300/70 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.9)]" />
                  Bridge the gap
                </p>
                <p className="text-[11px] text-white/55 mb-2">
                  <span className="text-white/85">{spiceName(bridge.a)}</span>
                  {' × '}
                  <span className="text-white/85">{spiceName(bridge.b)}</span>{' '}
                  {bridge.direct
                    ? `is your weakest link (${bridge.direct.score.toFixed(2)})`
                    : 'have no pairing evidence'}
                  {' — these connect them:'}
                </p>
                <ul className="space-y-1.5">
                  {bridge.bridges.map((c: BridgeCandidate) => {
                    const slug = tidToSlug.get(c.spiceId);
                    return (
                      <li
                        key={c.spiceId}
                        className="rounded-xl border border-fuchsia-400/20 bg-white/[0.03] p-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: familyColorForTid(c.spiceId) }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white/90">{c.spiceName}</span>
                              {c.gain > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25">
                                  +{c.gain.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <ScoreBar score={c.bridgeScore} />
                              <span className="text-[10px] tabular-nums text-fuchsia-300">
                                {c.bridgeScore.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/40 mt-0.5">
                              {c.legs[0].evidence.score.toFixed(2)} ↔ {c.legs[0].spiceName}
                              {' · '}
                              {c.legs[1].evidence.score.toFixed(2)} ↔ {c.legs[1].spiceName}
                            </p>
                          </div>
                          {slug ? (
                            <button
                              type="button"
                              onClick={() => toggleSpice(slug)}
                              className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 hover:bg-fuchsia-500/25 hover:shadow-[0_0_10px_rgba(232,121,249,0.35)] transition-all"
                            >
                              + add
                            </button>
                          ) : (
                            <span className="flex-shrink-0 text-[9px] text-white/25" title="Not plotted on this map">
                              off-map
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {!hasSelection ? (
                <>
                <SavedBlendsList slugFamilies={slugFamilies} />
                <ClassicBlendStarters tidToSlug={tidToSlug} />
                <div className="flex flex-col items-center justify-center text-center gap-2 px-2 py-8">
                  <div className="w-10 h-10 rounded-full border border-cyan-400/30 flex items-center justify-center text-cyan-300/70">
                    ✦
                  </div>
                  <p className="text-sm text-white/60">Pick a spice on the map</p>
                  <p className="text-[11px] text-white/35">
                    We&apos;ll surface its strongest pairings — with the science behind each score.
                  </p>
                  <p className="text-[11px] text-amber-300/50 mt-1">
                    Not sure where to start? Roll a surprise above.
                  </p>
                </div>
                </>
              ) : suggestions.length === 0 ? (
                <p className="text-[12px] text-white/45 text-center py-8">
                  {rackOnly && rackHiddenCount > 0
                    ? `All ${rackHiddenCount} suggestions are outside your rack — turn off “only my rack” in the menu to see them.`
                    : 'No curated pairings for this selection yet.'}
                </p>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
                    {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                    {rackOnly && rackHiddenCount > 0 && (
                      <span className="normal-case tracking-normal text-white/25">
                        {' '}· {rackHiddenCount} outside your rack hidden
                      </span>
                    )}
                  </p>
                  <ul className="space-y-1.5">
                    {suggestions.map((p, i) => {
                      const slug = tidToSlug.get(p.spiceId);
                      const onMap = !!slug;
                      const badge = affinityBadge[p.affinity];
                      return (
                        <li
                          key={p.spiceId}
                          className={`rounded-xl border p-2.5 transition-colors ${
                            i === 0
                              ? 'border-cyan-400/30 bg-cyan-500/[0.06]'
                              : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                              style={{ backgroundColor: familyColorForTid(p.spiceId) }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white/90">{p.spiceName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                                {p.matchCount > 1 && (
                                  <span className="text-[10px] text-white/35">{p.matchCount} matches</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <ScoreBar score={p.blendedScore} />
                                <span className="text-[10px] tabular-nums text-cyan-300">
                                  {p.blendedScore.toFixed(2)}
                                </span>
                              </div>
                              {p.compoundOverlap && p.compoundOverlap.sharedAromaCount > 0 && (
                                <p className="text-[10px] text-emerald-400 mt-0.5">
                                  shares {p.compoundOverlap.sharedAromaCount} aroma compound
                                  {p.compoundOverlap.sharedAromaCount !== 1 ? 's' : ''}
                                </p>
                              )}
                              {p.note && <p className="text-[11px] text-white/50 mt-0.5">{p.note}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <WhyPopover pairing={p} />
                              {onMap ? (
                                <button
                                  type="button"
                                  onClick={() => addSuggestion(p)}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_10px_rgba(34,211,238,0.35)] transition-all"
                                >
                                  + add
                                </button>
                              ) : (
                                <span className="text-[9px] text-white/25" title="Not plotted on this map">
                                  off-map
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            <p className="px-4 py-2 text-[9px] text-white/25 border-t border-white/8">
              Scores from FlavorGraph (Park et al. 2021) + Ahn et al. (2011)
            </p>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
