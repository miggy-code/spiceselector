import { getPairEvidence, type PairEvidence } from "./pairing-engine";
import { allSpices, spiceName } from "./spice-list";

/**
 * Bridge-spice finder (PLAN.md Step 6).
 *
 * Given two spices that pair poorly, find a third spice that pairs well with
 * *both* — "chipotle and cardamom clash; cayenne bridges them". A candidate's
 * bridge score is the *minimum* of its two leg scores (max-min over the
 * evidence matrix), so a bridge is only as strong as its weaker connection.
 * Uses blended pair evidence, so spices without a FlavorGraph embedding can
 * still bridge via compound overlap or curated links.
 */

/** One leg of a bridge: the candidate's connection to one endpoint. */
export interface BridgeLeg {
  /** The endpoint spice this leg connects to. */
  spiceId: string;
  spiceName: string;
  evidence: PairEvidence;
}

export interface BridgeCandidate {
  spiceId: string;
  spiceName: string;
  /** min(leg A score, leg B score) — the ranking key. */
  bridgeScore: number;
  /** How much stronger the weaker leg is than the direct pairing. */
  gain: number;
  /** Legs in the same order as the (a, b) arguments to findBridges. */
  legs: [BridgeLeg, BridgeLeg];
}

export interface BridgeAnalysis {
  a: string;
  b: string;
  /** Evidence for pairing a and b directly, null when no signal exists. */
  direct: PairEvidence | null;
  /** True when the direct pairing is weak or unknown — a bridge helps. */
  needsBridge: boolean;
  /** Bridge candidates, best first. Empty when nothing beats the direct pair. */
  bridges: BridgeCandidate[];
}

// FlavorGraph-derived blended scores have median ~0.57; below this a pair is
// weak enough that suggesting a bridge is useful rather than noise.
const WEAK_PAIR_THRESHOLD = 0.55;
// A bridge leg weaker than this isn't a real connection even if it beats a
// terrible direct score.
const MIN_BRIDGE_SCORE = 0.5;

export interface FindBridgesOptions {
  /** Max candidates to return (default 5). */
  limit?: number;
  /** Spice ids to exclude (e.g. already-selected spices). */
  excludeIds?: Iterable<string>;
}

/**
 * Find the spices that best connect a and b. Candidates must have evidence
 * for both legs, and their bridge score must beat both the direct pairing
 * and MIN_BRIDGE_SCORE.
 */
export function findBridges(
  a: string,
  b: string,
  options: FindBridgesOptions = {}
): BridgeAnalysis {
  const { limit = 5, excludeIds } = options;
  const excluded = new Set(excludeIds ?? []);
  excluded.add(a);
  excluded.add(b);

  const direct = getPairEvidence(a, b);
  const directScore = direct?.score ?? 0;
  const floor = Math.max(directScore, MIN_BRIDGE_SCORE);

  const candidates: BridgeCandidate[] = [];

  for (const spice of allSpices) {
    if (excluded.has(spice.id)) continue;

    const evidenceA = getPairEvidence(a, spice.id);
    if (!evidenceA || evidenceA.score <= floor) continue;
    const evidenceB = getPairEvidence(spice.id, b);
    if (!evidenceB || evidenceB.score <= floor) continue;

    const bridgeScore = Math.min(evidenceA.score, evidenceB.score);
    candidates.push({
      spiceId: spice.id,
      spiceName: spiceName(spice.id),
      bridgeScore,
      gain: bridgeScore - directScore,
      legs: [
        { spiceId: a, spiceName: spiceName(a), evidence: evidenceA },
        { spiceId: b, spiceName: spiceName(b), evidence: evidenceB },
      ],
    });
  }

  candidates.sort(
    (x, y) =>
      y.bridgeScore - x.bridgeScore ||
      y.legs[0].evidence.score +
        y.legs[1].evidence.score -
        (x.legs[0].evidence.score + x.legs[1].evidence.score)
  );

  return {
    a,
    b,
    direct,
    needsBridge: directScore < WEAK_PAIR_THRESHOLD,
    bridges: candidates.slice(0, limit),
  };
}

/**
 * The weakest pair among a set of selected spices — the natural place to
 * offer a bridge in the Blend Builder. Returns null with fewer than 2 spices.
 */
export function findWeakestPair(
  selectedIds: Iterable<string>
): { a: string; b: string; evidence: PairEvidence | null } | null {
  const ids = [...selectedIds];
  if (ids.length < 2) return null;

  let weakest: { a: string; b: string; evidence: PairEvidence | null } | null =
    null;
  let weakestScore = Infinity;

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const evidence = getPairEvidence(ids[i], ids[j]);
      // Pairs with no evidence at all rank as weakest (score 0).
      const score = evidence?.score ?? 0;
      if (score < weakestScore) {
        weakestScore = score;
        weakest = { a: ids[i], b: ids[j], evidence };
      }
    }
  }
  return weakest;
}
