import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }

// Catch the regression even when the hosted catalog is unavailable.
for (const file of readdirSync("src", { recursive: true })) {
  if (!/\.[jt]sx?$/.test(file)) continue;
  const source = readFileSync(`src/${file}`, "utf8");
  assert.doesNotMatch(source, /(?:from\s*|import\s*|require\s*\()\s*["'][^"']+\.json["']/, `${file} imports catalog JSON`);
  assert.doesNotMatch(source, /readFile(?:Sync)?\([^;]*generated_profiles\.json/, `${file} reads local profiles`);
}
console.log("PASS: no runtime JSON catalog readers");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, "Configure the Supabase URL and publishable key to check guest access");
const response = await fetch(`${url}/rest/v1/rpc/catalog_snapshot`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}",
  signal: AbortSignal.timeout(30_000),
});
assert.equal(response.status, 200, `Guest catalog request failed: HTTP ${response.status}`);
const catalog = await response.json();
const ids = new Set();
function walk(node) {
  if (node.level === "spice") ids.add(node.id);
  node.children?.forEach(walk);
}
walk(catalog.spiceTaxonomy);
for (const blend of catalog.classicBlends) {
  assert.ok(blend.spiceIds.length, `Empty blend: ${blend.id}`);
  for (const id of blend.spiceIds) assert.ok(ids.has(id), `Unknown blend spice: ${blend.id}/${id}`);
}
assert.ok(Object.keys(catalog.generatedProfiles).length, "The catalog contains no profiles");
console.log(`PASS: guest catalog has ${ids.size} spices, ${catalog.classicBlends.length} blends, ${catalog.classicBlends.reduce((sum, blend) => sum + blend.spiceIds.length, 0)} blend memberships`);

// Only compare during migration verification: later database edits are intentional.
if (process.argv.includes("--compare-inputs")) {
  const inputs = {
    spiceTaxonomy: "src/data/spice-taxonomy.json",
    generatedProfiles: "ingestion/generated_profiles.json",
    classicBlends: "src/data/classic-blends.json",
    spicePairings: "src/data/spice-pairings.json",
    pairingScores: "src/data/pairing-scores.json",
    compoundOverlap: "src/data/compound-overlap.json",
    flavorVectors: "src/data/flavor-vectors.json",
    flavorAtlas: "src/data/flavor-atlas.json",
    aromaFingerprints: "src/data/aroma-fingerprints.json",
    dishAffinities: "src/data/dish-affinities.json",
    cuisineFrequencies: "src/data/cuisine-frequencies.json",
    pungencyEvidence: "src/data/pungency-evidence.json",
  };
  for (const [name, file] of Object.entries(inputs)) {
    assert.deepEqual(catalog[name], JSON.parse(readFileSync(file, "utf8")), `Imported ${name} differs from ${file}`);
  }
  assert.deepEqual(catalog.profileOrder, Object.keys(JSON.parse(readFileSync(inputs.generatedProfiles, "utf8"))));
  console.log("PASS: all 12 datasets and profile ordering match the migration inputs exactly");
}
