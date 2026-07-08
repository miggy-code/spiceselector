import MapClientLoader from '@/components/MapClientLoader';
import { promises as fs } from 'fs';
import path from 'path';

export default async function Home() {
  // Fetch spice data from local JSON instead of Supabase
  let data: Record<string, unknown>[] = [];
  try {
    const rawData = await fs.readFile(path.join(process.cwd(), 'ingestion/generated_profiles.json'), 'utf8');
    const profiles = JSON.parse(rawData);
    
    data = Object.values(profiles).map((p: any) => ({
      id: p.id,
      name: p.name,
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
      cuisine_names: (p.cuisines || []).map((c: any) => c.cuisine),
      subfamilies: p.subfamilies || [],
      substitutes: (p.substitutes || []).slice(0, 6).map((s: any) => ({
        spice: s.spice,
        similarity: s.similarity ?? null,
        notes: s.notes ?? null,
      })),
    }));
  } catch (error) {
    console.error("Failed to load local spice data:", error);
  }

  return (
    <main className="h-screen bg-black overflow-hidden">
      {data.length > 0 ? (
        <MapClientLoader data={data} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-950 text-red-400 text-sm text-center">
          <p>Error loading spice data.</p>
          <p className="mt-1 opacity-70">Please ensure ingestion/generated_profiles.json exists.</p>
        </div>
      )}
    </main>
  );
}
