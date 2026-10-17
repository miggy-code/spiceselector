"""
FlavorDB2 ingestion (second chemistry source for the compound-overlap layer).

FlavorDB2 (Garg et al., "FlavorDB: a database of flavor molecules", Nucleic Acids
Research 2018, doi:10.1093/nar/gkx957; update: arXiv:2205.05451;
https://cosylab.iiitd.edu.in/flavordb2/) lists, per natural ingredient entity, the
flavor molecules found in it, each with a flavor_profile ("lemon@citrus@...").

For every project spice with a (hand-verified) FlavorDB2 entity this script builds a
molecule set and scores every spice pair with an IDF-weighted cosine. Raw Jaccard is
useless on this data: ~90 molecules appear in nearly every entity, so unrelated pairs
(Saffron x Horseradish) outscore related ones (Cumin x Coriander). IDF down-weights
exactly those ubiquitous molecules.

Usable entries and which pairs get a signal (pair-level rule):
  - A spice's entry is *usable* if the entity has >= MIN_MOLECULES molecules
    (exact or approx).
  - IDF is computed over ALL usable entries: N = number of distinct usable entity_ids,
    df(m) counts distinct entities (so a shared entity like Garlic 259 counts once).
  - A pair gets a FlavorDB2 signal if both spices are usable, they map to different
    entity_ids, AND (both are "exact" OR the pair has no FooDB/USDA signal).
  "approx" entries (stand-in entities such as lemon peel oil for Lemon Zest) therefore
  fill gaps pair by pair, but never add a second opinion where FooDB/USDA already has
  evidence for that pair (Cumin x Coriander Seed stays FooDB-only; Horseradish x Mustard
  Seed is scored by FlavorDB2 because Horseradish has no FooDB/USDA data).

Pair score:
    idf(m) = ln(N / df(m))
    score(A, B) = sum_{m in A&B} idf^2 / ( sqrt(sum_{m in A} idf^2) * sqrt(sum_{m in B} idf^2) )
Pairs of spices that share one entity (Lime Zest & Dried Lime -> 241, Garlic Powder &
Black Garlic -> 259) score 1.0 trivially; they are stand-ins, not evidence, and are
excluded.

Reads : ../src/data/spice-taxonomy.json, FooDB/USDA inputs (for the gap rule, computed
        via ingest_compound_overlap), flavordb2_cache/<entity_id>.json (fetched on miss).
Writes: flavordb2_pairs.json, flavordb2_coverage.json
Next  : run ingest_compound_overlap.py, which merges flavordb2_pairs.json into
        ../src/data/compound-overlap.json.

FlavorDB2 is CC BY-NC-SA 3.0 — the raw cache is git-ignored; the derived outputs are
committed. See README for licensing.
"""

import json
import math
import time
import urllib.error
import urllib.request
from pathlib import Path

from ingest_compound_overlap import (
    build_compound_index,
    compute_foodb_usda_pairs,
    load_spices,
)

HERE = Path(__file__).parent
CACHE_DIR = HERE / "flavordb2_cache"
OUTPUT_PAIRS = HERE / "flavordb2_pairs.json"
OUTPUT_COVERAGE = HERE / "flavordb2_coverage.json"

ENTITY_URL = "https://cosylab.iiitd.edu.in/flavordb2/entities_json?id={id}"
FETCH_TIMEOUT = 90
FETCH_DELAY = 0.3
FETCH_RETRIES = 3

MIN_MOLECULES = 30
MAX_FLAVOR_WORDS = 8

# spice name (taxonomy leaf) -> (FlavorDB2 entity_id, quality). Hand-verified.
# "exact": the entity is the same ingredient. "approx": a stand-in entity.
FLAVORDB2_MAP = {
    # Expansion verified against cached entity JSON, 2026-10-17.
    "Mint": (266, "approx"),  # Spearmint display name, but entity_alias is spearmint-oil.
    "Asafoetida": (376, "exact"),
    "Ajwain": (381, "exact"),  # Carom Seed; explicit Ajwain synonym.
    "Curry Leaf": (385, "exact"),
    "Savory": (444, "exact"),  # Specifically Summer savory.
    "Epazote": (708, "exact"),
    # exact
    "Cinnamon": (330, "exact"),
    "Nutmeg": (336, "exact"),
    "Allspice": (375, "exact"),
    "Clove": (331, "exact"),
    "Star Anise": (325, "exact"),
    "Cardamom": (327, "exact"),
    "Cassia": (328, "exact"),
    "Black Pepper": (339, "exact"),
    "Horseradish": (355, "exact"),
    "Wasabi": (361, "exact"),
    "Vanilla": (245, "exact"),
    "Anise Seed": (323, "exact"),
    "Fenugreek": (258, "exact"),
    "Turmeric": (341, "exact"),
    "Ginger": (333, "exact"),
    "Cumin": (332, "exact"),
    "Celery Seed": (329, "exact"),
    "Oregano": (337, "exact"),
    "Thyme": (269, "exact"),
    "Rosemary": (264, "exact"),
    "Marjoram": (335, "exact"),
    "Sage": (265, "exact"),
    "Basil": (250, "exact"),
    "Parsley": (338, "exact"),
    "Dill": (256, "exact"),
    "Tarragon": (268, "exact"),
    "Saffron": (340, "exact"),
    "Poppy Seed": (395, "exact"),
    "Nigella Seed": (392, "exact"),
    "Sesame Seed": (299, "exact"),
    "Tamarind": (218, "exact"),
    "Chive": (343, "exact"),
    "Bay Leaf": (305, "exact"),  # Laurel = Laurus nobilis
    "Hibiscus": (623, "exact"),  # Roselle = H. sabdariffa
    # approx
    "Coriander Seed": (254, "approx"),
    "Fennel Seed": (257, "approx"),
    "Mustard Seed": (356, "approx"),
    "Lemon Zest": (114, "approx"),  # lemon peel oil
    "Orange Zest": (122, "approx"),  # orange oil
    "Lime Zest": (241, "approx"),  # lime fruit
    "Dried Lime": (241, "approx"),
    "Black Garlic": (259, "approx"),  # garlic
    "Garlic Powder": (259, "approx"),
    "Onion Powder": (348, "approx"),
    "Dried Mushroom": (246, "approx"),
    "Thai Basil": (250, "approx"),
    "Amchur": (190, "approx"),  # mango
}

# Deliberately unmapped (thin or wrong FlavorDB2 entries): Mace (21 molecules),
# White Pepper (18), Caraway (16), Galangal (1), Rose Water (14), Lemongrass and
# Chamomile (essential-oil entries), all chilies (generic Capsicum), Cilantro
# (seed vs leaf chemistry differ) — plus anything absent from FlavorDB2.
DELIBERATELY_UNMAPPED = {
    "Mace": "thin entry (21 molecules)",
    "White Pepper": "thin entry (18 molecules)",
    "Caraway": "thin entry (16 molecules)",
    "Galangal": "thin entry (1 molecule)",
    "Rose Water": "thin entry (14 molecules)",
    "Lemongrass": "essential-oil entry, not the ingredient",
    "Chamomile": "essential-oil entry, not the ingredient",
    "Cayenne": "only generic Capsicum entity",
    "Red Pepper Flakes": "only generic Capsicum entity",
    "Chipotle": "only generic Capsicum entity",
    "Gochugaru": "only generic Capsicum entity",
    "Aleppo Pepper": "only generic Capsicum entity",
    "Smoked Paprika": "only generic Capsicum entity",
    "Cilantro": "seed and leaf chemistry differ",
}


# ---------------------------------------------------------------------------
# Entity cache / fetch
# ---------------------------------------------------------------------------

def fetch_entity(entity_id: int) -> dict:
    url = ENTITY_URL.format(id=entity_id)
    last_err = None
    for attempt in range(1, FETCH_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SpiceSelector-ingestion"})
            with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            last_err = e
            print(f"  fetch {entity_id} failed (attempt {attempt}/{FETCH_RETRIES}): {e}")
            time.sleep(FETCH_DELAY * attempt)
    raise RuntimeError(f"could not fetch FlavorDB2 entity {entity_id}: {last_err}")


def load_entity(entity_id: int) -> dict:
    """Read an entity from the cache, fetching (and caching) it if missing."""
    path = CACHE_DIR / f"{entity_id}.json"
    if path.exists():
        return json.loads(path.read_text())
    CACHE_DIR.mkdir(exist_ok=True)
    print(f"  fetching entity {entity_id} ...")
    data = fetch_entity(entity_id)
    path.write_text(json.dumps(data))
    time.sleep(FETCH_DELAY)
    return data


def parse_entity(raw: dict) -> dict:
    """-> {"alias": str, "molecules": {pubchem_id: set(flavor words)}} (deduped by pubchem_id)."""
    mols: dict[int, set[str]] = {}
    for m in raw.get("molecules", []):
        pid = m.get("pubchem_id")
        if pid is None:
            continue
        words = mols.setdefault(int(pid), set())
        for w in (m.get("flavor_profile") or "").split("@"):
            w = w.strip().lower()
            if w:
                words.add(w)
    return {"alias": raw.get("entity_alias_readable"), "molecules": mols}


# ---------------------------------------------------------------------------
# Selection + scoring
# ---------------------------------------------------------------------------

def is_usable(n_molecules: int):
    """-> (usable: bool, reason: str)."""
    if n_molecules < MIN_MOLECULES:
        return False, f"entity has {n_molecules} molecules (< {MIN_MOLECULES})"
    return True, "usable"


def main():
    spices = load_spices()
    names = {s["name"] for s in spices}
    unknown = sorted(set(FLAVORDB2_MAP) - names)
    if unknown:
        raise SystemExit(f"FLAVORDB2_MAP names not in taxonomy: {unknown}")

    # FooDB/USDA layer, computed exactly as ingest_compound_overlap.py does: which
    # spices have data, and which pairs already carry a FooDB/USDA signal.
    index = build_compound_index()
    foodb_pairs, foodb_covered_names, _ = compute_foodb_usda_pairs(spices, index)
    foodb_covered = set(foodb_covered_names)
    foodb_pair_keys = {tuple(sorted((p["a"], p["b"]))) for p in foodb_pairs}

    entities = {}
    for eid in sorted({e for e, _ in FLAVORDB2_MAP.values()}):
        entities[eid] = parse_entity(load_entity(eid))

    usable = []  # {id, name, entity, quality, mols}
    coverage_rows = []
    for sp in spices:
        name = sp["name"]
        if name not in FLAVORDB2_MAP:
            reason = DELIBERATELY_UNMAPPED.get(name, "no FlavorDB2 entity mapped")
            coverage_rows.append(
                {"spice": name, "status": "excluded", "reason": reason,
                 "entityId": None, "quality": None, "molecules": None,
                 "alsoInFoodbUsda": name in foodb_covered}
            )
            continue
        eid, quality = FLAVORDB2_MAP[name]
        ent = entities[eid]
        n_mol = len(ent["molecules"])
        ok, reason = is_usable(n_mol)
        coverage_rows.append(
            {"spice": name, "status": "usable" if ok else "excluded", "reason": reason,
             "entityId": eid, "entityName": ent["alias"], "quality": quality,
             "molecules": n_mol, "alsoInFoodbUsda": name in foodb_covered}
        )
        if ok:
            usable.append({"id": sp["id"], "name": name, "entity": eid,
                           "quality": quality, "mols": ent["molecules"]})

    # IDF over distinct usable entities (a shared entity counts once).
    usable_entities = {u["entity"]: u["mols"] for u in usable}
    N = len(usable_entities)
    print(f"{len(usable)} usable spices over {N} distinct FlavorDB2 entities")
    df: dict[int, int] = {}
    for mols in usable_entities.values():
        for m in mols:
            df[m] = df.get(m, 0) + 1
    idf = {m: math.log(N / c) for m, c in df.items()}
    idf2 = {m: v * v for m, v in idf.items()}

    for u in usable:
        u["norm"] = math.sqrt(sum(idf2[m] for m in u["mols"]))

    # molecule -> flavor words (molecule-level; same across entities)
    mol_words: dict[int, set[str]] = {}
    for u in usable:
        for m, words in u["mols"].items():
            mol_words.setdefault(m, set()).update(words)

    pairs = []
    zero_pairs = 0
    skipped_same_entity = 0
    skipped_approx_has_foodb = 0
    for i in range(len(usable)):
        for j in range(i + 1, len(usable)):
            A, B = usable[i], usable[j]
            if A["entity"] == B["entity"]:
                skipped_same_entity += 1
                continue
            a, b = sorted((A["id"], B["id"]))
            both_exact = A["quality"] == "exact" and B["quality"] == "exact"
            if not both_exact and (a, b) in foodb_pair_keys:
                skipped_approx_has_foodb += 1
                continue
            if A["norm"] == 0 or B["norm"] == 0:
                continue
            shared = set(A["mols"]) & set(B["mols"])
            num = sum(idf2[m] for m in shared)
            score = num / (A["norm"] * B["norm"])
            if not shared or score <= 0:
                zero_pairs += 1
                continue
            # flavor words ranked by summed idf of the shared molecules carrying them
            word_weight: dict[str, float] = {}
            for m in shared:
                for w in mol_words.get(m, ()):
                    word_weight[w] = word_weight.get(w, 0.0) + idf[m]
            top = sorted(word_weight.items(), key=lambda kv: (-kv[1], kv[0]))[:MAX_FLAVOR_WORDS]
            pairs.append(
                {
                    "a": a,
                    "b": b,
                    "score": round(score, 4),
                    "sharedCount": len(shared),
                    "sharedFlavorWords": [w for w, _ in top],
                }
            )

    pairs.sort(key=lambda p: (-p["score"], p["a"], p["b"]))
    OUTPUT_PAIRS.write_text(json.dumps(pairs, indent=1))
    print(
        f"Wrote {len(pairs)} FlavorDB2 pairs to {OUTPUT_PAIRS} "
        f"({skipped_same_entity} same-entity pairs excluded, "
        f"{skipped_approx_has_foodb} approx pairs skipped because FooDB/USDA already has a signal, "
        f"{zero_pairs} zero-score pairs dropped)"
    )

    id_to_name = {sp["id"]: sp["name"] for sp in spices}
    in_pairs = {i for p in pairs for i in (p["a"], p["b"])}
    newly_covered = [
        sp["name"] for sp in spices
        if sp["id"] in in_pairs and sp["name"] not in foodb_covered
    ]
    coverage = {
        "usableSpiceCount": len(usable),
        "distinctUsableEntities": N,
        "totalSpices": len(spices),
        "minMolecules": MIN_MOLECULES,
        "pairCount": len(pairs),
        "sameEntityPairsExcluded": skipped_same_entity,
        "approxPairsSkippedFoodbUsdaHasSignal": skipped_approx_has_foodb,
        "zeroScorePairsDropped": zero_pairs,
        "newlyCovered": newly_covered,
        "spices": coverage_rows,
    }
    OUTPUT_COVERAGE.write_text(json.dumps(coverage, indent=2))
    print(f"Wrote coverage report to {OUTPUT_COVERAGE}")
    print(f"New compound coverage from FlavorDB2 ({len(newly_covered)}): "
          f"{', '.join(newly_covered)}")


if __name__ == "__main__":
    main()
