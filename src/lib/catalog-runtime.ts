import type { CompoundOverlap, PairingEntry } from "@/types/pairing";
import type { FlavorNode } from "@/types/spice";

export type CatalogSnapshot = {
  spiceTaxonomy: FlavorNode;
  generatedProfiles: Record<string, unknown>;
  profileOrder: string[];
  flavorAtlas: { points: Record<string, { x: number; y: number }> } & Record<string, unknown>;
  classicBlends: Array<{ id: string; name: string; origin: string; description: string; spiceIds: string[] }>;
  spicePairings: PairingEntry[];
  pairingScores: Array<{ a: string; b: string; score: number }>;
  compoundOverlap: Array<CompoundOverlap & { a: string; b: string }>;
  aromaFingerprints: Record<string, { vector?: Record<string, number> | null; descriptors?: unknown[] }>;
  pungencyEvidence: Record<string, unknown>;
  dishAffinities: Array<{ id: string; name: string; category: string; fgNode: string; scores: Record<string, number> }>;
  cuisineFrequencies: Record<string, unknown>;
  flavorVectors: Record<string, { warmth: number; brightness: number; earthiness: number; florality: number; heat: number; intensity: number }>;
};

let snapshot: CatalogSnapshot | null = null;
export function configureCatalog(next: CatalogSnapshot) { snapshot = next; }
export function catalog(): CatalogSnapshot {
  if (!snapshot) throw new Error("Catalog data has not finished loading.");
  return snapshot;
}
