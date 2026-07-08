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

/** A flavor compound two spices share (Ahn/USDA layer). */
export interface SharedCompound {
  name: string;
  flavors: string[];
}

/** Compound overlap between an unordered pair of spices. */
export interface CompoundOverlap {
  /** Total shared compounds (aroma + non-aroma). */
  sharedCount: number;
  /** Shared compounds carrying flavor annotations — the pairing evidence. */
  sharedAromaCount: number;
  /** Jaccard index over all shared compounds (0–1). */
  jaccard: number;
  /** Listed aroma compounds (capped) for the "why" popover. */
  shared: SharedCompound[];
}
