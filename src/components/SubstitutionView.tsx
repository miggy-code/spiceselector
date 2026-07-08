'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FAMILY_COLORS } from '@/lib/colors';
import { useSelection } from '@/context/SelectionContext';
import { useRack } from '@/context/RackContext';
import { getSubstitutes, type SubstituteCandidate } from '@/lib/substitution-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';

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

const FAMILY_LABELS: Record<string, string> = {
  'warm': 'Warm',
  'hot-pungent': 'Hot & Pungent',
  'sweet': 'Sweet',
  'earthy': 'Earthy',
  'herbal': 'Herbal',
  'floral': 'Floral',
  'citrus-bright': 'Citrus & Bright',
  'umami-savory': 'Umami & Savory',
};

// Same jaccard normalization the engine uses for the chemistry signal.
const JACCARD_CEILING = 0.4;

/** FAMILY_COLORS are hsl() strings, so hex-suffix alpha doesn't work on them. */
function withAlpha(color: string, alpha: number): string {
  return color.startsWith('hsl(')
    ? color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`)
    : color;
}

function similarityColor(score: number): string {
  if (score >= 0.6) return '#4ade80'; // green
  if (score >= 0.4) return '#fbbf24'; // amber
  return '#f87171'; // red
}

function similarityLabel(score: number): string {
  if (score >= 0.7) return 'Very close';
  if (score >= 0.55) return 'Close';
  if (score >= 0.4) return 'Moderate';
  return 'Distant';
}

function taxonomyLabel(proximity: number): string {
  if (proximity === 1) return 'same subfamily';
  if (proximity > 0) return 'same family';
  return 'different family';
}

function intensityGuidance(delta: number | null): { text: string; icon: string } | null {
  if (delta === null) return null;
  if (delta >= 8) return { icon: '▾', text: 'It’s punchier — start with less and adjust up.' };
  if (delta <= -8) return { icon: '▴', text: 'It’s milder — use a touch more than the recipe calls for.' };
  return { icon: '≈', text: 'Similar intensity — swap roughly 1:1.' };
}

/** One per-signal evidence row inside a substitute card. */
function SignalRow({
  label,
  value,
  detail,
  color = '#22d3ee',
}: {
  label: string;
  value: number | null;
  detail: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] uppercase tracking-wider text-white/35 w-16 shrink-0">{label}</span>
      <div className="h-1 flex-1 rounded-full bg-white/8 overflow-hidden">
        {value !== null && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(value * 100)}%`,
              backgroundColor: color,
              boxShadow: `0 0 5px ${color}90`,
            }}
          />
        )}
      </div>
      <span className="text-[10px] text-white/40 w-32 shrink-0 truncate" title={detail}>
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

  // taxonomy dot-id → map slug, for family colors and "view in map".
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

  const familyColor = (family: string) =>
    (FAMILY_COLORS as Record<string, string>)[family] ?? '#888';
  const familyColorForTid = (tid: string) => familyColor(tid.split('.')[0]);

  function chemistryDetail(c: SubstituteCandidate): string {
    if (!c.compoundOverlap) return 'no shared compounds';
    const n = c.compoundOverlap.sharedAromaCount;
    return n > 0
      ? `${n} shared aroma compound${n !== 1 ? 's' : ''}`
      : `${c.compoundOverlap.sharedCount} shared compounds`;
  }

  return (
    <div className="w-full h-full flex bg-neutral-950 pl-14 max-md:pl-0 max-md:flex-col">
      {/* Left: Spice list */}
      <div className="w-64 shrink-0 flex flex-col border-r border-white/8 h-full max-md:w-full max-md:h-40 max-md:border-r-0 max-md:border-b max-md:shrink-0">
        <div className="px-4 pt-5 pb-3 border-b border-white/8 max-md:pl-14">
          <div className="text-white/80 text-sm font-semibold mb-3">Substitution Finder</div>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search spices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white/6 border border-white/10 rounded-lg text-white/80 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {FAMILY_ORDER.map((family) => {
            const spices = groupedSpices[family];
            if (!spices?.length) return null;
            return (
              <div key={family}>
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-white/25 font-medium">
                  {FAMILY_LABELS[family]}
                </div>
                {spices.map((spice) => {
                  const owned = rackIds.has(spice.id);
                  return (
                    <div
                      key={spice.id}
                      className={`group flex items-center transition-colors ${
                        focusedId === spice.id
                          ? 'bg-white/10 text-white'
                          : 'text-white/55 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setFocusedId(spice.id);
                          setExpandedId(null);
                        }}
                        className="flex-1 flex items-center gap-2.5 pl-4 py-2 text-left min-w-0"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: familyColor(spice.family) }}
                        />
                        <span className="text-sm truncate">{spice.name}</span>
                      </button>
                      <button
                        onClick={() => toggleRack(spice.id)}
                        title={owned ? 'Remove from my rack' : 'Add to my rack'}
                        aria-pressed={owned}
                        className={`shrink-0 px-3 py-2 text-[13px] leading-none transition-all ${
                          owned
                            ? 'text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.7)]'
                            : 'text-white/15 opacity-0 group-hover:opacity-100 hover:text-emerald-300'
                        }`}
                      >
                        {owned ? '◉' : '○'}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!data.some((s) =>
            s.name.toLowerCase().includes(search.toLowerCase())
          ) && search && (
            <div className="px-4 py-6 text-center text-white/25 text-sm">No spices found</div>
          )}
        </div>
      </div>

      {/* Right: Substitutes panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {focusedSpice ? (
          <>
            {/* Spice header */}
            <div className="px-8 pt-8 pb-5 border-b border-white/8 shrink-0 max-md:px-4 max-md:pt-4">
              <div className="flex items-start gap-3">
                <span
                  className="w-3 h-3 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: familyColor(focusedSpice.family) }}
                />
                <div>
                  <h2 className="text-xl font-semibold text-white">{focusedSpice.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        color: familyColor(focusedSpice.family),
                        borderColor: withAlpha(familyColor(focusedSpice.family), 0.25),
                        backgroundColor: withAlpha(familyColor(focusedSpice.family), 0.08),
                      }}
                    >
                      {FAMILY_LABELS[focusedSpice.family] ?? focusedSpice.family}
                    </span>
                    {focusedSpice.heat_level && focusedSpice.heat_level !== 'mild' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 capitalize">
                        {focusedSpice.heat_level}
                      </span>
                    )}
                  </div>
                  {focusedSpice.description && (
                    <p className="text-white/40 text-sm mt-2 max-w-lg">{focusedSpice.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Substitutes list */}
            <div className="flex-1 overflow-y-auto px-8 py-6 max-md:px-4">
              {visibleCandidates.length > 0 ? (
                <>
                  <div className="flex items-baseline justify-between max-w-2xl mb-4">
                    <div className="text-white/30 text-xs uppercase tracking-widest">
                      {visibleCandidates.length} substitutes · ranked by evidence
                      {rackOnly && <span className="text-emerald-400/60"> · your rack only</span>}
                    </div>
                    <div className="text-white/20 text-[10px]">
                      flavor profile · chemistry · family · recipes
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 max-w-2xl">
                    {visibleCandidates.map((sub, i) => {
                      const pct = Math.round(sub.score * 100);
                      const color = similarityColor(sub.score);
                      const expanded = expandedId === sub.spiceId;
                      const guidance = intensityGuidance(sub.intensityDelta);
                      return (
                        <motion.div
                          key={sub.spiceId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.25 }}
                          className={`bg-white/4 border rounded-xl p-4 transition-colors ${
                            i === 0 ? 'border-emerald-400/25' : 'border-white/8 hover:border-white/15'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: familyColorForTid(sub.spiceId) }}
                              />
                              <span className="text-white font-medium">{sub.spiceName}</span>
                              <span className="text-white/30 text-xs">
                                {FAMILY_LABELS[sub.spiceId.split('.')[0]] ?? sub.spiceId.split('.')[0]}
                              </span>
                              {i === 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300">
                                  best match
                                </span>
                              )}
                              {!rackOnly && sub.slug && rackIds.has(sub.slug) && (
                                <span
                                  className="text-[11px] text-emerald-400"
                                  title="In your rack"
                                >
                                  ◉
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs" style={{ color }}>
                                {similarityLabel(sub.score)}
                              </span>
                              <span className="text-sm font-mono font-semibold" style={{ color }}>
                                {pct}%
                              </span>
                            </div>
                          </div>

                          {/* Blended score bar */}
                          <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden mb-3">
                            <motion.div
                              className="h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.04 + 0.1, duration: 0.4, ease: 'easeOut' }}
                              style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                            />
                          </div>

                          {guidance && (
                            <p className="text-white/50 text-xs mb-1.5">
                              <span className="text-white/30 mr-1">{guidance.icon}</span>
                              {guidance.text}
                            </p>
                          )}

                          {sub.curatedNote && (
                            <p className="text-white/45 text-sm mb-1.5">{sub.curatedNote}</p>
                          )}

                          <button
                            onClick={() => setExpandedId(expanded ? null : sub.spiceId)}
                            className="text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors"
                            aria-expanded={expanded}
                          >
                            {expanded ? 'hide the evidence ▴' : 'why this score? ▾'}
                          </button>

                          {expanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
                                <SignalRow
                                  label="profile"
                                  value={sub.profileSimilarity}
                                  detail={
                                    sub.profileSimilarity !== null
                                      ? 'warmth·bright·earth·floral·heat'
                                      : 'no profile data'
                                  }
                                  color="#22d3ee"
                                />
                                <SignalRow
                                  label="chemistry"
                                  value={
                                    sub.compoundOverlap
                                      ? Math.min(1, sub.compoundOverlap.jaccard / JACCARD_CEILING)
                                      : null
                                  }
                                  detail={chemistryDetail(sub)}
                                  color="#34d399"
                                />
                                <SignalRow
                                  label="family"
                                  value={sub.taxonomyProximity}
                                  detail={taxonomyLabel(sub.taxonomyProximity)}
                                  color="#a78bfa"
                                />
                                <SignalRow
                                  label="recipes"
                                  value={sub.affinity}
                                  detail={
                                    sub.affinity !== null
                                      ? `FlavorGraph ${sub.affinity.toFixed(2)}`
                                      : 'no embedding'
                                  }
                                  color="#fbbf24"
                                />
                                {sub.compoundOverlap && sub.compoundOverlap.shared.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {sub.compoundOverlap.shared.slice(0, 6).map((c) => (
                                      <span
                                        key={c.name}
                                        title={c.flavors.join(', ')}
                                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                      >
                                        {c.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}

                          {sub.slug && (
                            <button
                              onClick={() => {
                                toggleSpice(sub.slug!);
                                onViewInMap(sub.slug!);
                              }}
                              className="mt-3 text-xs text-white/35 hover:text-white/70 transition-colors flex items-center gap-1.5"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4l3 3" />
                              </svg>
                              View in map
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                  <p className="max-w-2xl mt-4 text-[10px] text-white/20">
                    Blend of 5-axis flavor profile, shared aroma chemistry (Ahn et al. 2011 + USDA),
                    taxonomy proximity, and FlavorGraph recipe affinity (Park et al. 2021).
                  </p>
                </>
              ) : (
                <div className="text-white/25 text-sm">
                  {rackOnly && candidates.length > 0
                    ? 'No substitutes in your rack — turn off “only my rack” in the menu, or mark more spices with ◉ in the list.'
                    : 'No substitution data available for this spice.'}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12">
            <div className="text-5xl mb-6 opacity-30">⇄</div>
            <div className="text-white/50 text-base font-medium mb-2">Select a spice</div>
            <div className="text-white/25 text-sm max-w-xs">
              Choose any spice from the list to see its closest substitutes — ranked by flavor
              profile, shared chemistry, and recipe evidence.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
