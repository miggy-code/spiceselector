import flavorVectorsData from "@/data/flavor-vectors.json";
import { getPairEvidence } from "./pairing-engine";
import { allSpices } from "./spice-list";

/**
 * Blend Builder analysis: the combined flavor shape of the selected spices,
 * how well they hang together, and what would balance them.
 * Taxonomy-id space, like the rest of the engine.
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

export const BLEND_AXES = [
  "warmth",
  "brightness",
  "earthiness",
  "florality",
  "heat",
] as const;
export type BlendAxis = (typeof BLEND_AXES)[number];

export interface BlendProfile {
  /** Mean per-axis value (0–100) over the spices that have a vector. */
  axes: Record<BlendAxis, number>;
  /** How many of the blend's spices actually have profile vectors. */
  coveredCount: number;
  totalCount: number;
}

/** Combined 5-axis profile of a blend, or null when no spice has a vector. */
export function getBlendProfile(ids: string[]): BlendProfile | null {
  const vecs = ids.map((id) => flavorVectors[id]).filter(Boolean);
  if (vecs.length === 0) return null;
  const axes = {} as Record<BlendAxis, number>;
  for (const axis of BLEND_AXES) {
    axes[axis] = vecs.reduce((sum, v) => sum + v[axis], 0) / vecs.length;
  }
  return { axes, coveredCount: vecs.length, totalCount: ids.length };
}

export interface BlendCohesion {
  /** Mean blended pair-evidence over all scored pairs (0–1). */
  score: number;
  pairCount: number;
  /** Pairs that actually had evidence — the mean is over these. */
  scoredPairCount: number;
}

/** How well the blend hangs together: mean pairwise evidence. */
export function getBlendCohesion(ids: string[]): BlendCohesion | null {
  if (ids.length < 2) return null;
  let sum = 0;
  let scored = 0;
  let pairs = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs++;
      const ev = getPairEvidence(ids[i], ids[j]);
      if (ev) {
        sum += ev.score;
        scored++;
      }
    }
  }
  if (scored === 0) return null;
  return { score: sum / scored, pairCount: pairs, scoredPairCount: scored };
}

export interface BlendRatio {
  spiceId: string;
  spiceName: string;
  /** Suggested parts, small integers (3 : 2 : 1). */
  parts: number;
  /** base = bulk of the blend, accent = a little goes a long way. */
  role: "base" | "support" | "accent";
  /** True when the spice has no intensity data and got the default. */
  estimated: boolean;
}

// Intensity data spans ~45–90; unknown spices get the midpoint.
const DEFAULT_INTENSITY = 65;

/**
 * Suggested starting ratio for the blend: milder spices carry the bulk,
 * punchy ones stay accents. Inverse-intensity weights, scaled so the
 * smallest share is 1 part. A starting point, not a recipe.
 */
export function getBlendRatios(ids: string[]): BlendRatio[] {
  if (ids.length < 2) return [];
  const entries = ids.map((id) => {
    const vec = flavorVectors[id];
    return {
      spiceId: id,
      intensity: vec?.intensity ?? DEFAULT_INTENSITY,
      estimated: !vec,
    };
  });

  // Intensity data clusters tightly (most spices sit at 75–90), so smooth
  // inverse weighting rounds everything to 1:1. Buckets keep the differences
  // that exist and stay explainable: the punchier the spice, the fewer parts.
  const partsForIntensity = (intensity: number): number => {
    if (intensity < 60) return 4;
    if (intensity < 75) return 3;
    if (intensity < 85) return 2;
    return 1;
  };
  const parts = entries.map((e) => partsForIntensity(e.intensity));

  const maxPart = Math.max(...parts);
  const named = entries.map((e, i) => ({
    spiceId: e.spiceId,
    spiceName: allSpiceNames.get(e.spiceId) ?? e.spiceId,
    parts: parts[i],
    role:
      maxPart === 1
        ? ("support" as const)
        : parts[i] === maxPart
          ? ("base" as const)
          : parts[i] === 1
            ? ("accent" as const)
            : ("support" as const),
    estimated: e.estimated,
  }));
  return named.sort((a, b) => b.parts - a.parts);
}

const allSpiceNames = new Map(allSpices.map((s) => [s.id, s.name]));

export interface GapSuggestion {
  spiceId: string;
  spiceName: string;
  /** The candidate's value on the gap axis (0–100). */
  axisValue: number;
  /** Mean pair evidence against the current blend (0–1), 0 when unscored. */
  fit: number;
}

export interface BlendGap {
  axis: BlendAxis;
  /** The blend's value on that axis (0–100). */
  value: number;
  suggestions: GapSuggestion[];
}

// Heat and florality are deliberate choices, not flaws — a mild blend isn't
// "missing" heat, and most savory blends run low on florality by design.
// Only the core balance axes count as gaps.
const CORE_GAP_AXES: BlendAxis[] = ["warmth", "brightness", "earthiness"];
const GAP_THRESHOLD = 30;
// A candidate must genuinely bring the missing quality.
const CANDIDATE_AXIS_FLOOR = 55;

/**
 * The blend's weakest flavor dimension and the spices that would fill it —
 * strong on the missing axis *and* compatible with what's already there.
 * Null when the blend is reasonably balanced (no axis under the threshold).
 */
export function findBlendGap(
  ids: string[],
  options: { limit?: number } = {}
): BlendGap | null {
  const { limit = 3 } = options;
  const profile = getBlendProfile(ids);
  if (!profile || ids.length < 2) return null;

  let gapAxis: BlendAxis | null = null;
  for (const axis of CORE_GAP_AXES) {
    if (profile.axes[axis] >= GAP_THRESHOLD) continue;
    if (gapAxis === null || profile.axes[axis] < profile.axes[gapAxis]) {
      gapAxis = axis;
    }
  }
  if (!gapAxis) return null;

  const selected = new Set(ids);
  const suggestions: GapSuggestion[] = [];
  for (const s of allSpices) {
    if (selected.has(s.id)) continue;
    const vec = flavorVectors[s.id];
    if (!vec || vec[gapAxis] < CANDIDATE_AXIS_FLOOR) continue;

    let fitSum = 0;
    let fitCount = 0;
    for (const id of ids) {
      const ev = getPairEvidence(s.id, id);
      if (ev) {
        fitSum += ev.score;
        fitCount++;
      }
    }
    suggestions.push({
      spiceId: s.id,
      spiceName: s.name,
      axisValue: vec[gapAxis],
      fit: fitCount > 0 ? fitSum / fitCount : 0,
    });
  }

  suggestions.sort(
    (a, b) =>
      0.55 * (b.axisValue / 100) + 0.45 * b.fit -
      (0.55 * (a.axisValue / 100) + 0.45 * a.fit)
  );
  return { axis: gapAxis, value: profile.axes[gapAxis], suggestions: suggestions.slice(0, limit) };
}
