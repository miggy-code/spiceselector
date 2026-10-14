import MapClientLoader from '@/components/MapClientLoader';
import { promises as fs } from 'fs';
import path from 'path';
import type { GeneratedProfile, SpiceProfile } from '@/types/spice';
import { toTaxonomyId } from '@/lib/spice-id-map';
import { spiceName, displayName } from '@/lib/spice-list';

export default async function Home() {
  // Load spice profiles from the committed pipeline output (no backend needed)
  let data: SpiceProfile[] = [];
  try {
    const rawData = await fs.readFile(path.join(process.cwd(), 'ingestion/generated_profiles.json'), 'utf8');
    const profiles = JSON.parse(rawData) as Record<string, GeneratedProfile>;
    
    data = Object.values(profiles).map((p) => ({
      id: p.id,
      // One canonical name per spice (taxonomy name, sentence case), so every view agrees.
      name: (() => { const tid = toTaxonomyId(p.id, p.name); return tid ? spiceName(tid) : displayName(p.name); })(),
      family: p.family,
      description: p.description || null,
      warmth: p.warmth || 0,
      brightness: p.brightness || 0,
      earthiness: p.earthiness || 0,
      florality: p.florality || 0,
      heat: p.heat || 0,
      intensity: p.intensity || 50,
      commonality: p.commonality || 50,
      origin: p.origin || null,
      heat_level: p.heat_level || null,
      key_compounds: p.key_compounds || [],
      top_pairings: (p.top_pairings || []).slice(0, 4),
      cuisines: (p.cuisines || []).slice(0, 4),
      cuisine_names: (p.cuisines || []).map((c) => c.cuisine),
      subfamilies: p.subfamilies || [],
      substitutes: (p.substitutes || []).slice(0, 6).map((s) => ({
        spice: s.spice,
        similarity: s.similarity ?? null,
        notes: s.notes ?? null,
      })),
    }));
  } catch (error) {
    console.error("Failed to load local spice data:", error);
  }

  return (
    <main className="h-dvh overflow-hidden bg-board">
      {data.length > 0 ? (
        <MapClientLoader data={data} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-board text-center text-body text-chalk-2">
          <p>Error loading spice data.</p>
          <p className="mt-1 opacity-70">Please ensure ingestion/generated_profiles.json exists.</p>
        </div>
      )}
    </main>
  );
}
