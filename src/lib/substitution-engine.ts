import type { CompoundOverlap } from "@/types/pairing";
import flavorVectorsData from "@/data/flavor-vectors.json";
import { getAffinity, getCompoundOverlap } from "./pairing-engine";
import { allSpices } from "./spice-list";

/**
 * Data-driven substitutions (PLAN.md Step 8).
 *
 * Raw FlavorGraph affinity can't rank substitutes on its own: it conflates
 * "pairs well" with "is similar" (nutmeg×cilantro scores 0.93 — great pairing,
 * terrible substitute). Substitutability instead blends four signals, each
 * shown in the UI as the "why":
 *   1. flavor-profile similarity — distance over the 5-axis profile vectors
 *   2. shared chemistry — compound-overlap jaccard (Ahn/USDA layer)
 *   3. taxonomy proximity — same subfamily/family
 *   4. FlavorGraph affinity — embedding proximity, as a supporting signal
 * Weights redistribute over whichever signals exist, so spices missing a
 * profile vector or embedding still get ranked.
 */

interface FlavorVector {
  warmth: number;
  brightness: number;
  earthiness: number;
  florality: number;
  heat: number;
  intensity: number;
}

const flavorVectors = flavorVectorsData as Record<string, FlavorVector>;

const PROFILE_AXES = [
  "warmth",
  "brightness",
  "earthiness",
  "florality",
  "heat",
] as const;

// Euclidean distance over five 0–100 axes; 150 ≈ the distance between two
// genuinely unrelated spices, so similarity bottoms out at 0 there.
const PROFILE_DISTANCE_CEILING = 150;
// Same jaccard normalization as the pairing engine.
const JACCARD_CEILING = 0.4;

const PROFILE_WEIGHT = 0.4;
const CHEMISTRY_WEIGHT = 0.25;
const TAXONOMY_WEIGHT = 0.2;
const AFFINITY_WEIGHT = 0.15;

/** Flavor-profile similarity (0–1), or null when either vector is missing. */
export function getProfileSimilarity(a: string, b: string): number | null {
  const va = flavorVectors[a];
  const vb = flavorVectors[b];
  if (!va || !vb) return null;
  let sumSq = 0;
  for (const axis of PROFILE_AXES) {
    const d = va[axis] - vb[axis];
    sumSq += d * d;
  }
  return Math.max(0, 1 - Math.sqrt(sumSq) / PROFILE_DISTANCE_CEILING);
}

function taxonomyProximity(a: string, b: string): number {
  const [familyA, subA] = a.split(".");
  const [familyB, subB] = b.split(".");
  if (familyA !== familyB) return 0;
  return subA === subB ? 1 : 0.6;
}

export interface SubstituteCandidate {
  spiceId: string;
  spiceName: string;
  /** Weighted blend of the four signals below (0–1) — the ranking key. */
  score: number;
  /** 5-axis flavor-profile similarity, null when a vector is missing. */
  profileSimilarity: number | null;
  /** Shared flavor compounds, null when the pair shares none. */
  compoundOverlap: CompoundOverlap | null;
  /** 1 = same subfamily, 0.6 = same family, 0 = different family. */
  taxonomyProximity: number;
  /** FlavorGraph embedding affinity, null when either spice is unembedded. */
  affinity: number | null;
  /**
   * Guidance for the swap: how the substitute's overall punch compares
   * ("use more"/"use less"). Null when either intensity is unknown.
   */
  intensityDelta: number | null;
}

/**
 * Blended substitutability between two spices, with the per-signal breakdown.
 */
export function getSubstitutionScore(
  target: string,
  candidate: string
): SubstituteCandidate {
  const profileSimilarity = getProfileSimilarity(target, candidate);
  const compoundOverlap = getCompoundOverlap(target, candidate);
  const taxProximity = taxonomyProximity(target, candidate);
  const affinity = getAffinity(target, candidate);

  const parts: Array<[number, number]> = [[taxProximity, TAXONOMY_WEIGHT]];
  if (profileSimilarity !== null) parts.push([profileSimilarity, PROFILE_WEIGHT]);
  if (compoundOverlap !== null)
    parts.push([
      Math.min(1, compoundOverlap.jaccard / JACCARD_CEILING),
      CHEMISTRY_WEIGHT,
    ]);
  if (affinity !== null) parts.push([affinity, AFFINITY_WEIGHT]);

  const totalWeight = parts.reduce((sum, [, w]) => sum + w, 0);
  let score = parts.reduce((sum, [v, w]) => sum + (v * w) / totalWeight, 0);
  // Taxonomy proximity alone is a guess, not evidence — a same-subfamily
  // pair with no data shouldn't read as a perfect substitute.
  if (parts.length === 1) score *= 0.75;

  const targetVec = flavorVectors[target];
  const candidateVec = flavorVectors[candidate];

  return {
    spiceId: candidate,
    spiceName: allSpiceNames.get(candidate) ?? candidate,
    score,
    profileSimilarity,
    compoundOverlap,
    taxonomyProximity: taxProximity,
    affinity,
    intensityDelta:
      targetVec && candidateVec
        ? candidateVec.intensity - targetVec.intensity
        : null,
  };
}

const allSpiceNames = new Map(allSpices.map((s) => [s.id, s.name]));

export interface SubstituteOptions {
  /** Max candidates to return (default 6, matching the curated list length). */
  limit?: number;
  /** Spice ids to exclude from candidates. */
  excludeIds?: Iterable<string>;
}

/**
 * Ranked substitution candidates for a spice, best first, computed over the
 * whole taxonomy. Keyed on taxonomy dot-ids like the rest of the engine.
 */
export function getSubstitutes(
  spiceId: string,
  options: SubstituteOptions = {}
): SubstituteCandidate[] {
  const { limit = 6, excludeIds } = options;
  const excluded = new Set(excludeIds ?? []);
  excluded.add(spiceId);

  return allSpices
    .filter((s) => !excluded.has(s.id))
    .map((s) => getSubstitutionScore(spiceId, s.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
