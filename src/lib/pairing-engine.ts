import type {
  CompoundOverlap,
  PairingEntry,
  PairingLink,
} from "@/types/pairing";
import pairingsData from "@/data/spice-pairings.json";
import pairingScoresData from "@/data/pairing-scores.json";
import compoundOverlapData from "@/data/compound-overlap.json";

// Build lookup map once
const pairingMap = new Map<string, PairingLink[]>();

for (const entry of pairingsData as PairingEntry[]) {
  pairingMap.set(entry.spiceId, entry.pairsWith);
}

// FlavorGraph affinity scores, keyed by unordered spice-id pair
interface PairScore {
  a: string;
  b: string;
  score: number;
}

const affinityMap = new Map<string, number>();

for (const { a, b, score } of pairingScoresData as PairScore[]) {
  affinityMap.set(pairKey(a, b), score);
}

// Compound overlap (Ahn/USDA layer), keyed by unordered spice-id pair
interface CompoundPair extends CompoundOverlap {
  a: string;
  b: string;
}

const compoundMap = new Map<string, CompoundOverlap>();

for (const { a, b, ...overlap } of compoundOverlapData as CompoundPair[]) {
  compoundMap.set(pairKey(a, b), overlap);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Curated labels keyed by unordered pair (strongest label wins when the two
// directions of a curated link disagree).
const curatedLabelRank = { classic: 0, complementary: 1, surprising: 2 };
const curatedLabelMap = new Map<string, PairingLink["affinity"]>();

for (const entry of pairingsData as PairingEntry[]) {
  for (const link of entry.pairsWith) {
    const key = pairKey(entry.spiceId, link.spiceId);
    const existing = curatedLabelMap.get(key);
    if (
      existing === undefined ||
      curatedLabelRank[link.affinity] < curatedLabelRank[existing]
    ) {
      curatedLabelMap.set(key, link.affinity);
    }
  }
}

/** Curated pairing label for an unordered pair, or null if uncurated. */
export function getCuratedLabel(
  a: string,
  b: string
): PairingLink["affinity"] | null {
  return curatedLabelMap.get(pairKey(a, b)) ?? null;
}

/**
 * FlavorGraph cosine affinity between two spices, or null when either
 * spice has no trained embedding (14 of 72 spices — see PLAN.md).
 */
export function getAffinity(a: string, b: string): number | null {
  return affinityMap.get(pairKey(a, b)) ?? null;
}

/** Shared flavor-compound overlap between two spices, or null when absent. */
export function getCompoundOverlap(a: string, b: string): CompoundOverlap | null {
  return compoundMap.get(pairKey(a, b)) ?? null;
}

// Jaccard values top out well below 1; normalize against a plausible ceiling so
// compound overlap contributes on the same 0–1 scale as FlavorGraph affinity.
const JACCARD_CEILING = 0.4;

function compoundScore(overlap: CompoundOverlap | null): number | null {
  if (!overlap) return null;
  return Math.min(1, overlap.jaccard / JACCARD_CEILING);
}

export interface AffinityDetail {
  /** The selected spice this affinity is measured against */
  spiceId: string;
  score: number;
}

export interface CompoundDetail {
  /** The selected spice this overlap is measured against */
  spiceId: string;
  overlap: CompoundOverlap;
}

/**
 * FlavorGraph affinities between one spice and each of the given spices,
 * sorted best-first. Pairs without a score are omitted.
 */
export function getAffinityDetails(
  spiceId: string,
  againstIds: Iterable<string>
): AffinityDetail[] {
  const details: AffinityDetail[] = [];
  for (const otherId of againstIds) {
    if (otherId === spiceId) continue;
    const score = getAffinity(spiceId, otherId);
    if (score !== null) details.push({ spiceId: otherId, score });
  }
  return details.sort((a, b) => b.score - a.score);
}

/**
 * Compound overlaps between one spice and each of the given spices, sorted by
 * shared aroma-compound count (best-first). Pairs without overlap are omitted.
 */
export function getCompoundDetails(
  spiceId: string,
  againstIds: Iterable<string>
): CompoundDetail[] {
  const details: CompoundDetail[] = [];
  for (const otherId of againstIds) {
    if (otherId === spiceId) continue;
    const overlap = getCompoundOverlap(spiceId, otherId);
    if (overlap) details.push({ spiceId: otherId, overlap });
  }
  return details.sort(
    (a, b) => b.overlap.sharedAromaCount - a.overlap.sharedAromaCount
  );
}

export interface RankedPairing extends PairingLink {
  /** Name of the spice (extracted from ID) */
  spiceName: string;
  /** How many selected spices pair with this one */
  matchCount: number;
  /** Which selected spices it pairs with */
  matchedWith: string[];
  /** Best FlavorGraph affinity vs the selected spices, null if unscored */
  affinityScore: number | null;
  /** Per-selected-spice affinity breakdown (feeds the "why" popover) */
  affinityDetails: AffinityDetail[];
  /** Best compound overlap vs the selected spices, null if none */
  compoundOverlap: CompoundOverlap | null;
  /** Per-selected-spice compound breakdown (feeds the "why" popover) */
  compoundDetails: CompoundDetail[];
  /** Blend of affinity, compound overlap, and curated label — the ranking key */
  blendedScore: number;
}

// Prior for the curated label: the baseline score before evidence, and the
// fallback when neither data layer covers a pair.
const LABEL_PRIOR: Record<PairingLink["affinity"], number> = {
  classic: 0.75,
  complementary: 0.6,
  surprising: 0.5,
};

const AFFINITY_WEIGHT = 0.6;
const COMPOUND_WEIGHT = 0.2;
const LABEL_WEIGHT = 0.2;

/**
 * Blend the three visible signals into one 0–1 score. Weights redistribute to
 * whatever evidence exists so a spice FlavorGraph can't embed still gets a
 * meaningful score from compound overlap + its curated label.
 */
function blendScore(
  affinity: number | null,
  compound: number | null,
  label: PairingLink["affinity"]
): number {
  const prior = LABEL_PRIOR[label];
  const parts: Array<[number, number]> = [[prior, LABEL_WEIGHT]];
  if (affinity !== null) parts.push([affinity, AFFINITY_WEIGHT]);
  if (compound !== null) parts.push([compound, COMPOUND_WEIGHT]);

  const totalWeight = parts.reduce((sum, [, w]) => sum + w, 0);
  return parts.reduce((sum, [v, w]) => sum + (v * w) / totalWeight, 0);
}

/** All evidence for one unordered spice pair, blended into a single score. */
export interface PairEvidence {
  /** Weighted blend of whatever signals exist for this pair (0–1). */
  score: number;
  /** FlavorGraph cosine affinity, null when either spice lacks an embedding. */
  affinity: number | null;
  /** Shared flavor-compound overlap, null when absent. */
  compound: CompoundOverlap | null;
  /** Curated pairing label, null when the pair is uncurated. */
  curatedLabel: PairingLink["affinity"] | null;
}

/**
 * Blended evidence for an arbitrary spice pair — unlike blendScore, the
 * curated label is optional, so this works for pairs no one has curated
 * (bridge candidates, surprise pairings). Returns null when no signal exists.
 */
export function getPairEvidence(a: string, b: string): PairEvidence | null {
  const affinity = getAffinity(a, b);
  const compound = getCompoundOverlap(a, b);
  const curatedLabel = getCuratedLabel(a, b);

  const parts: Array<[number, number]> = [];
  if (affinity !== null) parts.push([affinity, AFFINITY_WEIGHT]);
  const cScore = compoundScore(compound);
  if (cScore !== null) parts.push([cScore, COMPOUND_WEIGHT]);
  if (curatedLabel !== null) parts.push([LABEL_PRIOR[curatedLabel], LABEL_WEIGHT]);
  if (parts.length === 0) return null;

  const totalWeight = parts.reduce((sum, [, w]) => sum + w, 0);
  const score = parts.reduce((sum, [v, w]) => sum + (v * w) / totalWeight, 0);
  return { score, affinity, compound, curatedLabel };
}

/**
 * Given a set of selected spice IDs, compute ranked pairing suggestions.
 * Spices that pair with multiple selected spices rank higher; within the
 * same match count, the blended evidence score decides.
 * Already-selected spices are excluded from results.
 */
export function getCuratedPairings(
  selectedIds: Set<string>
): RankedPairing[] {
  if (selectedIds.size === 0) return [];

  const affinityRank = { classic: 0, complementary: 1, surprising: 2 };

  const suggestionMap = new Map<
    string,
    {
      link: PairingLink;
      matchCount: number;
      matchedWith: string[];
    }
  >();

  for (const selectedId of selectedIds) {
    const pairings = pairingMap.get(selectedId);
    if (!pairings) continue;

    for (const link of pairings) {
      // Skip already-selected spices
      if (selectedIds.has(link.spiceId)) continue;

      const existing = suggestionMap.get(link.spiceId);
      if (existing) {
        existing.matchCount++;
        existing.matchedWith.push(selectedId);
        // Keep the link with the best affinity label
        if (affinityRank[link.affinity] < affinityRank[existing.link.affinity]) {
          existing.link = link;
        }
      } else {
        suggestionMap.set(link.spiceId, {
          link,
          matchCount: 1,
          matchedWith: [selectedId],
        });
      }
    }
  }

  return Array.from(suggestionMap.values())
    .map((data) => buildRankedPairing(data.link, data.matchCount, data.matchedWith))
    .sort((a, b) => {
      // Sort by match count (desc), then by blended score (desc)
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return b.blendedScore - a.blendedScore;
    });
}

/**
 * Assemble a RankedPairing for one suggested spice, gathering both evidence
 * layers against the spices it matched. Exported so AI-mode suggestions can
 * reuse the exact same scoring.
 */
export function buildRankedPairing(
  link: PairingLink,
  matchCount: number,
  matchedWith: string[]
): RankedPairing {
  const affinityDetails = getAffinityDetails(link.spiceId, matchedWith);
  const affinityScore =
    affinityDetails.length > 0 ? affinityDetails[0].score : null;

  const compoundDetails = getCompoundDetails(link.spiceId, matchedWith);
  const compoundOverlap =
    compoundDetails.length > 0 ? compoundDetails[0].overlap : null;

  return {
    ...link,
    spiceName: spiceNameFromId(link.spiceId),
    matchCount,
    matchedWith,
    affinityScore,
    affinityDetails,
    compoundOverlap,
    compoundDetails,
    blendedScore: blendScore(
      affinityScore,
      compoundScore(compoundOverlap),
      link.affinity
    ),
  };
}

/**
 * Extract a human-readable name from a dot-delimited spice ID.
 * e.g. "warm.baking.cinnamon" -> "Cinnamon"
 */
function spiceNameFromId(id: string): string {
  const parts = id.split(".");
  const last = parts[parts.length - 1];
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Get pairings for a single spice (for detail card).
 */
export function getPairingsForSpice(spiceId: string): PairingLink[] {
  return pairingMap.get(spiceId) ?? [];
}

export interface ScoredPairingLink extends PairingLink {
  affinityScore: number | null;
  compoundOverlap: CompoundOverlap | null;
}

/**
 * Pairings for a single spice with FlavorGraph affinity and compound overlap
 * attached, sorted score-first (unscored pairs keep curated order at the end).
 */
export function getScoredPairingsForSpice(spiceId: string): ScoredPairingLink[] {
  return getPairingsForSpice(spiceId)
    .map((link) => ({
      ...link,
      affinityScore: getAffinity(spiceId, link.spiceId),
      compoundOverlap: getCompoundOverlap(spiceId, link.spiceId),
    }))
    .sort((a, b) => {
      if (a.affinityScore === null && b.affinityScore === null) return 0;
      if (a.affinityScore === null) return 1;
      if (b.affinityScore === null) return -1;
      return b.affinityScore - a.affinityScore;
    });
}
