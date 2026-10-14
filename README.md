# SpiceSelection

**Spice pairing, grounded in chemistry.**

SpiceSelection is an interactive web tool that helps chefs understand how spices work together. It maps 57 spices by flavor profile, scores every pair in a 72-spice taxonomy using recipe co-occurrence embeddings and shared aroma chemistry, and surfaces pairing suggestions that show their work: every score comes with a "why".

Think of it as a GPS for your spice rack.

---

## The Theory

### Food Pairing Hypothesis

The foundation is the **food pairing hypothesis**, formalized in Ahn et al.'s 2011 paper *"Flavor network and the principles of food pairing"* (Scientific Reports). The core claim: ingredients that share a larger number of volatile aromatic compounds tend to taste good together.

This isn't just hand-waving. The original study analyzed 56,000+ recipes from cookbooks across cuisines and showed a statistically significant correlation between compound overlap and co-occurrence in real dishes — at least in Western cuisines. (East Asian cuisines, interestingly, tend to work the other way: pairing ingredients that *don't* share compounds. Contrast over harmony. Both approaches produce excellent food.)

SpiceSelection operationalizes this with the **Jaccard index** — a standard set-similarity measure:

```
compound_overlap(A, B) = |compounds(A) ∩ compounds(B)| / |compounds(A) ∪ compounds(B)|
```

A score of `1.0` means two spices contain the exact same set of compounds (from FooDB and the USDA phytochemical data). A score of `0.0` means they share none. In practice, most interesting pairings land between `0.1` and `0.4` — similar enough to be harmonious, different enough to add something new.

### The Five-Axis Flavor Model

Raw compound data isn't intuitive — "high cineol content" doesn't tell a chef much. So each spice is scored on five perceptual axes, calibrated to the full 0–100 range:

| Axis | What it measures | High end examples |
|------|-----------------|-------------------|
| **Warmth** | Cozy, baking-spice character | Cinnamon, nutmeg, allspice |
| **Brightness** | Fresh, citrusy, top-note energy | Lemon zest, lemongrass, sumac |
| **Earthiness** | Grounded, heavy, root-forward | Cumin, turmeric, smoked paprika |
| **Florality** | Delicate, perfumy, floral notes | Saffron, rose, lavender |
| **Heat** | Pungency / capsaicin-level fire | Cayenne, black pepper, mustard |

These axes double as map coordinates: the 2D flavor map plots spices by warmth (x) and brightness (y) by default, with axis-switching for any combination. Proximity on the map = flavor-profile similarity. Node size = intensity. Brightness = how widely the spice is used globally.

### Pairing Scores

Every pairing score is a blend of three visible signals, and the "why?" popover shows each one:

1. **Recipe affinity** — cosine similarity between the two spices' [FlavorGraph](https://github.com/lamypark/FlavorGraph) embeddings (Park et al. 2021), learned from ~1M recipes plus compound data. Covers 65 of the 72 taxonomy spices (2,080 pairs).
2. **Compound overlap** — two chemistry sources, merged into one 0–1 `compoundScore` per pair:
   - **FooDB + USDA Dr. Duke's Phytochemical DB** — the Jaccard index over each spice's compound set, keyed by normalized chemical name. Shared compounds that carry FooDB flavor annotations are the *aroma* compounds listed as evidence ("cumin & coriander share 18 aroma compounds"). Covers 55 spices (914 pairs).
   - **FlavorDB2** — an IDF-weighted cosine over each spice's flavor-molecule set (raw Jaccard is useless here: ~90 molecules appear in nearly every ingredient). An entry is usable when its entity has ≥30 molecules, and a *pair* gets a FlavorDB2 score when both spices are usable, map to different entities, and either both are *exact* matches or the pair has no FooDB/USDA signal. *Approximate* stand-ins (e.g. lemon peel oil for Lemon Zest, mustard for Mustard Seed) therefore fill gaps pair by pair but never add a second opinion where FooDB/USDA already has evidence (Cumin × Coriander Seed stays FooDB-only; Horseradish × Mustard Seed is scored by FlavorDB2). Its shared flavor notes ("pungent, mustard, horseradish…") show in the "why?" popover. It adds Horseradish, Wasabi, Parsley, Chive, Lemon/Orange/Lime Zest, Dried Lime, Black Garlic and Dried Mushroom.

   Jaccard and IDF-cosine live on different scales, so each is converted to a **percentile rank within its own distribution of pair values**, and `compoundScore` is the mean of the ranks available for the pair. Compound data now covers 65 of 72 spices.
3. **Curated label** — `classic` / `complementary` / `surprising` from the LLM-generated, hand-curated pairing data, used as a prior: 0.75 / 0.60 / 0.50.

```
score = Σ (weight × signal) / Σ weight      over the signals that exist for the pair

weights:  recipe affinity 0.6 · compound overlap 0.2 · curated label 0.2
```

Weights redistribute over whatever evidence exists. A spice FlavorGraph can't embed (Sichuan pepper, tonka bean, hibiscus…) still gets a meaningful score from compound overlap plus its label, and a pair with no curated label (bridge candidates, surprise pairings) is scored on data alone. Together the data layers cover 71 of 72 spices; only Mahlab falls back to its curated label.

Pairing suggestions rank first by how many of your selected spices they pair with, then by the blended score.

**Substitutions use a different blend**, because "pairs well" is not "tastes similar" (nutmeg × cilantro is a 0.93 recipe affinity — a great pairing and a terrible substitute). The substitution engine weighs five-axis flavor-profile similarity (0.4), compound-overlap chemistry (0.25), taxonomy proximity (0.2) and recipe affinity (0.15), again redistributing when a signal is missing, and dampens taxonomy-only matches ×0.75 so a data-free sibling doesn't read as a perfect swap.

---

## Features

- **3D Flavor Map** — Three.js / react-three-fiber scene with three selectable flavor axes. Selecting a spice draws glowing affinity edges to its strongest FlavorGraph partners.
- **2D Flavor Map** — D3 scatter plot with switchable axes: position = flavor profile, size = intensity, color = family, opacity = commonality. Selected spices connect to their top-6 partners (affinity ≥ 0.5) with edges whose width and brightness scale with the score.
- **Pairing panel** — overlays both maps. Ranked suggestions with score bars, a **"why?" popover** per suggestion (recipe affinity per selected spice, shared aroma compounds with flavor tags, FlavorDB2 shared flavor notes, curated label and note), and one-click add to the map.
- **Bridge finder** — when two selected spices clash (direct score < 0.55), suggests the spice that best connects them, ranked by the weaker of its two legs, with per-leg scores and the gain over the direct pairing.
- **Surprise me** — high recipe affinity × novelty (different family, little shared chemistry, uncurated) for genuinely non-obvious pairings, with a "try it on the map" button.
- **Blend builder** — radar chart of the blend's five-axis profile, a cohesion score (harmonious / balanced / adventurous), gap-filling suggestions for the weakest core axis, and suggested ratios (e.g. 3 Nutmeg : 2 Cardamom : 1 Clove). Save blends locally and share them as URLs (`/?b=nutmeg~cardamom~cloves&n=Name`).
- **Classic blend hints** — recognizes when your selection is heading toward one of 12 classic blends (garam masala, baharat, ras el hanout…) and shows what's still missing; starter blends in the empty state.
- **Dish anchoring** — "Cooking something?" picks a base ingredient (salmon, lamb, apples, chocolate… 38 in all) and ranks spices by FlavorGraph affinity to it.
- **My Rack** — mark the spices you own; an "only show my rack" switch filters suggestions and substitutes to what's in the house. Stored in `localStorage`, no account needed.
- **Cuisine lens** — filter the maps to the spices of one cuisine, alongside a heat-level filter.
- **Substitution Finder** — data-driven substitutes with a blended score, best-match badge, "use more / less" intensity guidance, curated notes, and an expandable evidence panel.
- **⌘K search** — command palette (⌘K / Ctrl+K / `/`) with keyboard navigation and multi-add.
- **Mobile layout** — the pairing panel becomes a bottom sheet and the Substitution Finder stacks.

---

## Data Pipeline

The app ships with every data file it needs, so **you don't have to run the pipeline to use it**. These scripts in `ingestion/` regenerate the data; run them from that directory, in this order (full details in [`ingestion/README.md`](ingestion/README.md)):

| # | Script | Inputs | Outputs |
|---|--------|--------|---------|
| 1 | `usda_scraper.py` | USDA Dr. Duke's Phytochemical DB (web) | `idea/spice_data_raw.json` |
| 2 | `ingest_foodb.py` | FooDB CSV dump at `foodb_2020_04_07_csv/` (project root) | `idea/foodb_spice_data.json` |
| 3 | `generate_spice_profiles.py` | USDA compounds + Gemini 2.5 Flash (`GOOGLE_API_KEY`) | `ingestion/generated_profiles.json` |
| 4 | `ingest_flavorgraph.py` | FlavorGraph nodes + embeddings (downloaded, cached in `ingestion/flavorgraph_data/`) | `src/data/pairing-scores.json` |
| 5 | `ingest_flavordb2.py` | FlavorDB2 entity JSON (cached in `ingestion/flavordb2_cache/`, fetched on miss) | `ingestion/flavordb2_pairs.json` |
| 6 | `ingest_compound_overlap.py` | FooDB + USDA compound JSON + step 5 | `src/data/compound-overlap.json` |
| 7 | `ingest_dish_affinities.py` | FlavorGraph embeddings + step 4's spice matching | `src/data/dish-affinities.json` |
| 8 | `extract_flavor_vectors.ts` | `generated_profiles.json` | `src/data/flavor-vectors.json` |

```bash
cd ingestion
pip install -r requirements.txt

python3 usda_scraper.py
python3 ingest_foodb.py                    # needs ../foodb_2020_04_07_csv (from foodb.ca)
GOOGLE_API_KEY=... python3 generate_spice_profiles.py --all --skip-existing
python3 ingest_flavorgraph.py
python3 ingest_flavordb2.py                # run before ingest_compound_overlap.py
python3 ingest_compound_overlap.py
python3 ingest_dish_affinities.py
cd .. && npx tsx --tsconfig tsconfig.json ingestion/extract_flavor_vectors.ts
```

**Committed outputs** (the app runs from these): `ingestion/generated_profiles.json`, everything in `src/data/`, the intermediate compound files in `idea/`, and the cached FlavorGraph files in `ingestion/flavorgraph_data/`, and the derived FlavorDB2 outputs `ingestion/flavordb2_pairs.json` / `flavordb2_coverage.json`. The raw FlavorDB2 entity cache (`ingestion/flavordb2_cache/`) is git-ignored and re-fetched on demand. `src/data/spice-taxonomy.json`, `spice-pairings.json` and `classic-blends.json` are curated directly and have no generator script. The FooDB CSV dump is not committed.

Two older scripts remain for reference: `generate_coords.py` (UMAP 3D coordinates — the 3D map now uses flavor axes instead) and `compute_compound_overlap.py` (Supabase-era; superseded by `ingest_compound_overlap.py`).

---

## Getting Started

### Prerequisites

- Node.js 20.9+
- Python 3.10+ (only for the data pipeline)
- A Google AI API key (only to regenerate spice profiles)

### Frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are needed — the app reads `ingestion/generated_profiles.json` and the JSON in `src/data/` at build time.

### Data Pipeline

See [Data Pipeline](#data-pipeline) above.

---

## Project Structure

```
spiceselection/
├── src/
│   ├── app/                     # Next.js App Router: page.tsx loads the profiles, layout + providers
│   ├── components/
│   │   ├── MapClientLoader.tsx  # View switching, filters, shared-blend URLs
│   │   ├── FlavorMap3D.tsx      # Three.js 3D flavor space + affinity edges
│   │   ├── FlavorMap2D.tsx      # D3 scatter plot + affinity edges
│   │   ├── SubstitutionView.tsx # Data-driven Substitution Finder
│   │   ├── NavDrawer.tsx        # Views, heat filter, cuisine lens, My Rack
│   │   ├── SpiceSearch.tsx      # ⌘K command palette
│   │   └── pairing/             # Pairing panel, "why?" popover, bridge, surprise,
│   │                            #   blend builder, dish picker, classic blends, saved blends
│   ├── context/                 # Selection, My Rack, saved blends (React Context)
│   ├── data/                    # Taxonomy, curated pairings, classic blends + generated score JSON
│   ├── lib/                     # Pairing/substitution/bridge/surprise/blend engines, id mapping
│   └── types/                   # TypeScript interfaces
├── ingestion/
│   ├── usda_scraper.py              # 1. USDA compound scrape
│   ├── ingest_foodb.py              # 2. FooDB compound extraction
│   ├── generate_spice_profiles.py   # 3. Gemini flavor profiles
│   ├── ingest_flavorgraph.py        # 4. FlavorGraph recipe affinity
│   ├── ingest_flavordb2.py          # 5. FlavorDB2 molecule overlap
│   ├── ingest_compound_overlap.py   # 6. FooDB + USDA + FlavorDB2 compound overlap
│   ├── ingest_dish_affinities.py    # 7. Spice × base-ingredient affinity
│   ├── extract_flavor_vectors.ts    # 8. Five-axis vectors for the engines
│   ├── generated_profiles.json      # Output of step 3 (read by the app)
│   ├── flavorgraph_data/            # Cached FlavorGraph nodes + embeddings
│   ├── flavordb2_cache/             # Raw FlavorDB2 entity JSON (git-ignored)
│   ├── flavordb2_pairs.json         # Output of step 5 (merged by step 6)
│   ├── *_coverage.json              # Coverage reports from steps 4–6
│   ├── generate_coords.py           # Legacy: UMAP coordinates
│   ├── compute_compound_overlap.py  # Legacy: Supabase-era scorer
│   ├── test_generation.py           # Legacy: single-spice smoke test
│   └── README.md                    # Pipeline documentation
├── idea/
│   ├── spec.md                  # Original product specification
│   ├── spice_data_raw.json      # USDA compound data (step 1)
│   └── foodb_spice_data.json    # FooDB compound data (step 2)
├── public/data/                 # Legacy UMAP coordinates (not read by the app)
└── PLAN.md                      # Build log for the evidence-backed pairing work
```

---

## Flavor Families

Eight canonical families, each with its own color in the visualizations:

| Family | Color | Examples |
|--------|-------|---------|
| Warm | Amber | Cinnamon, nutmeg, allspice, cloves |
| Hot-Pungent | Red | Black pepper, cayenne, gochugaru |
| Sweet | Pink | Vanilla, fennel seed, anise, fenugreek |
| Earthy | Brown | Cumin, turmeric, smoked paprika, caraway |
| Herbal | Green | Oregano, thyme, rosemary, lemongrass |
| Floral | Purple | Saffron, lavender, rose, chamomile |
| Citrus-Bright | Yellow | Sumac, amchur, tamarind |
| Umami-Savory | Teal | Garlic powder, sesame, nigella seed |

---

## Data Sources & Licenses

Current data audit and source evaluation: [docs/data-sources.md](docs/data-sources.md).
The expanded taxonomy distinguishes sweet paprika from smoked paprika (73 leaves).
Families are normalized at profile source to `warm`, `hot-pungent`, `sweet`, `earthy`,
`herbal`, `floral`, `citrus-bright`, `umami-savory`. These are taxonomy assignments;
legacy Sumac remains in `earthy` despite the illustrative family table above.

New additive outputs: `aroma-fingerprints.json` (12-family IDF-weighted molecular
presence/descriptor vectors; missing evidence is null), `cuisine-frequencies.json`
(empirical CulinaryDB recipe proportions, denominators and mapping quality), and
`pungency-evidence.json` (cited ranges/mechanisms, distinct from LLM heat coordinates).
Fingerprint vectors are derived evidence, **not measured perceptual intensity**.
All five original axes remain estimates; see the reproducible
[axis audit](docs/analysis/axis-fingerprint-audit.json) and
[pipeline order](ingestion/README.md#complete-profiles-fingerprints-and-empirical-cuisine-data-2026-10-13).
CulinaryDB is the sole new bulk dataset integrated, attributed to CoSyLab / IIIT-Delhi /
Ganesh Bagler and distributed as CC BY-NC-SA 3.0. Aroma fingerprint derivatives follow
FlavorDB2's CC BY-NC-SA 3.0 and FooDB's noncommercial terms. Additional fields are
additive; the UI can adopt them without changing existing JSON consumers.


- **FlavorGraph** — Park et al. (2021), *FlavorGraph: a large-scale food-chemical graph for generating food representations and recommending food pairings*, Scientific Reports. Embeddings and node list from [github.com/lamypark/FlavorGraph](https://github.com/lamypark/FlavorGraph), licensed **Apache-2.0**.
- **FooDB** — compound content and compound → flavor annotations from [foodb.ca](https://foodb.ca), used under FooDB's terms. FooDB data is provided for non-commercial use; commercial use requires permission from the FooDB authors.
- **FlavorDB2** — Garg et al., *FlavorDB: a database of flavor molecules*, Nucleic Acids Research 2018 ([doi:10.1093/nar/gkx957](https://doi.org/10.1093/nar/gkx957)); update described in [arXiv:2205.05451](https://arxiv.org/abs/2205.05451); data from [cosylab.iiitd.edu.in/flavordb2](https://cosylab.iiitd.edu.in/flavordb2/), licensed **CC BY-NC-SA 3.0**. The raw entity JSON is not committed; the derived `src/data/compound-overlap.json` (which embeds FlavorDB2-derived scores and flavor words) is therefore distributed under **CC BY-NC-SA 3.0** — non-commercial use only, which also matches FooDB's terms.
- **USDA Dr. Duke's Phytochemical and Ethnobotanical Databases** — U.S. Department of Agriculture, Agricultural Research Service, [phytochem.nal.usda.gov](https://phytochem.nal.usda.gov).
- **Spice profiles** — five-axis scores, cuisines, pairing labels and substitutes were generated with Google Gemini (grounded in the USDA compound data) and curated by hand. Treat them as LLM-generated, reviewed data rather than measurements.

Ahn et al. (2011) is cited above as the theoretical basis for the food-pairing hypothesis; no Ahn et al. dataset is used.

## Roadmap

- Further FlavorDB2 coverage: map the remaining unmapped spices if/when better entities appear (Mace, White Pepper, Caraway, Galangal, Rose Water and others are currently too thin; chilies only have a generic Capsicum entry).
