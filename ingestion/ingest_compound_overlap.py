"""
Compound-overlap ingestion (FooDB/USDA layer).

Computes the shared flavor-compound overlap between every pair of project spices
and writes it to src/data/compound-overlap.json for the pairing engine + "why" popover.

Two local compound sources are merged, keyed by *normalized chemical name* (their
raw id spaces differ and are not comparable):
  - idea/foodb_spice_data.json  — FooDB-derived, carries flavor annotations.
  - idea/spice_data_raw.json     — USDA phytochemical scrape, broader spice coverage,
                                    no flavor annotations.

A second chemistry source, FlavorDB2, is merged in from flavordb2_pairs.json
(produced by ingest_flavordb2.py — run that first). Its pair score is an IDF-weighted
cosine, a different scale from Jaccard, so each source is converted to a percentile
rank within its own distribution of pair values and the pair's compoundScore is the
mean of the available ranks.

Output per unordered spice-id pair:
  { a, b, sharedCount, sharedAromaCount, jaccard, shared: [{name, flavors}],
    flavordb2?: {score, sharedCount, sharedFlavorWords}, compoundScore,
    sources: ("foodb_usda"|"flavordb2")[] }

For FlavorDB2-only pairs (a spice with no FooDB/USDA data) the FooDB-derived fields
are zero/empty (sources lacks "foodb_usda"); consumers should read compoundScore.
"jaccard" is kept for reference. No network needed — pure local join.

Sources: FooDB (foodb.ca, via ingest_foodb.py) + USDA Dr. Duke's Phytochemical and
Ethnobotanical Databases (via usda_scraper.py) + FlavorDB2 (Garg et al. 2018,
CC BY-NC-SA 3.0, via ingest_flavordb2.py). Attribution kept in-UI.
"""

import json
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
TAXONOMY_PATH = PROJECT_ROOT / "src" / "data" / "spice-taxonomy.json"
FOODB_PATH = PROJECT_ROOT / "idea" / "foodb_spice_data.json"
USDA_PATH = PROJECT_ROOT / "idea" / "spice_data_raw.json"
OUTPUT_PATH = PROJECT_ROOT / "src" / "data" / "compound-overlap.json"
OUTPUT_COVERAGE = Path(__file__).parent / "compound_overlap_coverage.json"
FLAVORDB2_PAIRS_PATH = Path(__file__).parent / "flavordb2_pairs.json"

# The popover shows only a few shared compounds; keep the JSON light for the client
# bundle. We list aroma compounds only (the actual pairing evidence) with a couple of
# representative flavor tags. Full counts are still reported separately.
MAX_SHARED_LISTED = 8
MAX_FLAVORS_PER_COMPOUND = 3


def spice_key(name: str) -> str:
    """Loose key for matching a spice name across sources (letters only)."""
    return re.sub(r"[^a-z]", "", name.lower())


def compound_key(name: str) -> str:
    """Normalize a chemical name so the two sources' compounds line up.

    Strips leading stereochemistry/geometry prefixes like "(+)-", "(E)-", "(2R)-"
    and collapses punctuation, so "(+)-ALPHA-PHELLANDRENE" == "alpha-phellandrene".
    """
    s = name.lower().strip()
    s = re.sub(r"^\(.*?\)-?", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return s


def display_name(name: str) -> str:
    """Human-facing compound name. FooDB names are already clean; USDA names are
    ALL-CAPS, so title-case those."""
    if name.isupper():
        return name.title()
    return name


# Taxonomy spice name -> source key when loose matching isn't enough.
NAME_ALIASES = {
    "Clove": "cloves",
    "Coriander Seed": "coriander",
    "Anise Seed": "aniseseed",
    "Fennel Seed": "fennelseed",
    "Celery Seed": "celeryseed",
    "Mustard Seed": "mustardseeds",
    "Star Anise": "staranise",
    "Bay Leaf": "bayleaf",
    "Poppy Seed": "poppyseed",
    "Sesame Seed": "sesameseed",
    "Nigella Seed": "nigellaseed",
    "Rose Water": "rose",
    "Smoked Paprika": "smokedpaprika",
    "Thai Basil": "thaibasil",
    "Garlic Powder": "garlicpowder",
    "Onion Powder": "onionpowder",
    "White Pepper": "whitepepper",
    "Black Pepper": "blackpepper",
    "Sichuan Pepper": "sichuanpepper",
    "Long Pepper": "longpepper",
    "Aleppo Pepper": "aleppopepper",
    "Kaffir Lime Leaf": "kaffirlimeleaf",
    "Red Pepper Flakes": "chilipowder",
}


def load_spices():
    root = json.loads(TAXONOMY_PATH.read_text())
    spices = []

    def walk(node):
        if node.get("level") == "spice":
            spices.append({"id": node["id"], "name": node["name"]})
        for child in node.get("children", []):
            walk(child)

    walk(root)
    return spices


def build_compound_index():
    """spice_key -> { compound_key: {"name": display, "flavors": [...]} }, merged
    across both sources with FooDB flavor annotations winning."""
    foodb = json.loads(FOODB_PATH.read_text())
    usda = json.loads(USDA_PATH.read_text())

    index: dict[str, dict[str, dict]] = {}

    def add(spice_name, cname_raw, flavors):
        if not cname_raw:
            return
        key = compound_key(cname_raw)
        if not key:
            return
        sk = spice_key(spice_name)
        bucket = index.setdefault(sk, {})
        existing = bucket.get(key)
        if existing is None:
            bucket[key] = {"name": display_name(cname_raw), "flavors": list(flavors)}
        elif flavors and not existing["flavors"]:
            existing["flavors"] = list(flavors)

    for spice_name, compounds in foodb.items():
        for c in compounds:
            add(spice_name, c.get("name"), c.get("flavors") or [])

    for spice_name, data in usda.items():
        for c in data.get("compounds", []):
            add(spice_name, c.get("chemical_name"), [])

    return index


def resolve(spice, index):
    """Find a compound bucket for a taxonomy spice via alias or loose key."""
    candidates = []
    if spice["name"] in NAME_ALIASES:
        candidates.append(NAME_ALIASES[spice["name"]])
    base = spice_key(spice["name"])
    candidates += [base, base + "s", base.rstrip("s")]
    for k in candidates:
        if k in index:
            return index[k]
    return None


def percentile_ranks(values):
    """Mid-rank percentile of each value within `values` (ties averaged), in (0, 1).

    pct = (count_below + 0.5 * count_equal) / n
    """
    n = len(values)
    if n == 0:
        return []
    ordered = sorted(values)
    # first/last index of each distinct value
    first, count = {}, {}
    for i, v in enumerate(ordered):
        first.setdefault(v, i)
        count[v] = count.get(v, 0) + 1
    return [(first[v] + 0.5 * count[v]) / n for v in values]


def load_flavordb2_pairs():
    if not FLAVORDB2_PAIRS_PATH.exists():
        print(
            f"WARNING: {FLAVORDB2_PAIRS_PATH.name} not found — run ingest_flavordb2.py "
            "first. Continuing with FooDB/USDA only."
        )
        return []
    return json.loads(FLAVORDB2_PAIRS_PATH.read_text())


def compute_foodb_usda_pairs(spices, index):
    """FooDB/USDA layer: -> (pairs sorted by aroma count, covered names, missing names).

    Also used by ingest_flavordb2.py to learn which pairs already have FooDB/USDA
    evidence (a pair "has a FooDB/USDA signal" iff it appears in `pairs`).
    """
    # spice_id -> compound dict
    id_compounds: dict[str, dict[str, dict]] = {}
    covered, missing = [], []
    for sp in spices:
        bucket = resolve(sp, index)
        if bucket:
            id_compounds[sp["id"]] = bucket
            covered.append(sp["name"])
        else:
            missing.append(sp["name"])

    ids = list(id_compounds.keys())
    pairs = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            ca, cb = id_compounds[a], id_compounds[b]
            shared_keys = set(ca) & set(cb)
            if not shared_keys:
                continue
            union = len(set(ca) | set(cb))
            jaccard = round(len(shared_keys) / union, 4) if union else 0.0

            # Merge display + flavors for each shared compound; aroma first.
            shared = []
            for k in shared_keys:
                flavors = ca[k]["flavors"] or cb[k]["flavors"]
                shared.append(
                    {"name": ca[k]["name"], "flavors": flavors, "_aroma": bool(flavors)}
                )
            shared.sort(key=lambda s: (not s["_aroma"], s["name"].lower()))
            aroma_count = sum(1 for s in shared if s["_aroma"])
            listed = [
                {
                    "name": s["name"],
                    "flavors": s["flavors"][:MAX_FLAVORS_PER_COMPOUND],
                }
                for s in shared
                if s["_aroma"]
            ][:MAX_SHARED_LISTED]

            pairs.append(
                {
                    "a": a,
                    "b": b,
                    "sharedCount": len(shared_keys),
                    "sharedAromaCount": aroma_count,
                    "jaccard": jaccard,
                    "shared": listed,
                }
            )

    pairs.sort(key=lambda p: p["sharedAromaCount"], reverse=True)
    return pairs, covered, missing


def main():
    spices = load_spices()
    index = build_compound_index()

    pairs, covered, missing = compute_foodb_usda_pairs(spices, index)
    print(f"FooDB/USDA compound coverage: {len(covered)}/{len(spices)} spices")
    if missing:
        print(f"  No FooDB/USDA data for: {', '.join(missing)}")
    foodb_pair_count = len(pairs)

    # --- merge FlavorDB2 ---------------------------------------------------
    fdb2_pairs = load_flavordb2_pairs()
    fdb2_by_key = {tuple(sorted((p["a"], p["b"]))): p for p in fdb2_pairs}

    # Percentile ranks, each source within its own distribution of pair values.
    foodb_pct = percentile_ranks([p["jaccard"] for p in pairs])
    fdb2_pct_list = percentile_ranks([p["score"] for p in fdb2_pairs])
    fdb2_pct = {
        tuple(sorted((p["a"], p["b"]))): pct for p, pct in zip(fdb2_pairs, fdb2_pct_list)
    }

    def fdb2_field(src):
        return {
            "score": src["score"],
            "sharedCount": src["sharedCount"],
            "sharedFlavorWords": src["sharedFlavorWords"],
        }

    seen_keys = set()
    for p, pct in zip(pairs, foodb_pct):
        key = tuple(sorted((p["a"], p["b"])))
        seen_keys.add(key)
        ranks = [pct]
        sources = ["foodb_usda"]
        src = fdb2_by_key.get(key)
        if src is not None:
            p["flavordb2"] = fdb2_field(src)
            ranks.append(fdb2_pct[key])
            sources.append("flavordb2")
        p["compoundScore"] = round(sum(ranks) / len(ranks), 4)
        p["sources"] = sources

    fdb2_only = []
    for src in fdb2_pairs:
        key = tuple(sorted((src["a"], src["b"])))
        if key in seen_keys:
            continue
        fdb2_only.append(
            {
                "a": src["a"],
                "b": src["b"],
                "sharedCount": 0,
                "sharedAromaCount": 0,
                "jaccard": 0,
                "shared": [],
                "flavordb2": fdb2_field(src),
                "compoundScore": round(fdb2_pct[key], 4),
                "sources": ["flavordb2"],
            }
        )
    fdb2_only.sort(key=lambda p: p["compoundScore"], reverse=True)
    pairs.extend(fdb2_only)

    both = sum(1 for p in pairs if len(p["sources"]) == 2)
    print(
        f"Merged FlavorDB2: {len(fdb2_pairs)} pairs "
        f"({both} also have FooDB/USDA, {len(fdb2_only)} FlavorDB2-only)"
    )

    # Coverage now = FooDB/USDA spices + spices that only appear via FlavorDB2.
    covered_ids = {sp_id for p in pairs for sp_id in (p["a"], p["b"])}
    foodb_covered_names = set(covered)
    covered_all = [
        sp["name"]
        for sp in spices
        if sp["name"] in foodb_covered_names or sp["id"] in covered_ids
    ]
    missing_all = [sp["name"] for sp in spices if sp["name"] not in set(covered_all)]
    print(f"Combined compound coverage: {len(covered_all)}/{len(spices)} spices")
    if missing_all:
        print(f"  Still no compound data for: {', '.join(missing_all)}")

    OUTPUT_PATH.write_text(json.dumps(pairs, indent=2))
    print(f"Wrote {len(pairs)} compound-overlap pairs to {OUTPUT_PATH}")

    coverage = {
        "covered": covered_all,
        "missing": missing_all,
        "coveredCount": len(covered_all),
        "totalSpices": len(spices),
        "pairCount": len(pairs),
        "foodbUsdaCoveredCount": len(covered),
        "flavordb2OnlyCovered": [n for n in covered_all if n not in foodb_covered_names],
        "foodbUsdaPairCount": foodb_pair_count,
        "flavordb2PairCount": len(fdb2_pairs),
        "flavordb2OnlyPairCount": len(fdb2_only),
    }
    OUTPUT_COVERAGE.write_text(json.dumps(coverage, indent=2))
    print(f"Wrote coverage report to {OUTPUT_COVERAGE}")


if __name__ == "__main__":
    main()
