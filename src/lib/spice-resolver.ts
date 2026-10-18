import type { FlavorNode } from "@/types/spice";
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z]/g, ""); }
const aliases: Record<string, string> = { bayleaves: "herbal.leafy.bay-leaf", chilipowder: "hot-pungent.chili.red-pepper-flakes", paprika: "earthy.smoky.smoked-paprika", sweetpaprika: "earthy.smoky.paprika", rose: "floral.rose-family.rose-water" };
export function displayName(name: string) { const proper = new Set(["Sichuan", "Aleppo", "Thai", "Kaffir"]); return name.trim().split(/\s+/).map((word, i) => { if (proper.has(word)) return word; const lower = word.toLowerCase(); return i === 0 ? lower[0].toUpperCase() + lower.slice(1) : lower; }).join(" "); }
export function createTaxonomyResolver(taxonomy: FlavorNode) {
  const byName = new Map<string, string>(), bySegment = new Map<string, string>(), names = new Map<string, string>();
  const walk = (node: FlavorNode) => { if (node.level === "spice") { byName.set(normalize(node.name), node.id); bySegment.set(normalize(node.id.split(".").pop()!), node.id); names.set(node.id, node.name); } node.children?.forEach(walk); };
  walk(taxonomy);
  const toTaxonomyId = (slug: string, name?: string) => { for (const candidate of [slug, name ?? "", slug.replace(/s$/, ""), (name ?? "").replace(/s$/, "")]) { const id = aliases[normalize(candidate)] ?? byName.get(normalize(candidate)) ?? bySegment.get(normalize(candidate)); if (id) return id; } return null; };
  return { toTaxonomyId, spiceName: (id: string) => names.get(id) ? displayName(names.get(id)!) : id };
}
