# Spice collection expansion — 2026-10-17

Added all 13 requested ingredients: Mint (spearmint), Curry Leaf, Asafoetida, Ajwain,
Black Cardamom, Annatto/achiote, Epazote, Huacatay, Ají Amarillo, Ají Panca, Rocoto,
Juniper Berry, and Savory (summer savory). The collection has **86 taxonomy leaves
and 86 profiles**, with no missing, duplicate or unresolved profile identities when
checked through the application's `toTaxonomyId`.

Three Luna subagent assignments covered profile authorship, SpiceRx evaluation, and
FlavorDB2/Kew evaluation. The parent reviewed their output, corrected three profile
citation gaps, inspected six downloaded FlavorDB2 ingredient records, and rebuilt the
pipeline. No external messages or outreach were sent.

## Data added

The new profiles pass the same Pydantic schema as existing records. Axes, cuisines,
pairing labels and substitute suggestions remain authored estimates, not measurements.
The full original 73 profile records were compared with a pre-expansion snapshot and
are unchanged. No original numerical axis was recalibrated. New chemistry evidence is
separate from the authored axis values.

Mint is specifically *Mentha spicata*, not an undifferentiated peppermint/spearmint
mixture. Savory means *Satureja hortensis*, not winter savory. Black cardamom is
*Amomum subulatum* and does not reuse green-cardamom chemistry. Asafoetida has a new
Savory Resin subgroup, preserving its sulfurous culinary family without calling the
Ferula resin an Allium. The named Peruvian chilies do not borrow generic Capsicum
chemistry or recipe embeddings. Ají Panca's botanical attribution varies by reference;
the profile follows the linked INIA catalog and notes the alternate literature.

Six FlavorDB2 records were downloaded and verified:

| Ingredient | Entity | Distinct PubChem molecules | Mapping |
|---|---:|---:|---|
| Mint / spearmint | 266 | 237 | Approximate: JSON alias is `spearmint-oil` |
| Asafoetida | 376 | 37 | Exact culinary entity |
| Ajwain / Carom Seed | 381 | 155 | Exact seed entity and explicit synonym |
| Curry Leaf | 385 | 31 | Exact culinary entity |
| Savory / Summer savory | 444 | 122 | Exact culinary entity |
| Epazote | 708 | 93 | Exact culinary entity |

These mappings feed the existing FlavorDB2 gap/quality rules and fingerprint pipeline.
Exact means ingredient identity, not validated sensory intensity. Curry leaf narrowly
clears the project's 30-molecule pair-scoring threshold; this threshold is a heuristic.
The new profiles record verified source IDs/counts under additive `evidence_sources`;
that field does not imply their axes were fitted to the source chemistry. Authorship
provenance states that the source cache was checked after the initial authored draft.

Recipe matching adds spearmint, curry leaf, asafoetida powder (approximate), ajwain,
annatto seeds, epazote and summer savory. CulinaryDB adds generic mint (approximate),
curry leaf, asafoetida, ajwain, epazote and summer savory. Its separate spearmint-oil
alias is not treated as a leaf ingredient.

## Coverage after rebuilding

| Layer | Coverage |
|---|---|
| Profiles, flavor vectors and PCA atlas | 86/86 |
| Recipe embeddings | 73/86; 2,628 unordered pairs |
| Dish affinities | 38 dishes × 73 embedded ingredients |
| Combined compound overlap | 72/86; 1,725 pairs |
| Aroma fingerprints | 58/86: 43 exact mappings, 15 approximate, 28 explicitly missing |
| Empirical CulinaryDB cuisine frequencies | 39/86 mappings; unchanged corpus of 45,772 recipes |

Among the additions, Black Cardamom, Annatto, Huacatay, Ají Amarillo, Ají Panca, Rocoto
and Juniper Berry still have no verified FlavorDB2 fingerprint mapping. Annatto has
recipe evidence, while the other six also lack recipe embeddings in the current cache.
No missing layer is populated with synthetic compounds, fabricated embeddings or
borrowed cultivar values. The pungency reference layer is regenerated for all 86;
unknown product-specific Scoville ranges remain null.

The updated [axis audit](../analysis/axis-fingerprint-audit.json) compares 58 covered
profiles. Pearson/Spearman values are warmth .1947/.2544, brightness .2910/.3738,
earthiness .0237/−.0699, florality .2257/.3831, heat .3513/.3721. These descriptive
correlations do not validate pungency or establish sensory intensity.

## Library findings

- **FlavorDB2: use now.** Six additional verified mappings were integrated through the
  existing source. The full [FlavorDB2/Kew evaluation](flavordb-kew-evaluation.md) contains
  entity links, molecule counts, examples and unresolved coverage. CC BY-NC-SA 3.0
  obligations continue to apply to relevant derived data.
- **Kew POWO/WCVP: useful next for botanical metadata.** Accepted names, synonyms and
  taxon identifiers help disambiguate ingredients. Keep botanical distribution separate
  from culinary origin and product form. Download/record-specific CC BY metadata must
  be followed; not all contributed text/images share one blanket license. No new Kew
  bulk import was added.
- **SpiceRx: research reference, not flavor scoring.** Its biomedical phytochemical and
  disease links lack aroma descriptors, concentration and sensory evidence. Live-site
  CC BY-NC-SA terms and paper/supplement terms are distinct. The [SpiceRx evaluation](spicerx-evaluation.md)
  records access methods and verified ingredient coverage. No SpiceRx dataset was imported.

## Reproduction and checks

Run `add_paprika_taxonomy.py` (the legacy filename now includes all curated additions),
then import `expansion_profiles_luna.json` with `generate_spice_profiles.py
--import-profiles ... --skip-existing`. Follow the order in [ingestion/README.md](../../ingestion/README.md).

Passed:

- Schema validation of all 86 profiles, unique slug check and original-73 preservation.
- Idempotent taxonomy generation and strict TypeScript resolver coverage: 86/86.
- Python derived pipeline: FlavorGraph, FlavorDB2, overlap, dishes, atlas, fingerprints,
  axis audit, pungency references and CulinaryDB frequencies.
- Three fingerprint/cuisine invariant tests and 86-vector extraction.
- `npx tsc --noEmit`.
- `npx next build`, including static prerender. The sandbox-only attempt could not fetch
  Google Fonts; the final network-enabled build passed.
- `git diff --check` on this task's owned paths.

No visual browser walkthrough was performed; validation covers data identity/schema,
pipeline arithmetic, TypeScript and production prerender. No UI code or package manifest
was edited by this task. Concurrent account/storage changes were left intact. All changes
remain uncommitted.

## Files changed by this expansion

- `ingestion/add_paprika_taxonomy.py`, `expansion_profiles_luna.json`,
  `generated_profiles.json`, `ingest_flavorgraph.py`, `ingest_flavordb2.py`,
  `ingest_culinarydb.py`, `README.md`.
- Rebuilt `ingestion/profile-coverage.json`, `flavorgraph_coverage.json`,
  `flavordb2_pairs.json`, `flavordb2_coverage.json`, `compound_overlap_coverage.json`.
- Generated `src/data/spice-taxonomy.json`, `pairing-scores.json`, `compound-overlap.json`,
  `dish-affinities.json`, `flavor-vectors.json`, `flavor-atlas.json`,
  `aroma-fingerprints.json`, `cuisine-frequencies.json`, `pungency-evidence.json`.
- `docs/research/spicerx-evaluation.md`, `flavordb-kew-evaluation.md`, this report;
  `docs/data-sources.md`, `docs/analysis/aroma-method.json`,
  `docs/analysis/axis-fingerprint-audit.json`, historical-report navigation note.
- Data/pipeline sections of root `README.md` and `PLAN.md`.
- Six downloaded entity JSONs in the existing ignored FlavorDB2 cache.

No UI field is required for the additions. Consumers can optionally use each new
profile's `evidence_sources` (source, entity ID, molecule count, mapping quality,
verification date and URL); existing fingerprint/cuisine fields retain their schemas.
