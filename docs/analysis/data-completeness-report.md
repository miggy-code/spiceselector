# Flavor data completeness report

Historical 73-ingredient snapshot. See the [2026-10-17 expansion report](../research/spice-expansion-2026-10-17.md) for the current 86-ingredient collection.

Final pipeline audit for the 2026-10-13 work session (completed 2026-10-14).

73/73 taxonomy leaves map to exactly one active profile using the application's actual
`toTaxonomyId`, not a Python approximation. Zero missing, duplicate or unmapped identities.
73 flavor vectors and 73 PCA atlas points are generated. The 72-leaf taxonomy became 73
because sweet Paprika and Smoked Paprika are distinct ingredients. Retaining both preserves
useful unsmoked versus smoky flavor differences; merging them would discard that distinction.
Paprika now has `id: sweet-paprika`, `legacy_id: paprika`, and a new resolver alias. The old
`paprika` alias remains unchanged for compatibility; old links using that slug still resolve
to smoked paprika. New profiles use the unambiguous slug. Bay leaves is archived inside
Bay leaf's `merged_profiles`; all original 57 source records remain recoverable. Numerical
axes of all retained original records are unchanged, and the archived bay record is intact.

The 17 new records were authored by a Luna subagent at the user's explicit request after
Gemini rejected the configured/replacement key with consumer suspension. They pass the
same Pydantic schema and are imported using `--import-profiles --skip-existing`.
`generation_provenance` identifies model, estimated axes and actual compound context.
Ten had cached FlavorDB2 context (exact or approximate); seven had no local molecule context.
Any literature-knowledge compound notes in these authored profiles are unverified model
knowledge, not a newly ingested or individually cited literature dataset. They do not enter
the measured-data fingerprint pipeline. Cuisine/pairing/substitute claims remain estimates.

Canonical active families: `citrus-bright`, `earthy`, `floral`, `herbal`, `hot-pungent`, `sweet`, `umami-savory`, `warm`.
Assignments are derived from taxonomy. Legacy taxonomy places Sumac under earthy; this
pass preserves its identifier rather than moving it to the README's illustrative citrus group.

## Fingerprints

52/73 nonmissing: 38 exact, 14 approximate. 21 have `vector: null`, quality `none`.
Mapping quality is not a guarantee of analytical validity. These vectors summarize
source molecule presence and descriptor annotations, not measured sensory intensity.
No values are invented for uncovered spices. Missing: Mace, Sichuan Pepper, Long Pepper, Cayenne, Red Pepper Flakes, Chipotle, Gochugaru, Aleppo Pepper, Tonka Bean, Mahlab, Galangal, Sumac, Paprika, Kaffir Lime Leaf, Shiso, Cilantro, Lavender, Chamomile, Elderflower, Yuzu, Nutritional Yeast.

Twelve families: woody, citrus, floral, sweet-balsamic, spicy-phenolic, green-herbal,
earthy-roasty, sulfurous-alliaceous, minty-camphor, fruity, fatty-waxy, nutty.
See [method and unmatched vocabulary](aroma-method.json),
[pipeline reproduction](../../ingestion/README.md) and [sources/licenses](../data-sources.md).

## Axis comparison

52 observations (all covered profiles); exact-only sensitivity has 38. Pearson is linear
correlation; Spearman compares ranks. All observations are dependent through shared spices
and source entities. No significance or causality is claimed. Matched families are listed
in [machine-readable audit](axis-fingerprint-audit.json). No axis was recalibrated.

| Axis | Pearson | Spearman | Exact-only Pearson | Exact-only Spearman |
|---|---:|---:|---:|---:|
| warmth | 0.2045 | 0.2762 | 0.1513 | 0.2317 |
| brightness | 0.2892 | 0.3697 | 0.2281 | 0.2947 |
| earthiness | -0.0074 | -0.1056 | -0.1475 | -0.3151 |
| florality | 0.2325 | 0.4332 | 0.2467 | 0.4050 |
| heat | 0.3558 | 0.3995 | 0.2999 | 0.3223 |

Ten largest disagreements, sorted by absolute within-axis population z-score difference
(LLM minus fingerprint). A positive sign means the LLM value is relatively higher. Shares
are compositional, so these are prompts for review, not proof a particular LLM value is wrong.

| Spice | Axis | LLM 0–100 | Fingerprint share | z difference | Source mapping |
|---|---|---:|---:|---:|---|
| Rose | florality | 95 | 0.03873 | +4.0420 | approx |
| Cinnamon | florality | 25 | 0.13705 | -3.5331 | exact |
| Lemongrass | warmth | 10 | 0.54087 | -3.4275 | exact |
| Sesame seed | earthiness | 55 | 0.18175 | -3.4130 | exact |
| Tamarind | brightness | 90 | 0.10533 | +3.3517 | exact |
| Lemongrass | heat | 2 | 0.25391 | -3.2885 | exact |
| Saffron | florality | 90 | 0.05189 | +3.2372 | exact |
| Caraway | brightness | 40 | 0.34252 | -3.2000 | exact |
| Ginger | heat | 65 | 0.11362 | +2.9004 | exact |
| Cumin | earthiness | 95 | 0.02978 | +2.8065 | exact |

Heat descriptor agreement is **not** pungency validation: “spicy” aroma words include
phenolics and baking spice, whereas capsaicin, piperine, gingerols and isothiocyanates
have different mechanisms. `pungency-evidence.json` adds a cited Cayenne range (30,000–50,000
SHU), pepper/ginger/mustard/horseradish/wasabi mechanism classes, and explicitly null unknown
product ranges. No purported whole-product Scoville values are derived from pure compounds.
A common quantitative ranking of these preparations and full heat-axis recalibration remain
unresolved: these sources do not justify them. All map heat scalars are still estimates.

## Source integration and derived coverage

Only **CulinaryDB** was added as a new bulk dataset: 45,772 recipes, 26 cuisine labels,
33/73 spices mapped, with exact/approximate mappings and corpus denominators. Zero in a
mapped cuisine means no observed recipe; missing means no mapping. Its additive artifact
does not silently replace existing cuisine claims. RecipeDB, Pyrfume, Flavornet, Ahn
supplements, RecipeNLG, Recipe1M+ and Wikidata were evaluated/documented only. Pungency
publications are cited reference facts, not an additional imported bulk dataset.
See [recommendation table with primary links](../data-sources.md).

FlavorGraph covers 66/73 (2,145 pairs); dishes cover the same 66 spices across 38 bases.
Compound overlap covers 66/73 (1,437 pairs); missing compounds: Mahlab, Kaffir Lime Leaf,
Shiso, Cilantro, Elderflower, Yuzu, Nutritional Yeast. Profile completion cannot create
experimental chemistry or embeddings for missing source entries. FlavorGraph exclusions
are in `ingestion/flavorgraph_coverage.json`; no fake pair/dish values were added.

## Verification

- Schema validation and source identity normalization passed for all 73 profiles.
- Actual TypeScript resolver strict coverage: 73/73, no collisions or unresolved profiles.
- Python derived pipeline passed: FlavorGraph → FlavorDB2 → compound overlap → dish
  affinities; profile vectors → PCA atlas; fingerprints → axis audit; pungency and cuisines.
- Three invariant tests passed: token mapping, missingness/vector normalization/taxonomy
  coverage, cuisine denominator arithmetic.
- Original retained profile axes verified unchanged; alternate bay source record preserved.
- `npx tsc --noEmit` passed.
- `npx next build` passed with all 73 profiles; static prerender completed. Google Fonts
  required network access for the UI agent's fonts; the sandbox-only attempt failed the
  font fetch, and the network-enabled final build passed.
- `git diff --check` passed on this task's owned paths.

## New fields available to UI

No new UI field is required to keep current consumers working. Optional adoption:

- `aroma-fingerprints.json[taxonomyId]`: `vector`, `topDescriptors` with weights,
  `moleculeCount`, `annotatedMoleculeCount`, `mappedMoleculeCount`, `sourceQuality`,
  `missing`, `missingReason`, `sources` (entity/ingredient and quality).
- `cuisine-frequencies.json.spices[taxonomyId]`: `cuisines` with numeric `frequency`,
  `recipeCount`, `totalRecipes`; `entityId`, `entityName`, `sourceQuality`, `missing`.
  File metadata includes attribution, license, date, input hashes and corpus totals.
- `pungency-evidence.json.spices[taxonomyId]`: `scovilleRange`, `pungencyClass`,
  `sources`, `sourceQuality`, `missing`, `note`. Mechanism evidence does not imply SHU.
- New profiles: `generation_provenance`. Paprika: `legacy_id`; Bay leaf: `merged_profiles`.
  Existing profile fields and axis meanings are retained; no `<axis>_llm` was needed
  because no axis was recalibrated.

## Files changed by this task

Concurrent UI changes are excluded from this list. Re-run outputs are listed even when
a generator produced identical bytes.

- `README.md`, `PLAN.md`, `ingestion/README.md` — data/source/pipeline documentation.
- `ingestion/generate_spice_profiles.py`, `complete_profile_identities.py`,
  `add_paprika_taxonomy.py`, `generated_profiles.json`, `missing_profiles_luna.json`.
- `ingestion/generate_aroma_fingerprints.py`, `check_aroma_axes.py`,
  `check_profile_coverage.ts`, `profile-coverage.json`, `generate_pungency_evidence.py`,
  `ingest_culinarydb.py`, `test_aroma_pipeline.py`, `requirements.txt`.
- `ingestion/culinarydb_cache/.gitignore` and ignored downloaded source CSV cache.
- Rebuilt `ingestion/flavorgraph_coverage.json`, `flavordb2_pairs.json`,
  `flavordb2_coverage.json`, `compound_overlap_coverage.json`.
- `src/data/spice-taxonomy.json`, `pairing-scores.json`, `compound-overlap.json`,
  `dish-affinities.json`, `flavor-vectors.json`, `flavor-atlas.json`,
  `aroma-fingerprints.json`, `cuisine-frequencies.json`, `pungency-evidence.json`.
- `src/lib/spice-id-map.ts` — one new `sweetpaprika` alias only.
- `docs/data-sources.md`, `docs/analysis/aroma-method.json`,
  `docs/analysis/axis-fingerprint-audit.json`, this report.

All work remains uncommitted. No UI files or package manifest were edited by this task.
