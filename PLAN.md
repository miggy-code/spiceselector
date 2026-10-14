# SpiceSelection — Evidence-Backed Pairing Plan

Turn SpiceSelection's pairings from opinion into defensible, explainable science using two
open-source datasets. This is the thing Epicure (epicure.kaikaku.ai) deliberately hides —
they say "science-backed" but never show the science. Our differentiation is **transparency**:
every pairing score comes with a visible "why".

## Data sources

- **FlavorGraph** (Park et al. 2021, *Scientific Reports*) — Apache 2.0.
  Graph embedding model trained on ~1M recipes + chemical compound data. 300-dim ingredient
  embeddings. Cosine similarity between two spices = a **learned pairing affinity** (0–1).
  Repo: github.com/lamypark/FlavorGraph
- **FooDB** (foodb.ca; `ingestion/ingest_foodb.py` over the FooDB CSV dump) — compound content
  plus compound→flavor annotations. Shared aroma-compound count between two spices =
  the **explanation** ("cumin & coriander share 18 aroma compounds"). Non-commercial terms.
- **USDA Dr. Duke's Phytochemical DB scrape** (`ingestion/usda_scraper.py`) — corroborates/extends
  compound data.
- **FlavorDB2** (Garg et al. 2018, *Nucleic Acids Research*; cosylab.iiitd.edu.in/flavordb2) —
  second chemistry source (flavor molecules per ingredient entity); CC BY-NC-SA 3.0. See the
  FlavorDB2 status entry below.

*Correction (cleanup pass):* the original plan named Ahn et al. 2011 as the compound source, but
no Ahn et al. dataset was ever ingested — the compound layer is FooDB + USDA. Ahn et al. remains
the theoretical basis (food-pairing hypothesis) only.

Attribution obligation: keep the Apache license notice; credit
"FlavorGraph (Park et al. 2021), FooDB, USDA Dr. Duke's Phytochemical DB" in the UI.
This credit *reinforces* the transparency positioning rather than being mere compliance.

## Scoring model

A pairing's `pairingScore` blends three visible ingredients:
1. **Recipe affinity** — FlavorGraph cosine similarity (learned from real recipes).
2. **Compound overlap** — count/list of shared flavor compounds (FooDB + USDA). Also the "why".
3. **Curated label** — the existing classic/complementary/surprising hint from LLM seed data.

Every score in the UI gets a "why?" popover showing this breakdown.

---

## Status

- [x] **Step 1 — Ingestion → static scores.** `ingestion/ingest_flavorgraph.py` downloads
      FlavorGraph nodes + embeddings, maps project spices to nodes, computes cosine affinity for
      all pairs, writes `src/data/pairing-scores.json` (1,653 pairs) + `ingestion/flavorgraph_coverage.json`.
- [x] **Step 2 — Engine merge.** `pairing-engine.ts` loads `pairing-scores.json` into an
      unordered-pair lookup; `RankedPairing` gained `affinityScore`, `affinityDetails`, and
      `blendedScore` (0.7 × FlavorGraph affinity + 0.3 × label prior; label-only fallback for
      unscored pairs). Suggestions rank by matchCount, then blended score.
- [x] **Step 3 — UI scores + "why".** `PairingSuggestions` shows a neon score bar per suggestion
      and a "why?" popover (`WhyPopover.tsx`) with per-selected-spice FlavorGraph affinity,
      curated label/note, and the FlavorGraph attribution. `SpiceDetailCard` chips sort by and
      display affinity. AI-mode suggestions get affinity lookups too. Shared-compound section of
      the popover pending Step 4.
- [x] **Step 4 — Compound-overlap layer + coverage backfill.** New
      `ingestion/ingest_compound_overlap.py` merges FooDB (`idea/foodb_spice_data.json`,
      flavor-annotated) and USDA (`idea/spice_data_raw.json`) compound data, keyed by
      *normalized chemical name* (their raw id spaces differ). Emits
      `src/data/compound-overlap.json` (914 pairs: sharedCount, sharedAromaCount, jaccard,
      top-8 aroma compounds w/ flavor tags). Engine now blends three signals
      (0.6 affinity / 0.2 compound / 0.2 label, weights redistribute when a layer is
      absent) so the ~10 FlavorGraph-less spices still score. Coverage: 55/72 have compound
      data; combined FlavorGraph∪compound = 68/72 (only Dried Lime, Dried Mushroom, Kaffir
      Lime Leaf, Mahlab uncovered). "Why" popover gained a shared-aroma-compound section +
      data-source attribution (originally mis-credited to Ahn et al. 2011 — corrected in the
      cleanup pass); suggestion rows and detail chips show the aroma count.
- [x] **Step 5 — Affinity edges on the Flavor Map.** `FlavorMap2D.tsx` now draws glowing
      cyan edges from each selected spice to its top-6 FlavorGraph partners (score ≥ 0.5),
      width + stroke-opacity scaled by score, under a blur glow filter with a gentle pulse
      (respects `prefers-reduced-motion`). Connected partners are un-dimmed and ringed cyan;
      a toggle + legend explain the encoding. New `src/lib/spice-id-map.ts` bridges the map's
      profile slug ids ("cinnamon") to taxonomy dot-ids ("warm.baking.cinnamon") so the
      pairing engine's scores apply on the map (53/57 auto-match + 3 aliases).

- [x] **Mount gap (discovered during Step 5) — resolved.** The pairing UI is now live via
      `pairing/MapPairingPanel.tsx`, mounted in `MapClientLoader` as a collapsible overlay on
      both map views (hidden on the substitutions view). It bridges map slugs → taxonomy ids
      with `spice-id-map.ts`, shows score bars + "why" popovers, and clicking a suggestion
      adds it to the map selection. The original `SpiceSelectionApp` → `PairingSidebar` route
      remains unmounted (superseded by the panel).
- [x] **View unification polish.** `FlavorMap3D` gained matching drei `<Line>` affinity edges
      (same top-6 / score-scaled encoding as the 2D map) via `AffinityEdges3D`; its axis
      controls moved top-left (next to the nav hamburger) and the controls hint to bottom-center
      so the right-side panel doesn't cover them. Enabled class-based dark mode in `globals.css`
      (`@custom-variant dark`) and wrapped the panel in `.dark` so the reused `WhyPopover` /
      `ScoreBar` (which use `dark:` variants) render correctly over the always-dark map.
      Verified on the scatter view with Playwright: 3 selected → 14 scored suggestions, 18
      glowing edges, add/why controls functional (3D edges share the data path but can't be
      screenshotted headless — no WebGL/GPU).

- [x] *(Incidental)* Renamed `src/middleware.ts` → `src/proxy.ts` (`middleware()` → `proxy()`)
      per Next.js 16 deprecation of the middleware file convention.
- [x] **Step 1b — Name-variant retry (done after Steps 2–5).** Root cause of the 12
      matched-but-unscored spices: embedding keys are plural/recipe-style (`nigella_seeds`)
      while the node CSV is singular. Matcher now only accepts a node that *has* an embedding
      vector, uses a hand-verified `NAME_OVERRIDES` table + auto plural/seed variants, and drops
      the blind substring fallback that silently produced wrong-ingredient scores
      (Tamarind→`tamari` soy sauce, Tonka Bean→`bean`, Sichuan/Long Pepper→generic `pepper`).
      Result: **65/72 with real vectors, 2,080 pairs** (was 58 incl. ~5 bogus / 1,653).
      Approximate stand-ins flagged `approximate: true` in the coverage report: Gochugaru→
      red_pepper_powder, Fenugreek→fenugreek_leaves, Elderflower→elderflower_liqueur,
      Tamarind→tamarind_paste, Black Garlic→garlic. Combined FlavorGraph∪compound coverage
      is now **71/72** — only Mahlab has neither signal. `tsc --noEmit` clean against the
      regenerated data.

- [x] **Step 6 — Bridge-spice finder (engine).** `src/lib/bridge-finder.ts`:
      `findBridges(a, b)` ranks candidates by max-min blended evidence over both legs
      (a bridge is only as strong as its weaker connection), returning per-leg evidence
      for the "why", `gain` over the direct score, and a `needsBridge` flag (direct < 0.55).
      `findWeakestPair(selectedIds)` finds the natural bridge target within a blend.
      Built on new `getPairEvidence(a, b)` / `getCuratedLabel(a, b)` in `pairing-engine.ts`
      (label-optional blend for arbitrary pairs, so unembedded spices participate via the
      compound/curated fallback — even Mahlab gets bridges). New `src/lib/spice-list.ts`
      exposes the taxonomy leaves. Verified: cayenne bridges chipotle×cardamom
      (0.711 vs 0.554 direct) — the plan's own example, found from data.
- [x] **Step 7 — Surprise generator (engine).** `src/lib/surprise-finder.ts`:
      surpriseScore = normalized FlavorGraph affinity × novelty. Novelty discounts taxonomy
      familiarity (same family/subfamily — this signal was *necessary*: affinity alone
      top-ranks basil×oregano-style cliches), compound overlap, and curated labels.
      `rankSurprises({forSpiceId?, limit, perSpiceCap})` — per-spice cap stops promiscuous
      ingredients (sesame) from dominating; `pickSurprise({random?})` weighted-samples the
      top-40 pool for the "surprise me" button (injectable RNG for determinism). Top hits:
      nutmeg×cilantro, oregano×sesame, vanilla×basil, shiso×yuzu.
- [x] **Step 6 UI — bridge section in `MapPairingPanel`.** With ≥2 spices selected, the panel
      finds the blend's weakest pair (`findWeakestPair`); when it needs a bridge
      (direct < 0.55 or no evidence), a fuchsia "Bridge the gap" section shows the top-3
      connectors with bridge-score bar, `+gain` badge, per-leg scores
      ("0.71 ↔ Chipotle · 0.68 ↔ Cardamom"), and a "+ add" button (off-map fallback label).
      `tsc` + `next build` clean.
      **Step 7 UI still needed** (surprise button); engine API ready.
- [x] **Step 8 — Data-driven substitutions (engine).** Raw FlavorGraph affinity can't rank
      substitutes — it conflates "pairs well" with "is similar" (nutmeg×cilantro = 0.93,
      great pairing, terrible substitute). `src/lib/substitution-engine.ts` instead blends
      four signals (weights redistribute when absent): 5-axis flavor-profile similarity (0.4),
      compound-overlap chemistry (0.25), taxonomy proximity (0.2), FlavorGraph affinity (0.15).
      Profile vectors come from new `src/data/flavor-vectors.json`
      (`ingestion/extract_flavor_vectors.ts` re-keys generated_profiles slugs → taxonomy ids
      via the app's own `toTaxonomyId`; run with
      `npx tsx --tsconfig tsconfig.json ingestion/extract_flavor_vectors.ts`).
      `getSubstitutes(spiceId, {limit, excludeIds})` returns ranked candidates with the full
      per-signal breakdown (the "why") + `intensityDelta` ("use more/less" guidance).
      Taxonomy-only candidates (no other evidence) are dampened ×0.75 so a data-free
      same-subfamily pair doesn't read as a perfect match. Sanity checks: nutmeg→cinnamon/
      allspice/mace, cumin→caraway, oregano→thyme/marjoram, chipotle→red-pepper-flakes/cayenne;
      cilantro does *not* appear as a nutmeg substitute. Even Mahlab (zero data) degrades
      gracefully to dampened taxonomy neighbors (fennel/anise seed at 0.75).
      *(Incidental: added `bayleaves` alias to `spice-id-map.ts` — "Bay Leaves" previously
      resolved to no taxonomy id, so it got no pairing data anywhere in the app.)*
      ~~**Step 8 UI still needed:** `SubstitutionView` shows the LLM substitute list; augment or
      replace with `getSubstitutes` (taxonomy ids — translate slugs at the boundary as usual).~~
- [x] **Step 7 UI — "Surprise me".** `pairing/SurpriseSection.tsx` in `MapPairingPanel` (amber
      accent): rolls `pickSurprise` (scoped to the selected spice when exactly one is picked),
      shows the pair, recipe-affinity bar, a prose novelty explanation, shared flavor *words*
      (not raw IUPAC compound names), re-roll, and "Try it on the map →" which replaces the map
      selection via new `SelectionContext.selectSpices(ids)`.
- [x] **Step 8 UI — data-driven SubstitutionView.** Candidate list now comes from
      `getSubstitutes` (slug→taxonomy at the boundary), with blended-score bar, best-match
      badge, intensity swap guidance, curated LLM notes merged in by name, and an expandable
      "why this score?" evidence panel (profile/chemistry/family/recipes signal bars + shared
      compound chips). Attribution footnote under the list.
- [x] **UX polish pass.** First-visit hint chip on the map (fades once the user selects),
      "Out of X? Find substitutes" handoff from the pairing panel into the Substitution Finder
      (opens pre-focused via `initialFocusId`), computed spice/family counts + data attribution
      in the NavDrawer footer, sharper page metadata, 2D map title no longer clipped by the
      hamburger, fixed invalid hsl+hex-alpha family chip color.
      Verified with Playwright on the scatter view: surprise roll → try-on-map → 10 suggestions
      + glowing edges → single-spice substitutes handoff → evidence expansion; cumin→Caraway.
      `tsc` + `next build` clean.

- [x] **Blend Builder (engine + UI).** `src/lib/blend-analyzer.ts`: `getBlendProfile`
      (mean 5-axis vector), `getBlendCohesion` (mean pairwise `getPairEvidence`), `findBlendGap`
      (weakest **core** axis — warmth/brightness/earthiness only; heat/florality are stylistic
      choices, not flaws — with candidates ranked 0.55·axis + 0.45·fit-to-blend).
      `pairing/BlendSection.tsx` (cyan): SVG radar, cohesion bar with
      harmonious/balanced/adventurous verdict, gap chips with +add. Shows at ≥2 selected.
- [x] **Dish anchoring.** `ingestion/ingest_dish_affinities.py` reuses
      `flavorgraph_coverage.json` matching to score 65 spices × 38 base ingredients
      (proteins/veg/grains/fruit/dairy) → `src/data/dish-affinities.json`. Sanity: salmon→dill,
      apples→cinnamon, chocolate→vanilla, lamb→sumac. `src/lib/dish-affinity.ts` +
      `pairing/DishSection.tsx` (lime): "Cooking something?" dish picker with per-dish-relative
      bars and +add; respects rack-only.
- [x] **My Rack.** `src/context/RackContext.tsx` (localStorage `spice-rack` /
      `spice-rack-only`, hydrates post-mount). Mark spices via ◉ toggles in the Substitution
      Finder list; NavDrawer shows count + "only show my rack" switch. Rack-only filters
      pairing suggestions (with hidden count) and substitutes (over-fetches 24 then filters).
- [x] **Cuisine lens.** `page.tsx` exposes `cuisine_names`; NavDrawer pill filter (cuisines
      with ≥4 spices, frequency-sorted); filters map data alongside the heat filter with a
      dismissible "Indian lens · 34 spices" badge at top-left.
      All verified with Playwright (blend radar/cohesion, salmon ranking, lens count,
      rack marking + rack-only substitutes cumin→coriander/cinnamon). `tsc` + `next build` clean.

- [x] **Blend save/share/ratios + Supabase removal.** `getBlendRatios` in `blend-analyzer.ts`
      (intensity buckets — smooth inverse weighting collapses to 1:1 because intensities
      cluster 75–90; <60→4, <75→3, <85→2, else 1 part; base/support/accent roles).
      `SavedBlendsContext` (localStorage `spice-blends`), `blend-url.ts`
      (`/?b=nutmeg~cardamom~cloves&n=Name`), load-from-URL in `MapClientLoader`,
      save-with-name + copy-share-link in `BlendSection`, `SavedBlendsList` in the panel's
      empty state (load / share / delete). **Supabase fully removed** (user decision — prefer
      SQLite/PGlite if server persistence is ever needed): deleted `supabase-queries.ts`,
      `src/utils/supabase`, `src/proxy.ts` (middleware existed only for session refresh),
      `load_to_supabase.py`, schema/setup docs; `@supabase/*` deps dropped; `FlavorWheel`
      intensity now reads `flavor-vectors.json`. `.env.local` still holds SUPABASE_* keys
      (left for the user to delete/rotate). Verified via Playwright: ratio row
      (3 Nutmeg : 2 Cardamom : 1 Clove), save → reload persistence → click-to-load,
      share-URL roundtrip selects the blend in a fresh page. `tsc` + `next build` clean,
      no middleware in build output.

- [x] **Classic blends + search + mobile (Sonnet subagents, verified by lead).**
      (a) `src/data/classic-blends.json` (12 blends, 86 refs all resolving to taxonomy leaves) +
      `src/lib/classic-blends.ts` (`matchClassicBlends`: ≥2 matched, fraction ≥ 1/3) +
      rose-accented `ClassicBlendHint` ("4/9 · Garam Masala · still need…" with +add chips)
      and `ClassicBlendStarters` in the panel empty state.
      (b) `SpiceSearch.tsx` command palette (⌘K / Ctrl+K / "/", arrows+Enter, multi-add with
      "✓ added X" feedback, selected-state ticks), trigger top-right of map views.
      (c) Mobile pass (`max-md:` only): pairing panel becomes a bottom sheet
      (max-h-[55vh], grab bar), SubstitutionView stacks (h-40 list strip on top),
      search trigger repositions, FlavorMap2D paddings/wrap.
      Lead verification: Playwright desktop (starters, Baharat/Garam Masala hint on
      cinnamon+cardamom+clove+cumin, ⌘K→"saff"→Enter adds Saffron) + mobile 390×844
      (sheet + collapsed + substitution stack). `tsc` + `next build` clean.

- [x] **Cleanup pass (portfolio readiness).**
      *Attribution correction:* every UI credit / comment that named Ahn et al. (2011) as a data
      source now credits FlavorGraph (Park et al. 2021), FooDB and USDA Dr. Duke's Phytochemical DB
      (Ahn stays in the README as the theory only). *Dead code:* removed the unmounted
      `SpiceSelectionApp` → `PairingSidebar` chain (`Header`, `flavor-wheel/*`, `AIToggle`,
      `PairingSuggestions`, `SpiceDetailCard`, `useResizeObserver`), leftover Supabase types
      (`types/database.ts`), unused AI-mode state in `SelectionContext`, and helpers only that UI
      used. *Docs:* rewrote `README.md` and `ingestion/README.md` to match the real pipeline and
      engine weights; `compute_compound_overlap.py` / `generate_coords.py` flagged legacy.
      *Lint clean:* real types replace `any` (shared `SpiceProfile` types), localStorage contexts
      moved to `useSyncExternalStore` (`lib/local-store.ts`), SpiceSearch resets moved out of
      effects. Incidental fix: the 3D tooltip rendered `key_compounds` objects as React children.
      `tsc` + `eslint src` (0 problems) + `next build` clean.

- [x] **FlavorDB2 as a second chemistry source.** Added `ingestion/ingest_flavordb2.py`
      (entity JSON cached in git-ignored `ingestion/flavordb2_cache/`, fetched on miss) and a
      hand-verified `FLAVORDB2_MAP` (spice → entity id + exact/approx). *Pair-level rule:* an entry is
      usable at ≥30 molecules; a pair gets a FlavorDB2 signal if both spices are usable, map to
      different entities, and (both exact OR the pair has no FooDB/USDA signal) — approx entries fill
      gaps pair by pair but never add a second opinion where FooDB/USDA has evidence (Cumin ×
      Coriander Seed stays FooDB-only; Horseradish × Mustard Seed is FlavorDB2-scored). Pair score
      = IDF-weighted cosine over PubChem-id molecule sets (IDF over the 44 distinct usable
      entities; raw Jaccard is useless: ~90 molecules appear in nearly every entity); same-entity
      pairs are excluded. 47 usable spices → 866 pairs (`flavordb2_pairs.json`,
      `flavordb2_coverage.json`).
      `ingest_compound_overlap.py` now merges it: each source is converted to a percentile rank
      within its own pair distribution and `compoundScore` = mean of the available ranks; pairs gain
      `flavordb2 {score, sharedCount, sharedFlavorWords}`, `compoundScore`, `sources`; FooDB/USDA
      fields are untouched (verified identical for all 914 existing pairs). 513 FlavorDB2-only pairs
      were added → 1,427 pairs; compound coverage 55 → 65/72 (new: Horseradish, Wasabi, Parsley,
      Chive, Lemon/Orange/Lime Zest, Dried Lime, Black Garlic, Dried Mushroom). *App wiring:*
      pairing, substitution and surprise engines read `compoundScore` instead of
      `min(1, jaccard / 0.4)` (weights unchanged: 0.6/0.2/0.2 pairing, 0.4/0.25/0.2/0.15
      substitution); `getCompoundDetails` now ranks by `compoundScore`; WhyPopover and the
      substitution evidence panel show "Shared flavor notes (FlavorDB2)" chips; all UI credits name
      FlavorDB2. *License:* FlavorDB2 is CC BY-NC-SA 3.0, so the derived `compound-overlap.json` is
      distributed under it (non-commercial; consistent with FooDB). Run order: `ingest_flavordb2.py`
      → `ingest_compound_overlap.py`. `tsc` + `eslint src` + `next build` clean.

### Remaining coverage gap
Truly absent from FlavorGraph embeddings (7): Sichuan Pepper, Long Pepper, Aleppo Pepper,
Tonka Bean, Mahlab, Hibiscus, Chamomile — all but Mahlab are covered by the Step 4
compound-overlap fallback. Mahlab scores on curated label only.

---

## Plan

### Step 2 — Merge scores into the pairing engine
`src/lib/pairing-engine.ts`:
- Load `pairing-scores.json` into a lookup keyed by unordered spice-id pair.
- Extend `RankedPairing` with `affinityScore` and (later) `sharedCompounds`.
- Rank suggestions by the blended score instead of label + matchCount alone.
- Keep the curated data as a fallback/tie-breaker and for spices without a FlavorGraph vector.

### Step 3 — Surface scores + "why" in the UI
`src/components/pairing/PairingSidebar.tsx`, `SpiceDetailCard.tsx`, `PairingSuggestions.tsx`:
- Show a score bar (0–1) per suggested pairing.
- "Why?" popover: FlavorGraph affinity + shared-compound list + curated label.
- Dark / neon aesthetic — this is a feature to show off, not a footnote.

### Step 4 — Compound-overlap layer (FooDB + USDA)  ← also backfills coverage
- New ingestion step: join FooDB compound data (originally planned: Ahn et al. table — never used) with existing USDA
  compound data (`compute_compound_overlap.py` is already started).
- Emit shared-compound lists per pair → feeds the "why" popover.
- For the 14 spices FlavorGraph can't embed, use compound overlap to produce a fallback score,
  so the whole 72-spice set is covered.

### Step 5 — Affinity edges on the Flavor Map (visual payoff #1)
`src/components/FlavorMap2D.tsx`:
- On spice selection, draw glowing edges to top-N affinity partners.
- Edge thickness/brightness = FlavorGraph score.
- Turns the static scatter into a living network. Selection state already lives in
  `SelectionContext`, so this is mostly D3 work.

### Step 6 — Bridge-spice finder (visual payoff #2, Blend Builder)
- Vector arithmetic on embeddings: given two poorly-pairing spices, find the spice whose vector
  maximizes the minimum similarity to both. "Chipotle and cardamom clash — cinnamon bridges them."
- Falls out of the embeddings for free; nobody else has this.

### Step 7 — Surprise pairing generator (near-free once matrix exists)
- High FlavorGraph affinity + low compound overlap (or absent from curated pairings) =
  genuinely non-obvious suggestions. A "surprise me" button fits the exploration-first product.

### Step 8 — Data-driven substitutions
`src/components/SubstitutionView.tsx`:
- Nearest neighbors in embedding space = substitution candidates with a real similarity score,
  replacing/augmenting the current LLM substitute list.

---

## Explicitly out of scope (learned from Epicure)
- **Full AI recipe generation + image gen** (Gemini/Imagen) — expensive, off-mission, wrong stack.
- **Minimalist aesthetic** — our dark/electric data-viz brand is a better fit for a tool about
  revealing structure.

## Later / post-launch idea
- **MCP endpoint** exposing SpiceSelection pairing data ("what pairs with sumac?") as a novel,
  low-cost distribution channel — mirrors Epicure's `epicure-mcp.kaikaku.ai/mcp`. Not MVP.

---

## Build order
1b (retry) → 2 (engine merge) → 3 (UI scores/why) → 4 (compound layer + coverage backfill) →
5 (map edges) → 6 (bridge finder) → 7 (surprise) → 8 (substitutions).


## Data pipeline audit — 2026-10-13

- Preserve sweet Paprika separately from Smoked Paprika: one new taxonomy leaf,
  generated idempotently by `ingestion/add_paprika_taxonomy.py` (73 leaves total).
  Its `sweet-paprika` profile slug/new alias preserves the historical `paprika` alias.
- Merge Bay leaf/Bay leaves, retaining alternate source record as provenance; normalize
  active families from taxonomy. Existing numerical axis estimates are preserved.
- Extend the generator's compound context to cached FlavorDB2 plus FooDB and USDA,
  validate schema, make skip-existing identity-aware, and support validated local imports.
  Provider exception bodies are suppressed because they may contain credentials.
- User authorized Luna-authored missing profiles after Gemini consumer suspension;
  provenance explicitly distinguishes estimates from measurements.
- Add descriptor-derived IDF aroma fingerprints with 12 fixed families, null missing
  vectors, source quality and descriptor audit; compare original axes with Pearson,
  Spearman and standardized disagreement reports. No silent axis recalibration.
- Integrate only CulinaryDB as an additional bulk source: 45,772 recipes, 26 cuisine
  labels, 33 mapped ingredients; preserve denominators, provenance, hashes and NC-SA terms.
- Add cited pungency evidence separately from odor; no fabricated whole-spice Scoville
  values or purported universal pepper/mustard/ginger ranking.
- Rebuild recipe, compound, dish, vector and atlas artifacts; identity/coverage checks
  and fingerprint/cuisine invariants live under `ingestion/`. Full results and changed
  files are recorded in `docs/analysis/data-completeness-report.md`.
