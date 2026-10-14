'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { familyLabel } from '@/lib/colors';
import { spiceColor } from '@/lib/spice-colors';
import { useSelection } from '@/context/SelectionContext';
import { useRack } from '@/context/RackContext';
import { getSubstitutes, type SubstituteCandidate } from '@/lib/substitution-engine';
import { compoundScore } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';
import { Swatch, Meter, SmallButton } from '@/components/pairing/ui';

interface Substitute {
  spice: string;
  similarity: number | null;
  notes: string | null;
}

interface SpiceData {
  id: string;
  name: string;
  family: string;
  description: string | null;
  heat_level: string | null;
  substitutes: Substitute[];
}

interface SubstitutionViewProps {
  data: SpiceData[];
  /** Spice slug to open focused on (e.g. handed off from the pairing panel). */
  initialFocusId?: string | null;
  onViewInMap: (spiceId: string) => void;
}

const FAMILY_ORDER = [
  'warm', 'hot-pungent', 'sweet', 'earthy', 'herbal', 'floral', 'citrus-bright', 'umami-savory',
];

function similarityLabel(score: number): string {
  if (score >= 0.8) return 'Very close';
  if (score >= 0.7) return 'Close';
  if (score >= 0.55) return 'Workable';
  return 'Loose';
}

function taxonomyLabel(proximity: number): string {
  if (proximity === 1) return 'same subfamily';
  if (proximity > 0) return 'same family';
  return 'different family';
}

function intensityGuidance(delta: number | null): string | null {
  if (delta === null) return null;
  if (delta >= 8) return 'It’s punchier, so start with less and adjust up.';
  if (delta <= -8) return 'It’s milder, so use a touch more than the recipe calls for.';
  return 'Similar intensity, so swap roughly 1:1.';
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** One per-signal evidence row inside a candidate: label, chalk meter, detail. */
function SignalRow({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-24 shrink-0 text-small text-chalk-2">{label}</span>
      {value !== null ? (
        <Meter value={value} className="flex-1" />
      ) : (
        <span className="block h-1 flex-1 rounded-full bg-board-high" />
      )}
      <span className="w-36 shrink-0 truncate text-small text-chalk-3 max-md:w-28" title={detail}>
        {detail}
      </span>
    </div>
  );
}

export default function SubstitutionView({ data, initialFocusId, onViewInMap }: SubstitutionViewProps) {
  const [search, setSearch] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(initialFocusId ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toggleSpice } = useSelection();
  const { rackIds, rackOnly, toggleRack } = useRack();

  const spiceById = useMemo(() => {
    const map: Record<string, SpiceData> = {};
    for (const s of data) map[s.id] = s;
    return map;
  }, [data]);

  // taxonomy dot-id → map slug, for "view on the map".
  const tidToSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data) {
      const tid = toTaxonomyId(s.id, s.name);
      if (tid && !map.has(tid)) map.set(tid, s.id);
    }
    return map;
  }, [data]);

  const groupedSpices = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? data.filter((s) => s.name.toLowerCase().includes(q) || s.family.includes(q))
      : data;
    const groups: Record<string, SpiceData[]> = {};
    for (const family of FAMILY_ORDER) groups[family] = [];
    for (const s of filtered) {
      if (groups[s.family]) groups[s.family].push(s);
    }
    return groups;
  }, [data, search]);

  const focusedSpice = focusedId ? spiceById[focusedId] : null;

  // Data-driven candidates from the substitution engine (taxonomy-id space),
  // augmented with the curated LLM note when the same spice appears in both.
  const candidates = useMemo(() => {
    if (!focusedSpice) return [];
    const tid = toTaxonomyId(focusedSpice.id, focusedSpice.name);
    if (!tid) return [];
    const curatedNotes = new Map(
      focusedSpice.substitutes
        .filter((s) => s.notes)
        .map((s) => [s.spice.toLowerCase(), s.notes as string])
    );
    return getSubstitutes(tid, { limit: rackOnly ? 24 : 8 }).map((c) => ({
      ...c,
      slug: tidToSlug.get(c.spiceId) ?? null,
      curatedNote: curatedNotes.get(c.spiceName.toLowerCase()) ?? null,
    }));
  }, [focusedSpice, tidToSlug, rackOnly]);

  // "Only my rack": substitutes you can actually reach for.
  const visibleCandidates = useMemo(() => {
    if (!rackOnly) return candidates;
    return candidates.filter((c) => c.slug && rackIds.has(c.slug)).slice(0, 8);
  }, [candidates, rackOnly, rackIds]);

  function chemistryDetail(c: SubstituteCandidate): string {
    if (!c.compoundOverlap) return 'no shared compounds';
    const o = c.compoundOverlap;
    const parts: string[] = [];
    if (o.sources.includes('foodb_usda')) {
      const n = o.sharedAromaCount;
      parts.push(
        n > 0
          ? `${n} shared aroma compound${n !== 1 ? 's' : ''}`
          : `${o.sharedCount} shared compounds`
      );
    }
    if (o.flavordb2) {
      parts.push(`${o.flavordb2.sharedCount} shared molecules (FlavorDB2)`);
    }
    return parts.join(', ');
  }

  return (
    <div className="slate flex h-full w-full text-chalk max-md:flex-col">
      {/* Left: spice list. On mobile it fills the view until a spice is picked. */}
      <div
        className={`flex min-h-0 flex-col border-r border-rule bg-board-raised md:w-72 md:shrink-0 max-md:w-full max-md:flex-1 max-md:border-r-0 ${
          focusedId ? 'max-md:hidden' : ''
        }`}
      >
        <div className="border-b border-rule px-4 pb-3 pt-4">
          <h2 className="font-display text-title leading-tight text-chalk">Substitutes</h2>
          <div className="relative mt-3">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-chalk-3"
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search spices"
              aria-label="Search spices"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-md border border-rule bg-board-high pl-8 pr-2.5 text-small text-chalk outline-none placeholder:text-chalk-3 focus:border-rule-strong"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {FAMILY_ORDER.map((family) => {
            const spices = groupedSpices[family];
            if (!spices?.length) return null;
            return (
              <div key={family}>
                <div className="px-4 pb-1 pt-3 text-small text-chalk-3">{familyLabel(family)}</div>
                {spices.map((spice) => {
                  const owned = rackIds.has(spice.id);
                  return (
                    <div
                      key={spice.id}
                      className={`group flex items-center transition-colors ${
                        focusedId === spice.id
                          ? 'bg-board-high text-chalk'
                          : 'text-chalk-2 hover:bg-board-high/50 hover:text-chalk'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFocusedId(spice.id);
                          setExpandedId(null);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-4 text-left"
                      >
                        <Swatch color={spiceColor(spice.id, spice.name, spice.family)} size={12} />
                        <span className="truncate text-body">{spice.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRack(spice.id)}
                        title={owned ? 'Remove from my rack' : 'Add to my rack'}
                        aria-label={owned ? `Remove ${spice.name} from my rack` : `Add ${spice.name} to my rack`}
                        aria-pressed={owned}
                        className={`flex shrink-0 items-center gap-1 px-3 py-2 text-micro transition-opacity ${
                          owned ? 'text-chalk opacity-100' : 'text-chalk-3 opacity-0 hover:text-chalk focus-visible:opacity-100 group-hover:opacity-100'
                        }`}
                      >
                        {owned ? 'On my shelf' : '+ Shelf'}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {search && !data.some((s) => s.name.toLowerCase().includes(search.toLowerCase().trim())) && (
            <div className="px-4 py-6 text-center text-body text-chalk-3">No spices found</div>
          )}
        </div>
      </div>

      {/* Right: substitutes. On mobile it replaces the list once a spice is picked. */}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${focusedId ? '' : 'max-md:hidden'}`}>
        {focusedSpice ? (
          <>
            <div className="shrink-0 border-b border-rule md:hidden">
              <button
                type="button"
                onClick={() => {
                  setFocusedId(null);
                  setExpandedId(null);
                }}
                className="px-4 py-3 text-small text-chalk-2 hover:text-chalk"
              >
                ← All spices
              </button>
            </div>

            {/* Spice header */}
            <div className="shrink-0 border-b border-rule pb-6 pt-9 md:px-[max(2rem,calc((100%-46rem)/2))] max-md:px-4 max-md:pt-4">
              <div className="flex items-center gap-3">
                <Swatch color={spiceColor(focusedSpice.id, focusedSpice.name, focusedSpice.family)} size={32} />
                <h2 className="font-display text-display leading-none text-chalk">{focusedSpice.name}</h2>
              </div>
              <p className="mt-2 text-small text-chalk-3">
                {familyLabel(focusedSpice.family)}
                {focusedSpice.heat_level && focusedSpice.heat_level !== 'mild' ? `, ${focusedSpice.heat_level} heat` : ''}
              </p>
              {focusedSpice.description && (
                <p className="mt-3 max-w-[60ch] text-body leading-relaxed text-chalk-2">{focusedSpice.description}</p>
              )}
            </div>

            {/* Substitutes list */}
            <div className="flex-1 overflow-y-auto py-6 md:px-[max(2rem,calc((100%-46rem)/2))] max-md:px-4">
              {visibleCandidates.length > 0 ? (
                <>
                  <p className="mb-2 max-w-none text-small text-chalk-3" title="Ranked by combined evidence score, best first">
                    {visibleCandidates.length} {visibleCandidates.length === 1 ? 'substitute' : 'substitutes'}
                    {rackOnly ? ', from your rack' : ''}
                  </p>
                  <ul className="max-w-none divide-y divide-rule">
                    {visibleCandidates.map((sub, i) => {
                      const expanded = expandedId === sub.spiceId;
                      const guidance = intensityGuidance(sub.intensityDelta);
                      const sharedCompounds = sub.compoundOverlap?.shared.slice(0, 6).map((c) => c.name) ?? [];
                      const sharedNotes = sub.compoundOverlap?.flavordb2?.sharedFlavorWords ?? [];
                      const tags = [
                        i === 0 ? 'Best match' : null,
                        !rackOnly && sub.slug && rackIds.has(sub.slug) ? (i === 0 ? 'in your rack' : 'In your rack') : null,
                      ].filter(Boolean) as string[];
                      return (
                        <motion.li
                          key={sub.spiceId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.25 }}
                          className="py-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Swatch tid={sub.spiceId} size={16} />
                              <span className="truncate font-display text-lead text-chalk">{sub.spiceName}</span>
                              <span className="shrink-0 text-small text-chalk-3">
                                {familyLabel(sub.spiceId.split('.')[0])}
                              </span>
                            </div>
                          </div>

                          {tags.length > 0 && <p className="mt-1 text-small text-chalk">{tags.join(', ')}</p>}

                          <div className="mt-2.5 flex items-center gap-3">
                            <Meter value={sub.score} className="w-[240px] max-w-[55%]" />
                            <span
                              className="text-small font-medium text-chalk"
                              title="Blends flavor profile, shared chemistry, family closeness and recipe affinity"
                            >
                              {sub.score.toFixed(2)}
                            </span>
                            <span className="text-small text-chalk-2">{similarityLabel(sub.score)}</span>
                          </div>

                          {guidance && <p className="mt-2.5 text-small text-chalk-2">{guidance}</p>}

                          {sub.curatedNote && (
                            <p className="mt-1.5 text-small leading-relaxed text-chalk-2">{sub.curatedNote}</p>
                          )}

                          <div className="mt-3 flex items-center gap-1.5">
                            <SmallButton onClick={() => setExpandedId(expanded ? null : sub.spiceId)} aria-expanded={expanded}>
                              {expanded ? 'Hide the evidence' : 'Show the evidence'}
                            </SmallButton>
                            {sub.slug && (
                              <SmallButton
                                onClick={() => {
                                  toggleSpice(sub.slug!);
                                  onViewInMap(sub.slug!);
                                }}
                              >
                                View on the map
                              </SmallButton>
                            )}
                          </div>

                          {expanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 space-y-2 border-t border-rule pt-3">
                                <SignalRow
                                  label="Flavor profile"
                                  value={sub.profileSimilarity}
                                  detail={
                                    sub.profileSimilarity !== null
                                      ? 'warmth, brightness, earthiness, florality, heat'
                                      : 'no profile data'
                                  }
                                />
                                <SignalRow
                                  label="Chemistry"
                                  value={compoundScore(sub.compoundOverlap)}
                                  detail={chemistryDetail(sub)}
                                />
                                <SignalRow
                                  label="Family"
                                  value={sub.taxonomyProximity}
                                  detail={taxonomyLabel(sub.taxonomyProximity)}
                                />
                                <SignalRow
                                  label="Recipes"
                                  value={sub.affinity}
                                  detail={
                                    sub.affinity !== null
                                      ? `FlavorGraph ${sub.affinity.toFixed(2)}`
                                      : 'no recipe data'
                                  }
                                />
                                {sharedCompounds.length > 0 && (
                                  <p className="pt-1 text-small leading-snug text-chalk-2">
                                    Shared aroma compounds include {formatList(sharedCompounds)}.
                                  </p>
                                )}
                                {sharedNotes.length > 0 && (
                                  <p className="text-small leading-snug text-chalk-2">
                                    Both carry {formatList(sharedNotes)} notes.
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </motion.li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-body text-chalk-2">
                  {rackOnly && candidates.length > 0
                    ? 'No substitutes in your rack. Turn off “Only suggest what I have” in Filters.'
                    : 'No substitution data available for this spice.'}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-12 text-center">
            <p className="font-display text-title text-chalk">Pick a spice</p>
            <p className="mt-2 text-body text-chalk-2">Choose one from the list.</p>
          </div>
        )}
      </div>
    </div>
  );
}
