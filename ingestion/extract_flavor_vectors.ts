/**
 * Extract 5-axis flavor vectors from generated_profiles.json, re-keyed from
 * profile slugs to taxonomy dot-ids via the app's own spice-id-map, and write
 * the slim artifact src/data/flavor-vectors.json for the substitution engine.
 *
 * Run from the project root: npx tsx --tsconfig tsconfig.json ingestion/extract_flavor_vectors.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { toTaxonomyId } from "../src/lib/spice-id-map";
import profilesData from "./generated_profiles.json";

interface Profile {
  id: string;
  name: string;
  warmth: number;
  brightness: number;
  earthiness: number;
  florality: number;
  heat: number;
  intensity: number;
}

const profiles = Object.values(profilesData) as Profile[];

const vectors: Record<
  string,
  { warmth: number; brightness: number; earthiness: number; florality: number; heat: number; intensity: number }
> = {};
const unmapped: string[] = [];

for (const p of profiles) {
  const taxonomyId = toTaxonomyId(p.id, p.name);
  if (!taxonomyId) {
    unmapped.push(p.id);
    continue;
  }
  // Aliases can map two profiles onto one taxonomy id (chili-powder →
  // red-pepper-flakes); keep the profile whose slug is the taxonomy leaf.
  if (taxonomyId in vectors && taxonomyId.split(".").pop() !== p.id) {
    console.log(`Collision: ${p.id} also maps to ${taxonomyId}, keeping existing`);
    continue;
  }
  vectors[taxonomyId] = {
    warmth: p.warmth,
    brightness: p.brightness,
    earthiness: p.earthiness,
    florality: p.florality,
    heat: p.heat,
    intensity: p.intensity,
  };
}

const outPath = join(__dirname, "..", "src", "data", "flavor-vectors.json");
writeFileSync(outPath, JSON.stringify(vectors, null, 2) + "\n");
console.log(`Wrote ${Object.keys(vectors).length}/${profiles.length} vectors to ${outPath}`);
if (unmapped.length > 0) console.log(`Unmapped profile slugs: ${unmapped.join(", ")}`);
