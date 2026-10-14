# Spice display exploration

Exploratory analysis of the local working tree on 2026-10-13. This is evidence for design choices, not an approved implementation plan.

## Findings

- The current maps plot 57 profiles, corresponding to 55 unique taxonomy identifiers. The taxonomy contains 72 spices; 17 have no plotted profile. Bay leaf/Bay leaves share an identifier, and Paprika/Smoked paprika also share one. These are identity and granularity issues to resolve deliberately, rather than blindly merging all matching identifiers.
- 22 profiles have family strings absent from the eight-entry color lookup. Case variants and noncanonical names use the fallback color. Family strings should be normalized or mapped before using colors, family counts, or family-based analysis.
- All five flavor coordinates are present. Most values on the first four axes are multiples of five. The default warmth/brightness view has eight groups with identical coordinates, including a three-spice group. Ten circle pairs overlap at the current 800 × 600 viewBox geometry, ignoring selection enlargement. Heat is at most 10 for 40/57 profiles.
- The default axes retain 45.6% of each spice's six nearest neighbors from the full five-dimensional flavor space. Unscaled PCA retains 60.2%, with its first two components explaining 68.4% of variance. This makes PCA a candidate, not a settled choice; the coordinate meanings are less direct and neighborhood retention remains incomplete. Brightness/heat retains 49.1% but has 26 overlapping circle pairs.
- The recipe affinity data contain all 2,080 unordered pairs among 65 embedded taxonomy spices. The median cosine score is 0.5738. 1,954 pairs (93.9%) exceed the map's 0.5 threshold, while 215 (10.3%) exceed 0.7. The map already caps edges to six per selected spice, so it is not currently rendering all 1,954 edges. The cutoff itself offers little selectivity.
- Across the 1,176 scored unordered pairs in the deduplicated flavor-vector artifact, rank correlation between negative Euclidean flavor distance and recipe affinity is 0.056. Across plotted profile pair observations it is 0.060, and on default axes 0.016. Recipe affinity and compound percentile score correlate at 0.025 across 1,338 overlapping taxonomy pairs. These observations suggest displaying the signals explicitly rather than treating proximity as a single measure of compatibility.
- Six plotted profiles have no recipe affinity signal: Aleppo pepper, Chamomile, Hibiscus, Long pepper, Sichuan pepper, and Tonka bean. Missing evidence should be distinguished from weak evidence. Five taxonomy matches to recipe embeddings are approximate; these should remain visible in explanations.

## Display options

| Option | User task | Design | Main tradeoff |
|---|---|---|---|
| Refined axis map | Browse flavor character | Improve the existing D3 view with fixed axis meanings, tick labels, collision expansion, selective labels, stable colors, and a clear selected state. Keep recipe links explicitly labeled. | Smallest change; two axes omit three dimensions. |
| Flavor atlas | Discover neighborhoods | Evaluate PCA and UMAP on all five flavor axes. Add named regions only when supported, stable coordinates, zoom, search, and a selected-spice profile. | Better potential coverage of flavor structure; projection distances are approximate and need explanation. |
| Focused pairing network | Decide what to cook together | Center a selected spice, dish, or blend, show a small ranked set of partners, and reveal a bridge when useful. Give similar flavor, recipe affinity, and chemistry separate meanings. | Clearer local decisions; does not show the whole dataset at once. |
| Clustered affinity matrix | Inspect patterns and compare pairs | Rows and columns are spices, with cells colored by the chosen signal and missing values distinctly marked. Offer selected-blend subsets for cooking. | Excellent for dense relationships; large full matrices need labels, zoom, or subsets, particularly on phones. |
| Organized family browser | Find familiar starting points | Browse family groups and cuisine lenses, then open a focused pairing view. A wheel or grouped tiles can provide a friendly overview. | Clear hierarchy, but grouping is curated and does not measure affinity. |
| Refined 3D scene | Playful exploration | Keep 3D as an optional atlas view with reduced glow, restrained motion, improved labels, accessible selection, and camera presets. | Engaging spatial interaction; occlusion and rotation remain costs for comparing spices. |

For Miguel's stated goals of exploration and cooking, the current recommendation is an atlas paired with a focused pairing view. The minimal alternative is refining the existing axis map and its selected state. A family browser followed by a dish-centered pairing view is the lateral alternative. No approach has been selected yet.

## Next analysis

1. Resolve family names and profile identities before assessing family separation or communities.
2. Compare raw and standardized PCA, UMAP over several seeds and neighborhood settings, and projections from normalized recipe embeddings. Measure nearest-neighbor retention, stability, collisions, and disagreement with the original data. Never derive a cosine distance embedding from an arbitrary combined score without checking the distance model.
3. Assess mutual nearest-neighbor graphs and local percentiles alongside fixed thresholds. Compare coverage and hub concentration, including spices with sparse or approximate evidence.
4. Compare the visuals on three concrete tasks: explore cumin, find partners for salmon, and extend a three-spice blend. Check whether the user can explain why a suggestion appeared and distinguish missing evidence from low scores.

## Reproduction and limitations

Run `python3 docs/analysis/eda.py` with NumPy, SciPy, and scikit-learn installed. It produces `results.json` and `plot-data.json` beside the script. The interactive comparison is a frozen snapshot of the current-axis and PCA coordinates, with equal-sized dots to isolate the positional difference; it does not reproduce the application's intensity-size encoding.

Flavor axes and commonality are generated estimates, not measured sensory observations. Recipe cosine is learned similarity, not a calibrated probability of a successful dish. Pair observations share spices and are not independent; these correlations are descriptive rather than statistical hypothesis tests. PCA uses equally weighted raw 0–100 axis scores. The working tree contained ongoing application changes; this analysis does not modify those files.
