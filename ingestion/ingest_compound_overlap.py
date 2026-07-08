"""
Compound-overlap ingestion (Ahn/USDA layer).

Computes the shared flavor-compound overlap between every pair of project spices
and writes it to src/data/compound-overlap.json for the pairing engine + "why" popover.

Two local compound sources are merged, keyed by *normalized chemical name* (their
raw id spaces differ and are not comparable):
  - idea/foodb_spice_data.json  — FooDB-derived, carries flavor annotations.
  - idea/spice_data_raw.json     — USDA phytochemical scrape, broader spice coverage,
                                    no flavor annotations.

Output per unordered spice-id pair:
  { a, b, sharedCount, sharedAromaCount, jaccard, shared: [{name, flavors}] }

"jaccard" also seeds a fallback pairing score for the spices FlavorGraph can't embed
(see PLAN.md Step 4). No network or Supabase needed — pure local join.

Source: Ahn et al. 2011 (CC BY) + USDA phytochemical DB. Attribution kept in-UI.
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


def main():
    spices = load_spices()
    index = build_compound_index()

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

    print(f"Compound coverage: {len(covered)}/{len(spices)} spices")
    if missing:
        print(f"  No compound data for: {', '.join(missing)}")

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
    OUTPUT_PATH.write_text(json.dumps(pairs, indent=2))
    print(f"Wrote {len(pairs)} compound-overlap pairs to {OUTPUT_PATH}")

    coverage = {
        "covered": covered,
        "missing": missing,
        "coveredCount": len(covered),
        "totalSpices": len(spices),
        "pairCount": len(pairs),
    }
    OUTPUT_COVERAGE.write_text(json.dumps(coverage, indent=2))
    print(f"Wrote coverage report to {OUTPUT_COVERAGE}")


if __name__ == "__main__":
    main()
