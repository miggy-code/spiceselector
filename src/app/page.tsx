import CatalogShell from "@/components/CatalogShell";
import { getCatalogSnapshot } from "@/lib/catalog-server";
import { createTaxonomyResolver, displayName } from "@/lib/spice-resolver";
import type { FlavorNode, GeneratedProfile, SpiceProfile } from "@/types/spice";

export const dynamic = "force-dynamic";

function toProfiles(raw: Record<string, unknown>, order: string[], taxonomy: FlavorNode): SpiceProfile[] {
  const resolver = createTaxonomyResolver(taxonomy);
  return order.map((key) => raw[key] as GeneratedProfile).filter(Boolean).map((p) => {
    const tid = resolver.toTaxonomyId(p.id, p.name);
    return {
      id: p.id, name: tid ? resolver.spiceName(tid) : displayName(p.name), family: p.family, description: p.description || null,
      warmth: p.warmth || 0, brightness: p.brightness || 0, earthiness: p.earthiness || 0, florality: p.florality || 0, heat: p.heat || 0,
      intensity: p.intensity || 50, commonality: p.commonality || 50, origin: p.origin || null, heat_level: p.heat_level || null,
      key_compounds: p.key_compounds || [], top_pairings: (p.top_pairings || []).slice(0, 4), cuisines: (p.cuisines || []).slice(0, 4),
      cuisine_names: (p.cuisines || []).map((c) => c.cuisine), subfamilies: p.subfamilies || [],
      substitutes: (p.substitutes || []).slice(0, 6).map((s) => ({ spice: s.spice, similarity: s.similarity ?? null, notes: s.notes ?? null })),
    };
  });
}

export default async function Home() {
  try {
    const catalog = await getCatalogSnapshot();
    const data = toProfiles(catalog.generatedProfiles, catalog.profileOrder, catalog.spiceTaxonomy);
    if (!data.length) throw new Error("The catalog contains no spice profiles.");
    return <main className="h-dvh overflow-hidden bg-board"><CatalogShell data={data} catalog={catalog} /></main>;
  } catch (error) {
    console.error("Catalog load failed:", error);
    return (
      <main className="flex h-dvh w-full flex-col items-center justify-center bg-board px-6 text-center text-body text-chalk-2">
        <p>Catalog data is temporarily unavailable.</p>
        <p className="mt-2 max-w-lg text-small text-chalk-3">Please try again shortly.</p>
        <form action="/" method="get">
          <button className="mt-5 rounded-md border border-rule-strong px-3 py-2 text-small text-chalk hover:bg-board-high">Try again</button>
        </form>
      </main>
    );
  }
}
