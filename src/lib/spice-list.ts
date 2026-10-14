import taxonomyData from "@/data/spice-taxonomy.json";
import type { FlavorNode } from "@/types/spice";

/** A spice leaf from the taxonomy: dot-id + display name. */
export interface SpiceRef {
  id: string;
  name: string;
}

/** All 72 taxonomy spices, in taxonomy order. */
export const allSpices: SpiceRef[] = (() => {
  const spices: SpiceRef[] = [];
  function walk(node: FlavorNode) {
    if (node.level === "spice") spices.push({ id: node.id, name: node.name });
    node.children?.forEach(walk);
  }
  walk(taxonomyData as FlavorNode);
  return spices;
})();

const PROPER_NOUNS = ['Sichuan', 'Aleppo', 'Thai', 'Kaffir'];

/** One naming style everywhere: sentence case, proper nouns kept ("Thai basil", "Star anise"). */
export function displayName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words
    .map((w, i) => {
      if (PROPER_NOUNS.includes(w)) return w;
      const lower = w.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

const nameById = new Map(allSpices.map((s) => [s.id, displayName(s.name)]));

/** Display name for a taxonomy spice id (falls back to the last id segment). */
export function spiceName(id: string): string {
  const known = nameById.get(id);
  if (known) return known;
  return id
    .split(".")
    .pop()!
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
