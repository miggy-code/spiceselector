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

const nameById = new Map(allSpices.map((s) => [s.id, s.name]));

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
