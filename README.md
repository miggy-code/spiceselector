# Spice Selector

[![CI](https://github.com/miggy-code/spiceselector/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/miggy-code/spiceselector/actions/workflows/ci.yml)

**A visual guide to how spices relate through flavor, chemistry, and cooking.**

Spice Selector turns flavor data into an interactive tool for exploring 73 spices. Move between a 3D flavor map and a 2D atlas, inspect evidence behind pairing suggestions, and compare possible substitutions. The app runs from committed data files; the frontend needs no API key, account, or backend.

## What you can explore

- **Flavor map:** Arrange spices across warmth, brightness, earthiness, florality, and heat. Select a spice to see its strongest recipe-affinity relationships.
- **Flavor atlas:** Explore neighborhoods across all five dimensions at once, or compare two dimensions directly. Switch between map and atlas with an animated transition.
- **Pairing evidence:** See suggestions ranked against selected spices, with per-pair recipe, chemistry, and curated evidence available in the explanation.
- **Substitutions:** Compare flavor-profile similarity, shared chemistry, taxonomy, and recipe affinity, with guidance for adjusting a replacement's intensity.
- **Blend and dish tools:** Build and share blends, save favorites, browse classic blends, find a bridge between two spices, or explore spices used with a dish.
- **Personalization:** Search the spice catalog, filter by cuisine or heat, and mark spices in your rack. Preferences stay in the browser.

## How recommendations work

Pairing and substitution are separate ranking problems. A spice can pair well with another while tasting very different from it, so the app uses different signals for each.

Pairing scores blend three signals: recipe affinity from [FlavorGraph](https://github.com/lamypark/FlavorGraph), compound overlap from FooDB, USDA Dr. Duke's, and FlavorDB2, and a curated pairing label. The nominal weights are 0.6, 0.2, and 0.2; when a signal is unavailable for a pair, the remaining weights are renormalized. The interface exposes the evidence that contributed to each suggestion.

Substitution scores combine five-axis profile similarity (0.4), compound overlap (0.25), taxonomy proximity (0.2), and recipe affinity (0.15), again renormalizing when data is missing. Taxonomy-only candidates are dampened so a shared family does not imply a perfect replacement.

These scores are decision aids, not taste measurements. Flavor profiles are generated and reviewed estimates; recipe co-occurrence does not establish that every cook will enjoy a pairing; and shared molecules alone do not prove that two ingredients taste good together. Coverage varies by spice and data source, and the app shows which evidence is available.

## Run locally

### Requirements

- Node.js 20.9 or newer
- npm

```bash
git clone https://github.com/miggy-code/spiceselector.git
cd spiceselector
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The committed JSON files power the frontend, so local development does not require API credentials.

Useful project checks:

```bash
npm run lint
npm run build
npm start
```

The data-generation workflow is documented separately in [`ingestion/README.md`](ingestion/README.md). Regenerating datasets may require third-party source files or API credentials; that pipeline is not needed to run the app.

## Implementation

- **Next.js 16, React 19, TypeScript:** application shell, routing, and interactive views
- **Three.js / React Three Fiber:** 3D map, camera controls, and map-to-atlas morph
- **D3:** 2D atlas and data visualizations
- **Framer Motion:** interface transitions and focused feedback
- **Python and TypeScript ingestion scripts:** source-data processing and committed static outputs
- **Browser storage:** saved blends, rack inventory, and user preferences without an account

The app is organized around small ranking and data modules in `src/lib/`, visual and interaction components in `src/components/`, and generated or curated datasets in `src/data/`. There is no server-side database or application API.

## Data and attribution

Spice Selector is an independent project inspired by the ingredient-and-molecule exploration in FlavorDB. It is not affiliated with or endorsed by the FlavorDB team.

- **FlavorDB / FlavorDB2:** Garg et al., [“FlavorDB: a database of flavor molecules”](https://doi.org/10.1093/nar/gkx957), *Nucleic Acids Research* (2018); [FlavorDB2](https://cosylab.iiitd.edu.in/flavordb2/). Relevant derived FlavorDB2 data is distributed under [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/).
- **FlavorGraph:** Recipe relationships and embeddings from [lamypark/FlavorGraph](https://github.com/lamypark/FlavorGraph), licensed under Apache-2.0.
- **FooDB:** Compound and flavor annotations from [foodb.ca](https://foodb.ca/), subject to FooDB's terms. FooDB data is provided for non-commercial use; commercial use requires permission from its authors.
- **USDA Dr. Duke's:** Phytochemical information from the [USDA Dr. Duke's Phytochemical and Ethnobotanical Databases](https://phytochem.nal.usda.gov/).
- **CulinaryDB:** Recipe and cuisine-frequency data attributed to CoSyLab, IIIT-Delhi, and Ganesh Bagler, distributed under CC BY-NC-SA 3.0.
- **Flavor profiles:** Five-axis profiles and some descriptive fields were generated with Google Gemini and reviewed or curated for this project. They are estimates, not laboratory measurements.

The source-specific restrictions also apply to relevant derived data in this repository. Review the linked terms before reusing the datasets, especially for commercial purposes. The application code is released under the [MIT License](LICENSE). The datasets keep their source licenses, which include non-commercial terms (CC BY-NC-SA 3.0 and FooDB terms); the MIT License does not apply to them.

## Repository map

```text
src/
  app/            Next.js route, layout, and global styles
  components/     Maps, search, filters, substitution and pairing tools
  context/        Selection, rack, and saved-blend state
  data/           Taxonomy, profiles, and generated evidence datasets
  lib/            Ranking, substitution, blend, and flavor utilities
ingestion/        Data ingestion and generation scripts
docs/             Data notes, analyses, and source documentation
```
