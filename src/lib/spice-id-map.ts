import type { FlavorNode } from "@/types/spice";
import { catalog } from "./catalog-runtime";

/**
 * Bridge between the two spice-id spaces in this app:
 *   - Flavor Map / generated_profiles.json use slug ids ("cinnamon", "cloves").
 *   - The taxonomy + all pairing data (FlavorGraph, compounds) use dot ids
 *     ("warm.baking.cinnamon").
 * The pairing engine keys on taxonomy ids, so map features must translate first.
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

// Slug/name overrides for spices whose normalized form doesn't hit a taxonomy leaf.
const ALIASES: Record<string, string> = {
  bayleaves: "herbal.leafy.bay-leaf",
  chilipowder: "hot-pungent.chili.red-pepper-flakes",
  paprika: "earthy.smoky.smoked-paprika",
  sweetpaprika: "earthy.smoky.paprika",
  rose: "floral.rose-family.rose-water",
};

const indexCache = new WeakMap<FlavorNode, { byName: Map<string, string>; bySegment: Map<string, string> }>();
function indexes() {
  const taxonomy = catalog().spiceTaxonomy;
  const cached = indexCache.get(taxonomy);
  if (cached) return cached;
  const byName = new Map<string, string>();
  const bySegment = new Map<string, string>();
  function walk(node: FlavorNode) {
    if (node.level === "spice") {
      byName.set(normalize(node.name), node.id);
      bySegment.set(normalize(node.id.split(".").pop()!), node.id);
    }
    node.children?.forEach(walk);
  }
  walk(taxonomy);
  const result = { byName, bySegment };
  indexCache.set(taxonomy, result);
  return result;
}

/**
 * Resolve a Flavor Map spice (slug id, optionally with display name) to its
 * taxonomy dot-id, or null if there's no match.
 */
export function toTaxonomyId(slug: string, name?: string): string | null {
  const { byName, bySegment } = indexes();
  const candidates = [slug, name ?? "", slug.replace(/s$/, ""), (name ?? "").replace(/s$/, "")];
  let resolved: string | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const key = normalize(c);
    const found = ALIASES[key] ?? byName.get(key) ?? bySegment.get(key);
    if (found) {
      resolved = found;
      break;
    }
  }
  return resolved;
}
