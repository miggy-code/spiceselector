# SpiceSelection

**Explore how spices relate through flavor, chemistry, and cooking traditions.**

SpiceSelection is an interactive spice explorer built for curious cooks. Move between a 3D flavor map and a 2D atlas, compare flavor dimensions, build blends, and inspect why a pairing or substitution is suggested.

The project was inspired by [FlavorDB](https://cosylab.iiitd.edu.in/flavordb/), which connects ingredients with the molecules and descriptors behind flavor. SpiceSelection brings that spirit of exploration to a focused, visual tool for spices, combining molecular data with recipe relationships and curated culinary context.

## Explore

- **Map and Atlas:** Explore spices in a 3D flavor space or a 2D atlas. In the map, choose which flavor dimensions define the axes. In the atlas, explore neighborhoods or compare two dimensions directly.
- **Pairing suggestions:** See ranked suggestions with evidence from recipe affinity, shared aroma chemistry, and curated pairing notes. Select a suggestion to add it to the map.
- **Substitution finder:** Find possible replacements for a selected spice, compare the evidence behind each match, and get guidance on adjusting for intensity.
- **Blend builder:** Combine spices, inspect the blend’s flavor profile and cohesion, and get suggestions for gaps in the blend.
- **Cooking ideas:** Explore classic blend references, bridge suggestions for a weak pairing, surprise pairings, and spice matches for a dish.
- **Personal tools:** Search with the keyboard, save and share blends, mark spices on your rack, and filter by cuisine or heat.
- **Responsive layout:** Use the explorer on desktop or mobile, where the pairing panel becomes a bottom sheet.

## How recommendations work

Pairing and substitution scores answer different questions. A strong pairing can have contrasting flavors; a useful substitute should usually taste more similar. SpiceSelection uses separate ranking logic for each.

Pairing suggestions combine available evidence from:

1. **Recipe affinity** from [FlavorGraph](https://github.com/lamypark/FlavorGraph).
2. **Compound overlap** from FooDB, USDA Dr. Duke’s, and FlavorDB2.
3. **Curated pairing labels** that add culinary context.

Substitutions use flavor-profile similarity, compound overlap, taxonomy proximity, and recipe affinity. Missing evidence is handled per pair, so a candidate is not presented as a perfect match just because other sources have no data.

The five flavor dimensions—warmth, brightness, earthiness, florality, and heat—make the map easier to read. Profile scores are generated and curated estimates, not laboratory measurements or universal descriptions of taste.

## Run locally

### Requirements

- Node.js 20.9 or newer
- npm

The app uses committed data files and does not need API keys for local development.

```bash
git clone https://github.com/miggy-code/spiceselector.git
cd spiceselector
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To create a production build:

```bash
npm run build
npm start
```

## Technology

- **Next.js 16, React 19, TypeScript** for the application and UI
- **Three.js and React Three Fiber** for the interactive 3D flavor map
- **D3** for the 2D atlas and charts
- **Framer Motion** for interface transitions
- **Static JSON data** for fast, self-contained local use; no backend or account required

## Data and attribution

FlavorDB inspired the project’s ingredient-and-molecule exploration. FlavorDB and FlavorDB2 are research resources developed by CoSyLab. This project is an independent application and is not affiliated with or endorsed by the FlavorDB team.

- **FlavorDB:** Garg et al., [“FlavorDB: a database of flavor molecules”](https://doi.org/10.1093/nar/gkx957), *Nucleic Acids Research* (2018). [Database](https://cosylab.iiitd.edu.in/flavordb/).
- **FlavorDB2:** Used as a source for flavor-molecule evidence. See the [FlavorDB2 database](https://cosylab.iiitd.edu.in/flavordb2/) and [updated database paper](https://doi.org/10.1111/1750-3841.17298).
- **FlavorGraph:** Recipe relationships and embeddings from [lamypark/FlavorGraph](https://github.com/lamypark/FlavorGraph), licensed under Apache-2.0.
- **FooDB:** Compound and flavor annotations from [FooDB](https://foodb.ca/), subject to its terms; commercial use requires permission from the FooDB authors.
- **USDA Dr. Duke’s:** Phytochemical information from the [USDA Dr. Duke’s Phytochemical and Ethnobotanical Databases](https://phytochem.nal.usda.gov/).
- **CulinaryDB:** Recipe and cuisine frequency data attributed to CoSyLab / IIIT-Delhi / Ganesh Bagler and distributed under CC BY-NC-SA 3.0.
- **Flavor profiles:** Five-axis profiles and some descriptive fields were generated with Google Gemini and reviewed or curated for this project. They should be treated as estimates.

FlavorDB2-derived data is distributed under **CC BY-NC-SA 3.0**. FooDB data is provided for non-commercial use. These restrictions apply to relevant derived data in this repository; review the source terms before reusing data, especially for commercial purposes. The repository does not currently include a general software license.

## Data pipeline

The committed outputs power the app. To regenerate or extend the datasets, use the scripts and instructions in [`ingestion/README.md`](ingestion/README.md). Some pipeline steps require external datasets or API credentials; they are not needed to run the frontend.

## Project layout

```text
src/
  app/            Next.js route, layout, and global styles
  components/     Maps, search, filters, substitution finder, pairing tools
  context/        Selection, rack, and saved-blend state
  data/           Taxonomy, profiles, and generated evidence datasets
  lib/            Pairing, substitution, blend, and flavor utilities
ingestion/        Data ingestion and generation scripts
docs/             Data notes, analyses, and project documentation
```
