import type { CompoundOverlap, PairingLink } from "@/types/pairing";
import pairingScoresData from "@/data/pairing-scores.json";
import { compoundScore, getCompoundOverlap, getCuratedLabel } from "./pairing-engine";
import { spiceName } from "./spice-list";

/**
 * Surprise pairing generator (PLAN.md Step 7).
 *
 * A pairing is surprising when FlavorGraph says it works (high recipe-learned
 * affinity) but nothing about it is obvious: it isn't curated, the spices come
 * from different taxonomy families, and they share little flavor chemistry.
 * Recipe affinity alone surfaces cliches (basil × oregano co-occur endlessly),
 * so the score is affinity × novelty, where novelty discounts same-family
 * pairs, curated pairs, and heavy compound overlap.
 */

export interface SurprisePairing {
  a: string;
  b: string;
  aName: string;
  bName: string;
  /** affinity × novelty, 0–1 — the ranking key. */
  surpriseScore: number;
  /** FlavorGraph affinity (the "it works" evidence). */
  affinity: number;
  /** 0 = cross-category, 0.6 = same family, 1 = same subfamily. */
  taxonomyFamiliarity: number;
  /** Shared-compound overlap, null when the pair shares none. */
  compoundOverlap: CompoundOverlap | null;
  /** Curated label if someone already curated this pair (usually null). */
  curatedLabel: PairingLink["affinity"] | null;
}

interface PairScore {
  a: string;
  b: string;
  score: number;
}

// Only pairs with solid recipe evidence qualify; the rest of the range
// (up to ~0.92 observed max) maps linearly onto 0–1.
const AFFINITY_FLOOR = 0.62;
const AFFINITY_CEILING = 0.92;

// How much each familiarity signal dampens the surprise.
const TAXONOMY_WEIGHT = 0.45;
const COMPOUND_WEIGHT = 0.35;
const CURATED_WEIGHT = 0.2;

const CURATED_FAMILIARITY: Record<PairingLink["affinity"], number> = {
  classic: 1.0,
  complementary: 0.7,
  surprising: 0.15,
};

function taxonomyFamiliarity(a: string, b: string): number {
  const [familyA, subA] = a.split(".");
  const [familyB, subB] = b.split(".");
  if (familyA !== familyB) return 0;
  return subA === subB ? 1 : 0.6;
}

function scorePair(pair: PairScore): SurprisePairing | null {
  if (pair.score < AFFINITY_FLOOR) return null;

  const curatedLabel = getCuratedLabel(pair.a, pair.b);
  const compoundOverlap = getCompoundOverlap(pair.a, pair.b);
  const taxFamiliarity = taxonomyFamiliarity(pair.a, pair.b);

  const curatedFamiliarity = curatedLabel
    ? CURATED_FAMILIARITY[curatedLabel]
    : 0;
  const compoundFamiliarity = compoundScore(compoundOverlap) ?? 0;

  // A strong curated label is disqualifying on its own (max), otherwise the
  // signals combine — a same-family pair with heavy overlap is doubly obvious.
  const familiarity = Math.max(
    curatedFamiliarity,
    TAXONOMY_WEIGHT * taxFamiliarity +
      COMPOUND_WEIGHT * compoundFamiliarity +
      CURATED_WEIGHT * curatedFamiliarity
  );

  const normalizedAffinity = Math.min(
    1,
    (pair.score - AFFINITY_FLOOR) / (AFFINITY_CEILING - AFFINITY_FLOOR)
  );

  return {
    a: pair.a,
    b: pair.b,
    aName: spiceName(pair.a),
    bName: spiceName(pair.b),
    surpriseScore: normalizedAffinity * (1 - familiarity),
    affinity: pair.score,
    taxonomyFamiliarity: taxFamiliarity,
    compoundOverlap,
    curatedLabel,
  };
}

export interface SurpriseOptions {
  /** Only surprises involving this spice (e.g. the current selection). */
  forSpiceId?: string;
  /** Max results (default 10). */
  limit?: number;
  /**
   * Max appearances per spice in the ranked list (default 2) so one
   * promiscuous ingredient doesn't dominate. Ignored when forSpiceId is set.
   */
  perSpiceCap?: number;
}

/**
 * Surprising pairings ranked best-first. Deterministic — use pickSurprise
 * for the "surprise me" button.
 */
export function rankSurprises(options: SurpriseOptions = {}): SurprisePairing[] {
  const { forSpiceId, limit = 10, perSpiceCap = 2 } = options;

  const scored: SurprisePairing[] = [];
  for (const pair of pairingScoresData as PairScore[]) {
    if (forSpiceId && pair.a !== forSpiceId && pair.b !== forSpiceId) continue;
    const surprise = scorePair(pair);
    if (surprise && surprise.surpriseScore > 0) scored.push(surprise);
  }
  scored.sort((x, y) => y.surpriseScore - x.surpriseScore);

  if (forSpiceId) return scored.slice(0, limit);

  const counts = new Map<string, number>();
  const diverse: SurprisePairing[] = [];
  for (const s of scored) {
    if (diverse.length >= limit) break;
    const countA = counts.get(s.a) ?? 0;
    const countB = counts.get(s.b) ?? 0;
    if (countA >= perSpiceCap || countB >= perSpiceCap) continue;
    counts.set(s.a, countA + 1);
    counts.set(s.b, countB + 1);
    diverse.push(s);
  }
  return diverse;
}

// Sample from a decent-sized pool so repeated clicks feel fresh, weighted so
// better surprises still come up more often.
const PICK_POOL_SIZE = 40;

/**
 * One surprising pairing, weighted-randomly sampled from the top of the
 * ranking — the "surprise me" button. Pass `random` to make it deterministic.
 */
export function pickSurprise(
  options: SurpriseOptions & { random?: () => number } = {}
): SurprisePairing | null {
  const { random = Math.random, ...rankOptions } = options;
  const pool = rankSurprises({
    perSpiceCap: 3,
    ...rankOptions,
    limit: PICK_POOL_SIZE,
  });
  if (pool.length === 0) return null;

  const weights = pool.map((s) => s.surpriseScore ** 2);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
