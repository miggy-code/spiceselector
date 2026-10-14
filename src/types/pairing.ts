export interface PairingLink {
  spiceId: string;
  affinity: "classic" | "complementary" | "surprising";
  note?: string;
  cuisines?: string[];
}

export interface PairingEntry {
  spiceId: string;
  pairsWith: PairingLink[];
}

/** A flavor compound two spices share (FooDB/USDA layer). */
export interface SharedCompound {
  name: string;
  flavors: string[];
}

/** Which chemistry source(s) contributed to a pair's compound signal. */
export type CompoundSource = "foodb_usda" | "flavordb2";

/** FlavorDB2 evidence for a pair (IDF-weighted cosine over molecule sets). */
export interface FlavorDB2Overlap {
  /** IDF-weighted cosine similarity (0–1, raw — not percentile-ranked). */
  score: number;
  /** Molecules shared by the two spices' FlavorDB2 entities. */
  sharedCount: number;
  /** Top flavor words carried by the shared molecules (IDF-weighted). */
  sharedFlavorWords: string[];
}

/** Compound overlap between an unordered pair of spices. */
export interface CompoundOverlap {
  /**
   * Total shared FooDB/USDA compounds (aroma + non-aroma). 0 for pairs that
   * only have FlavorDB2 evidence (sources lacks "foodb_usda").
   */
  sharedCount: number;
  /** Shared compounds carrying flavor annotations — the pairing evidence. */
  sharedAromaCount: number;
  /** FooDB/USDA Jaccard index over all shared compounds (0–1). */
  jaccard: number;
  /** Listed aroma compounds (capped) for the "why" popover. */
  shared: SharedCompound[];
  /** FlavorDB2 evidence, when both spices have a FlavorDB2 entry. */
  flavordb2?: FlavorDB2Overlap;
  /**
   * The compound signal feeding the engines (0–1): mean of the percentile
   * ranks of the available source scores. Use this, not `jaccard`.
   */
  compoundScore: number;
  /** Sources that contributed to this pair. */
  sources: CompoundSource[];
}
