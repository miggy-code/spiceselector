# Data Ingestion Pipeline

Offline scripts that build the static data the app ships with. **You don't need to
run any of this to use the app** — every output the frontend reads is committed.
Run it only to regenerate or extend the data.

Run everything from this directory (`cd ingestion`) — `ingest_foodb.py` imports
`usda_scraper.py` as a module.

```bash
pip install -r requirements.txt
```

## Pipeline order

| # | Script | Reads | Writes |
|---|--------|-------|--------|
| 1 | `usda_scraper.py` | phytochem.nal.usda.gov | `../idea/spice_data_raw.json` |
| 2 | `ingest_foodb.py` | `../foodb_2020_04_07_csv/*.csv` | `../idea/foodb_spice_data.json` |
| 3 | `generate_spice_profiles.py` | `../idea/spice_data_raw.json`, Gemini API | `generated_profiles.json` |
| 4 | `ingest_flavorgraph.py` | FlavorGraph GitHub (cached in `flavorgraph_data/`), `../src/data/spice-taxonomy.json` | `../src/data/pairing-scores.json`, `flavorgraph_coverage.json` |
| 5 | `ingest_flavordb2.py` | FlavorDB2 entity JSON (cached in `flavordb2_cache/`, fetched on miss), taxonomy, steps 1–2 outputs (gap rule) | `flavordb2_pairs.json`, `flavordb2_coverage.json` |
| 6 | `ingest_compound_overlap.py` | `../idea/foodb_spice_data.json`, `../idea/spice_data_raw.json`, `flavordb2_pairs.json`, taxonomy | `../src/data/compound-overlap.json`, `compound_overlap_coverage.json` |
| 7 | `ingest_dish_affinities.py` | `flavorgraph_data/kitchenette_embeddings.pkl`, `flavorgraph_coverage.json` | `../src/data/dish-affinities.json` |
| 8 | `extract_flavor_vectors.ts` | `generated_profiles.json`, `../src/lib/spice-id-map.ts` | `../src/data/flavor-vectors.json` |

Steps 1–2, 4 are independent of each other. Step 5 needs 1 + 2 (to know which spices
FooDB/USDA already cover), step 6 needs 1 + 2 + 5 (**run 5 before 6**), step 7 needs 4,
step 8 needs 3.

### 1. USDA phytochemical scrape

```bash
python3 usda_scraper.py
```

Scrapes the USDA Dr. Duke's Phytochemical and Ethnobotanical Databases for the
spices in `SPICE_MAPPING` (common name → botanical name). Saves after each spice and
skips spices already in the output, so it's safe to re-run. ~1 s delay between
requests.

### 2. FooDB compound extraction

```bash
python3 ingest_foodb.py
```

Requires the FooDB CSV dump (`foodb_2020_04_07_csv`, from [foodb.ca](https://foodb.ca/downloads))
extracted at the **project root**, i.e. `../foodb_2020_04_07_csv` relative to this
directory. It's large and gitignored. Streams `Content.csv` to collect the compounds
present in each spice, plus FooDB's compound → flavor annotations
(`Flavor.csv`, `CompoundsFlavor.csv`). These flavor tags are what make a shared
compound an *aroma* compound in the "why" popover.

FooDB data is used under FooDB's terms (non-commercial use; see foodb.ca).

### 3. Gemini spice profiles

```bash
# GOOGLE_API_KEY is read from the environment or ../.env.local
python3 generate_spice_profiles.py --list               # status of every spice
python3 generate_spice_profiles.py --spice "Cumin"      # one spice
python3 generate_spice_profiles.py --all --skip-existing
```

Feeds each spice's USDA compound list to **Gemini 2.5 Flash** with a Pydantic
structured-output schema: five-axis flavor scores (0–100), intensity, commonality,
heat level, cuisines, top pairings (classic / complementary / surprising + note),
substitutes, and key compounds. Profiles are saved automatically after each spice
(review them in the printed summary or the JSON).

`--all` without `--skip-existing` **regenerates and overwrites** existing profiles.

### 4. FlavorGraph recipe affinity

```bash
python3 ingest_flavorgraph.py
```

Downloads the FlavorGraph node list and 300-d embeddings (skipped if already in
`flavorgraph_data/`), matches each taxonomy spice to a node that actually has an
embedding (hand-verified `NAME_OVERRIDES` + plural/seed variants), and writes the
cosine similarity for every pair. `flavorgraph_coverage.json` records matches and
flags approximate stand-ins (e.g. Tamarind → `tamarind_paste`).

### 5. FlavorDB2 molecule overlap

```bash
python3 ingest_flavordb2.py
```

[FlavorDB2](https://cosylab.iiitd.edu.in/flavordb2/) (Garg et al., *FlavorDB: a
database of flavor molecules*, Nucleic Acids Research 2018,
doi:10.1093/nar/gkx957; update arXiv:2205.05451) lists the flavor molecules found in
each natural-ingredient entity, with a `flavor_profile` per molecule. Spices are mapped
to entities by the hand-verified `FLAVORDB2_MAP` (`spice → (entity_id, "exact" | "approx")`).
Entity JSON is read from `flavordb2_cache/` (git-ignored) and fetched from
`https://cosylab.iiitd.edu.in/flavordb2/entities_json?id=<id>` only when missing
(90 s timeout, 0.3 s delay, 3 retries; the server takes a few seconds per entity).

**Which pairs get a FlavorDB2 signal (pair-level rule).** A spice's entry is *usable*
if its entity has at least 30 molecules (exact or approx). A pair gets a signal when
both spices are usable, they map to **different** entity ids, **and** either both are
`exact` or the pair has **no FooDB/USDA signal** (it is absent from the FooDB/USDA
pair list). So `approx` stand-ins (lemon peel oil for Lemon Zest, lime fruit for Dried
Lime, garlic for Black Garlic, mustard for Mustard Seed, …) **fill gaps** pair by pair
but never add a second opinion where FooDB/USDA already has evidence: Cumin × Coriander
Seed stays FooDB-only, while Horseradish × Mustard Seed (Horseradish has no FooDB/USDA
data) is scored by FlavorDB2. Thin or wrong entries are deliberately unmapped (Mace,
White Pepper, Caraway, Galangal, Rose Water, Lemongrass, Chamomile, generic Capsicum
chilies, Cilantro). `flavordb2_coverage.json` lists every spice as usable/excluded with
the reason, entity and quality, plus counts of pairs skipped by each rule.

**Pair score — IDF-weighted cosine.** Raw Jaccard is useless here: ~90 molecules appear
in nearly every entity, so Saffron × Horseradish would outscore Cumin × Coriander.
IDF is computed over **all usable entries**: *N* = number of distinct usable entity
ids, `df(m)` = how many of those entities contain molecule *m* (by PubChem id; a
shared entity such as Garlic 259 counts once) and `idf(m) = ln(N / df(m))`:

```
score(A,B) = Σ_{m ∈ A∩B} idf² / ( √Σ_{m ∈ A} idf² · √Σ_{m ∈ B} idf² )
```

Pairs that share one entity (Lime Zest / Dried Lime → entity 241, Garlic Powder / Black
Garlic → 259) score 1.0 trivially, are stand-ins rather than evidence, and are excluded. Each emitted pair in `flavordb2_pairs.json` carries
`score`, `sharedCount` and `sharedFlavorWords` (top 8 flavor words, ranked by the summed
idf of the shared molecules carrying them).

### 6. Compound overlap (FooDB + USDA + FlavorDB2)

```bash
python3 ingest_flavordb2.py          # first
python3 ingest_compound_overlap.py
```

Merges the two FooDB/USDA compound sources keyed by normalized chemical name, then for
every spice pair emits `sharedCount`, `sharedAromaCount` (shared compounds with FooDB
flavor tags), `jaccard`, and up to 8 listed aroma compounds (unchanged). It then merges
`flavordb2_pairs.json`: Jaccard and IDF-cosine are on different scales, so each source
is converted to a **percentile rank within its own distribution of pair values**
(0–1, ties averaged), and the pair's `compoundScore` is the **mean of the available
percentile ranks** (one or both sources). Each pair also gets `flavordb2`
(`{score, sharedCount, sharedFlavorWords}`, when present) and `sources`
(`"foodb_usda"` / `"flavordb2"`). Pairs with only FlavorDB2 evidence — those with no FooDB/USDA signal — are added
with zeroed FooDB fields. The app reads
`compoundScore`; `jaccard` is kept for reference. Compound coverage goes from 55/72 to
65/72 spices.

**License:** `compound-overlap.json` now embeds data derived from FlavorDB2 (CC BY-NC-SA
3.0), so that file is distributed under CC BY-NC-SA 3.0 — non-commercial use only,
which is consistent with FooDB's terms.

### 7. Dish affinities

```bash
python3 ingest_dish_affinities.py
```

Scores every FlavorGraph-matched spice against 38 base ingredients (proteins,
vegetables, grains, fruit, dairy) for the "Cooking something?" dish picker. Reuses
the matching from step 4.

### 8. Flavor vectors

```bash
# from the project root
npx tsx --tsconfig tsconfig.json ingestion/extract_flavor_vectors.ts
```

Re-keys the five-axis vectors from `generated_profiles.json` (profile slugs) to
taxonomy ids using the app's own `spice-id-map.ts`, producing the slim
`src/data/flavor-vectors.json` used by the substitution engine and blend builder.

## Static data with no generator

`src/data/spice-taxonomy.json`, `spice-pairings.json` (curated pairing labels) and
`classic-blends.json` are curated by hand / LLM-seeded and committed directly.

## Legacy scripts

- `generate_coords.py` — UMAP over FooDB compound vectors →
  `../public/data/spice_3d_coordinates.json`. The current 3D map positions spices on
  the selectable flavor axes instead, so the app no longer reads this file.
- `compute_compound_overlap.py` — Supabase-era Jaccard scorer that writes to a
  `pairings` table. Supabase has been removed; superseded by
  `ingest_compound_overlap.py`. Needs `pip install supabase` and SUPABASE_* env vars.
- `test_generation.py` — early single-spice smoke test; imports the old
  `google.generativeai` SDK, not `google-genai`.
# Flavor atlas coordinates

After changing `generated_profiles.json`, run `python3 ingestion/generate_flavor_atlas.py` from the project root. This writes the committed `src/data/flavor-atlas.json` using a deterministic PCA projection of all five flavor axes. The atlas uses full-dataset bounds so cuisine and heat filters preserve the neighborhood layout. It does not measure pairing quality; recipe-affinity links are a separate layer.


## Complete profiles, fingerprints and empirical cuisine data (2026-10-13)

The current taxonomy adds unsmoked **Paprika**, separate from Smoked Paprika: 73 leaves.
Its profile slug is `sweet-paprika` (with `legacy_id: paprika`); the new `sweetpaprika`
resolver alias avoids changing the historical `paprika` alias. Bay leaf/Bay leaves
are merged into the singular profile, with the alternate record in `merged_profiles`.
`complete_profile_identities.py` derives all active family labels from taxonomy ids.

The 17 missing profiles were authorized for local Luna authorship after Gemini
returned `CONSUMER_SUSPENDED`. Their `generation_provenance` distinguishes authored
estimates from measured data. Original profiles' numerical axes are preserved.
To import a newly authored batch through the existing schema and skip-existing path:

```bash
# Run from project root; no API needed for import or derived steps.
python3 ingestion/add_paprika_taxonomy.py
python3 ingestion/generate_spice_profiles.py --import-profiles ingestion/missing_profiles_luna.json --skip-existing
python3 ingestion/complete_profile_identities.py
npx --yes tsx --tsconfig tsconfig.json ingestion/check_profile_coverage.ts --strict
python3 ingestion/ingest_flavorgraph.py
python3 ingestion/ingest_flavordb2.py
python3 ingestion/ingest_compound_overlap.py
python3 ingestion/ingest_dish_affinities.py
npx --yes tsx --tsconfig tsconfig.json ingestion/extract_flavor_vectors.ts
python3 ingestion/generate_flavor_atlas.py
python3 ingestion/generate_aroma_fingerprints.py
python3 ingestion/check_aroma_axes.py
python3 ingestion/generate_pungency_evidence.py
python3 ingestion/ingest_culinarydb.py --download  # first run only; explicit CC BY-NC-SA 3.0
python3 ingestion/ingest_culinarydb.py             # subsequent offline runs
python3 -m unittest discover -s ingestion -p test_aroma_pipeline.py
npx tsc --noEmit
npx next build
```

USDA and FooDB raw extraction do not need repeating unless their inputs change.
FlavorGraph and FlavorDB2 use existing local caches and fetch on cache miss. Unmatched
spices never receive synthetic pair/dish scores: consult coverage reports. New profiles
do not create new experimental chemistry evidence.

### Aroma fingerprint method

`generate_aroma_fingerprints.py` reads **all mapped cached FlavorDB2 entities**, including
thin entries if mapped, and FooDB compound flavor annotations. USDA has no descriptors
in this extract and contributes no fingerprint values. Whole-word descriptor lookup
maps into 12 fixed aroma families (`docs/analysis/aroma-method.json` records the exact
vocabulary and unmatched descriptors). PubChem ids deduplicate FlavorDB2 molecules;
unique exact normalized-name matches bridge FooDB to those ids, otherwise FooDB ids
remain source-specific. No aggressive stereochemical or fuzzy cross-source merge.
Unresolved synonyms can therefore remain duplicated; this is a documented limitation.

IDF = `ln(N / df)` across distinct source ingredient/entity documents (shared stand-ins
count once per source). Each molecule's IDF mass is split equally across its distinct
matched families, then the spice vector is L1-normalized. No concentration, odor activity
or sensory intensity is implied; source descriptors include taste words and potentially
nonvolatile compounds. Exact/approx refers to ingredient mapping, not analytical quality.
Any approximate input conservatively marks the combined fingerprint approximate.
No mapped positive descriptor weight means `vector: null`, `missing: true`, quality `none`.

`check_aroma_axes.py` reports Pearson and Spearman correlations, including exact-only
sensitivity, and the 10 largest absolute within-axis z-score disagreements. This is
an audit, not a calibration. Compositional family shares, sparse chemistry and LLM axis
semantics differ. Heat vs spicy/phenolic descriptors **does not validate pungency**.
`pungency-evidence.json` provides cited Scoville evidence for Cayenne and mechanism
classes for pepper, ginger and mustard/horseradish/wasabi. Unknown product ranges remain
null. No universal cross-mechanism numeric rank is asserted; original heat axes remain
estimates. A product-specific heat calibration remains future work.

### Empirical cuisine frequencies

`ingest_culinarydb.py` adds the single additional bulk source: CulinaryDB. Frequency is
unique recipes containing the mapped ingredient / total corpus recipes in that cuisine.
Raw CSVs stay in an ignored cache; hashes and attribution travel with the output. No
compound-ingredient decomposition, fuzzy cultivar substitution or inferred quantities.
Unmapped spices are missing, whereas zero within a mapped cuisine means zero observed
recipes. Approximate ingredient/part matches are flagged. This new artifact is additive;
it does not silently replace LLM `cuisines` or change the UI filter semantics.
See [source/license evaluation](../docs/data-sources.md) for obligations and rejected sources.
