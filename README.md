# SpiceSelection

**Spice pairing, grounded in chemistry.**

SpiceSelection is an interactive web tool that helps chefs understand how spices work together. It maps the flavor space of 60+ spices using real chemical compound data, positions them visually by their aromatic profile, and surfaces pairing suggestions ranked by both culinary tradition and molecular affinity.

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

A score of `1.0` means two spices contain the exact same set of aromatic compounds. A score of `0.0` means they share none. In practice, most interesting pairings land between `0.1` and `0.4` — similar enough to be harmonious, different enough to add something new.

### The Five-Axis Flavor Model

Raw compound data isn't intuitive — "high cineol content" doesn't tell a chef much. So each spice is scored on five perceptual axes, calibrated to the full 0–100 range:

| Axis | What it measures | High end examples |
|------|-----------------|-------------------|
| **Warmth** | Cozy, baking-spice character | Cinnamon, nutmeg, allspice |
| **Brightness** | Fresh, citrusy, top-note energy | Lemon zest, lemongrass, sumac |
| **Earthiness** | Grounded, heavy, root-forward | Cumin, turmeric, smoked paprika |
| **Florality** | Delicate, perfumy, floral notes | Saffron, rose, lavender |
| **Heat** | Pungency / capsaicin-level fire | Cayenne, black pepper, mustard |

These axes double as map coordinates: the 2D flavor map plots spices by warmth (x) and brightness (y) by default, with axis-switching for any combination. Proximity on the map = aromatic similarity. Node size = potency. Glow = how widely the spice is used globally.

### Pairing Scores

Pairing suggestions are ranked by three signals:

1. **Compound overlap** — Jaccard index from USDA phytochemical data
2. **Flavor-map proximity** — Euclidean distance in 5D flavor space
3. **Culinary affinity** — `classic` / `complementary` / `surprising`, derived from LLM-generated profiles grounded in culinary tradition

This means a suggestion like cumin + turmeric scores high on all three: shared earthy/warm compounds, neighboring map positions, and a long history in South Asian cooking. A "surprising" pairing like cardamom + black pepper scores lower on compound overlap but high on culinary validation — they meet in garam masala, and it works.

---

## Features

### Flavor Wheel
Circular visualization of the spice library, organized by flavor family.

### 2D Flavor Map
D3-powered scatter plot with configurable axes. position = flavor profile, size = potency, color = family, glow = commonality. Toggle axes to explore warmth vs. earthiness, or florality vs. heat.

### Pairing Sidebar
Select one or more spices. The sidebar surfaces compatible partners ranked by how many of your selected spices they pair well with, filtered by affinity type. AI can also suggest pairings based on the spices you picked. 

### Substitution Finder
The substitution view ranks alternatives by flavor similarity score and explains how each one differs.

### Detail Cards
Full spice profiles: origin, description, key aromatic compounds, top pairings, cuisine associations, and substitutes.

---

## Data Pipeline

The data behind SpiceSelection is assembled in four steps:

```
USDA Phytochemical DB  →  LLM Profile Generation  →  Supabase  →  Jaccard Scoring
     (chemistry)              (flavor scoring)        (serving)     (pairing weights)
```

### Step 1 — USDA Compound Scrape

```bash
cd ingestion
python3 usda_scraper.py
```

Scrapes the USDA Dr. Duke's Phytochemical and Ethnobotanical Databases for aromatic compound data across 55+ spices. Outputs raw chemical data to `idea/spice_data_raw.json`. Idempotent — won't re-fetch spices already on disk.

### Step 2 — LLM Profile Generation

```bash
GOOGLE_API_KEY=... python3 generate_spice_profiles.py --all
```

Takes the USDA compound data as context and calls **Gemini 2.5 Flash** with a Pydantic-enforced structured output schema to generate:

- Five-axis flavor scores (0–100 each)
- Cuisine associations with frequency and typical quantities
- Top pairings with affinity labels and explanatory notes
- Substitutes with similarity scores
- Key aromatic compounds with their flavor contributions

```bash
# Check generation status across all spices
python3 generate_spice_profiles.py --list

# Generate a single profile for testing
python3 generate_spice_profiles.py --spice "Cumin"
```

Outputs to `ingestion/generated_profiles.json`.

### Step 3 — Load to Supabase

Set up the schema in your Supabase project (SQL Editor → paste `ingestion/supabase_schema.sql`), then:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 load_to_supabase.py
```

Populates: `spices`, `compounds`, `spice_compounds`, `pairings`, `spice_cuisines`, `substitutions`. All upserts — safe to re-run.

### Step 4 — Compute Compound Overlap

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 compute_compound_overlap.py
```

Reads USDA compound data, computes Jaccard similarity for every pairing in the database, and writes `compound_overlap` scores back to the `pairings` table. This is what drives the chemistry-based ranking.

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- Python 3.10+ (for the data pipeline)
- A Google AI API key (for profile generation)

### Frontend

```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

The app reads from `ingestion/generated_profiles.json` as a local fallback if Supabase is not configured. You can run the ingestion pipeline first, or use pre-existing profiles if they're already generated.

### Data Pipeline

```bash
cd ingestion
pip install -r requirements.txt

# Run all four steps in order
python3 usda_scraper.py
GOOGLE_API_KEY=... python3 generate_spice_profiles.py --all
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 load_to_supabase.py
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 compute_compound_overlap.py
```

---

## Project Structure

```
spiceselection/
├── src/
│   ├── app/               # Next.js App Router pages
│   ├── components/
│   │   ├── flavor-wheel/  # Radial spice wheel visualization
│   │   ├── pairing/       # Sidebar, detail cards, AI toggle
│   │   ├── FlavorMap2D    # D3 scatter plot
│   │   └── FlavorMap3D    # Three.js 3D flavor space
│   ├── context/           # Selection state (React Context)
│   ├── data/              # Static spice taxonomy + pairings JSON
│   ├── hooks/             # Shared React hooks
│   ├── lib/               # Color palettes, utilities
│   └── types/             # TypeScript interfaces
├── ingestion/
│   ├── usda_scraper.py              # Step 1: USDA compound data
│   ├── generate_spice_profiles.py   # Step 2: LLM flavor profiles
│   ├── load_to_supabase.py          # Step 3: Database load
│   ├── compute_compound_overlap.py  # Step 4: Jaccard scoring
│   ├── generated_profiles.json      # Output of Step 2
│   ├── supabase_schema.sql          # Database schema
│   ├── SCHEMA.md                    # Schema documentation
│   └── README.md                    # Pipeline documentation
└── idea/
    ├── spec.md             # Full product specification
    └── spice_data_raw.json # USDA compound data (generated)
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
