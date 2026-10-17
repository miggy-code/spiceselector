# SpiceRx evaluation

**Retrieved:** 2026-10-17  
**Decision:** Do not add SpiceRx to the flavor chemistry pipeline. Keep it as a reference for a separate, clearly non-medical literature/evidence feature if that product scope emerges.

## What it contains

SpiceRx is a biomedical evidence resource, not an aroma or flavor database. Its FAQ lists 188 culinary herb/spice entries, 152 with literature-derived disease associations, and 866 phytochemicals across 142 spices; the newer guide reports 11,750 MEDLINE abstracts, 8,957 spice-disease associations (8,172 positive and 783 negative), 848 MeSH disease IDs, and 2,042 spice-phytochemical links. The guide’s stated total differs by two from the sum of its positive and negative counts; preserve that source inconsistency rather than treating it as reconciled. The FAQ gives an older source cutoff of July 2017 (23 million PubMed abstracts); the guide says its processing started from 28 million abstracts. Spice names and literature associations, phytochemical records, PubChem identifiers, MeSH disease terms, reference PMIDs, and association polarity are the useful structured fields. Sources described include MEDLINE/PubMed, KNApSAcK, PhenolExplorer, PubChem, and CTD. [FAQ](https://cosylab.iiitd.edu.in/spicerx/faq) · [How to Use / overview](https://cosylab.iiitd.edu.in/spicerx/how_to_use) · [2018 paper](https://doi.org/10.1371/journal.pone.0198030)

The site exposes interactive spice, disease, and phytochemical searches, plus individual phytochemical downloads as JSON, SDF, Mol2, or 2D image. I found no documented bulk export or public API in the FAQ or guide. The paper’s supporting files include XLSX tables for spice-disease statistics and tripartite spice-disease-phytochemical associations, but those are aggregate study supplements rather than a documented current dump/API for the live database. [Paper supporting-data descriptions](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0198030&type=printable) · [Phytochemical download instructions](https://cosylab.iiitd.edu.in/spicerx/how_to_use)

## License and reuse

The live site labels “this work” CC BY-NC-SA 3.0. The 2018 PLOS paper states CC BY for the article and its supporting information. These notices do not by themselves establish the redistribution terms of every upstream chemical, disease, or literature record incorporated into the live database. Treat live-site data as noncommercial/share-alike unless the maintainers confirm otherwise; do not assume either the site badge or paper license clears all underlying sources for commercial reuse. Any integration needs source-level provenance and rights review. [Site license](https://cosylab.iiitd.edu.in/spicerx/) · [Paper license/data statement](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0198030&type=printable)

## Requested ingredient coverage

“Verified” means the live SpiceRx record or association page surfaced on the primary site. “Not verified” means exact-name searches did not establish a SpiceRx record; it is not proof the ingredient is absent. Species-level or related entries do not establish cultivar-specific coverage.

| Ingredient(s) | Result | Evidence / limits |
|---|---|---|
| Mint / spearmint | **Verified:** Spearmint (*Mentha spicata*), with phytochemicals and disease associations | [Spearmint record](https://cosylab.iiitd.edu.in/spicerx/search_plants?id=29719&page=1). This is specifically spearmint, not a generic mint record. |
| Curry leaf | **Verified:** Curry Leaf appears in live disease-association results | [Diabetes association results](https://cosylab.iiitd.edu.in/spicerx/get_disease?id=MESH%3AD003920&page=1). The surfaced row includes reference PMIDs; that page does not surface phytochemicals linked to this particular disease. |
| Asafoetida | **Not verified** | Exact-name searches did not surface a SpiceRx record. |
| Ajwain | **Verified:** Ajowan (*Trachyspermum ammi*), with phytochemical Thymol listed | [Ajowan record](https://cosylab.iiitd.edu.in/spicerx/search_plants?id=52570&page=1). The common-name list also includes “Caraway,” an ambiguous alias; preserve the scientific name. |
| Black cardamom | **Not verified** | No exact SpiceRx record was established. Mentions in recipes elsewhere on CoSyLab do not demonstrate SpiceRx coverage. |
| Annatto / achiote | **Verified:** Achiote (*Bixa orellana*); aliases include Annatto and Achiote; phytochemicals listed | [Achiote record](https://cosylab.iiitd.edu.in/spicerx/search_plants?id=66672&page=1). |
| Epazote | **Verified:** Wormseed (*Dysphania ambrosioides*); aliases include Epazote | [Wormseed record](https://cosylab.iiitd.edu.in/spicerx/search_plants?id=330163&page=1). |
| Huacatay | **Not verified** | Exact-name searches did not surface a SpiceRx record. |
| Aji amarillo, ají panca, rocoto | **Not verified as named cultivars. Related generic Capsicum records only** | The live site has *Capsicum annuum* Bell Pepper and *Capsicum frutescens* Chilli Pepper, but neither supports inference for these named Peruvian cultivars. The paper says some botanical varieties were standardized to species, which further limits cultivar-level attribution. [Bell Pepper](https://cosylab.iiitd.edu.in/spicerx/search_plants?id=4072&page=1) · [Chilli Pepper](https://cosylab.iiitd.edu.in/spicerx/search_plants?id=4073&page=1) · [paper methods](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0198030&type=printable) |
| Juniper berry | **Verified:** Juniper (*Juniperus communis*); alias includes Juniper Berry; phytochemicals listed | [Juniper record](https://cosylab.iiitd.edu.in/spicerx/search_plants?id=58039&page=1). |
| Savory / summer savory | **Verified:** Summer Savory is present in association results | [Summer Savory association result](https://cosylab.iiitd.edu.in/spicerx/get_disease?id=MESH%3AD003141&page=1), with *Satureja hortensis* studies. No direct profile page was confirmed in this check. |

## Value for SpiceSelection

Current chemistry ingestion joins FooDB/USDA phytochemical records with FlavorDB2 aroma descriptors. The aroma fingerprint explicitly uses molecule descriptor presence rather than concentrations or measured sensory intensity; the compound-overlap layer likewise reports shared chemicals and flavor words. SpiceRx’s phytochemicals are compiled for biomedical/bioactivity linkage, not selected as volatile aroma compounds, odor-active compounds, or sensory descriptors. It supplies no flavor notes, abundance/concentration, preparation state, or sensory measurements. Adding its compound list as flavor chemistry would therefore risk treating a broad bioactive plant-compound inventory as evidence of aroma similarity. [Current compound-overlap pipeline](../../ingestion/ingest_compound_overlap.py) · [aroma fingerprint method](../analysis/aroma-method.json)

If a future research feature needs it, keep the records in a separate, non-medical evidence layer and join on stable IDs rather than names. Candidate fields: `source`, `source_record_id` (NCBI Taxonomy ID), `canonical_name`, `source_aliases`, `scientific_name`, `pubchem_id`, `compound_name`, `mesh_id`, `association_polarity`, `pmid`, `evidence_cutoff`, `source_confidence` (`curated` / `text-mined` / `inferred` where documented), `retrieved_at`, `license`, and `provenance`. Do not feed disease associations, polarity, or bioactivity into flavor similarity or recommendations; the site itself says the material is not medical advice. [FAQ disclaimer](https://cosylab.iiitd.edu.in/spicerx/faq)
