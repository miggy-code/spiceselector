import dishData from "@/data/dish-affinities.json";
import { spiceName } from "./spice-list";

/**
 * Dish anchoring: FlavorGraph affinities between our spices and common base
 * ingredients ("what goes on salmon?"). Data from ingest_dish_affinities.py;
 * scores are the same 0–1 normalized cosine as pairing-scores.json.
 */

export interface Dish {
  id: string;
  name: string;
  category: string;
  fgNode: string;
  /** taxonomy spice id → affinity (0–1). */
  scores: Record<string, number>;
}

export const allDishes = dishData as Dish[];

const byId = new Map(allDishes.map((d) => [d.id, d]));

export function getDish(dishId: string): Dish | undefined {
  return byId.get(dishId);
}

/** Dishes grouped by category, in the data's category order. */
export function dishesByCategory(): Array<[string, Dish[]]> {
  const groups = new Map<string, Dish[]>();
  for (const d of allDishes) {
    const list = groups.get(d.category) ?? [];
    list.push(d);
    groups.set(d.category, list);
  }
  return Array.from(groups.entries());
}

export interface DishSpiceScore {
  spiceId: string;
  spiceName: string;
  /** Raw FlavorGraph affinity to the dish (0–1). */
  score: number;
  /** Score relative to this dish's best spice — affinity ranges differ a lot per dish. */
  relative: number;
}

/** Spices ranked for a dish, best first. */
export function getDishSpiceRanking(
  dishId: string,
  options: { limit?: number; excludeIds?: Iterable<string> } = {}
): DishSpiceScore[] {
  const { limit = 8, excludeIds } = options;
  const dish = byId.get(dishId);
  if (!dish) return [];
  const excluded = new Set(excludeIds ?? []);
  const entries = Object.entries(dish.scores).filter(([id]) => !excluded.has(id));
  const max = entries.reduce((m, [, s]) => Math.max(m, s), 0);
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([spiceId, score]) => ({
      spiceId,
      spiceName: spiceName(spiceId),
      score,
      relative: max > 0 ? score / max : 0,
    }));
}

/** A single spice's affinity to a dish, null when the spice is unembedded. */
export function getDishFit(dishId: string, spiceId: string): number | null {
  return byId.get(dishId)?.scores[spiceId] ?? null;
}
