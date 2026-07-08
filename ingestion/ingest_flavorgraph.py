"""
FlavorGraph spice pairing ingestion script.

Fetches FlavorGraph embeddings and node data, matches project spices to FlavorGraph nodes,
and computes pairwise cosine similarity scores.

Source: FlavorGraph (Park et al. 2021, Scientific Reports)
License: Apache 2.0
"""

import json
import csv
import pickle
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("ERROR: numpy not installed. Install with: pip install numpy")
    sys.exit(1)


# Paths
PROJECT_ROOT = Path(__file__).parent.parent
INGESTION_DIR = Path(__file__).parent
DATA_DIR = INGESTION_DIR / "flavorgraph_data"
TAXONOMY_PATH = PROJECT_ROOT / "src" / "data" / "spice-taxonomy.json"
OUTPUT_PAIRINGS = PROJECT_ROOT / "src" / "data" / "pairing-scores.json"
OUTPUT_COVERAGE = INGESTION_DIR / "flavorgraph_coverage.json"

# FlavorGraph URLs
NODES_CSV_URL = "https://raw.githubusercontent.com/lamypark/FlavorGraph/master/input/nodes_191120.csv"
EMBEDDINGS_URL = "https://raw.githubusercontent.com/lamypark/FlavorGraph/master/output/kitchenette_embeddings.pkl"

NODES_CSV_PATH = DATA_DIR / "nodes_191120.csv"
EMBEDDINGS_PATH = DATA_DIR / "kitchenette_embeddings.pkl"


def download_file(url, dest_path):
    """Download a file with error handling."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    if dest_path.exists():
        print(f"[SKIP] {dest_path.name} already exists")
        return True

    print(f"[DOWNLOAD] {url}")
    try:
        urllib.request.urlretrieve(url, dest_path)
        print(f"[SUCCESS] Downloaded to {dest_path}")
        return True
    except urllib.error.URLError as e:
        print(f"[ERROR] Failed to download {url}: {e}")
        return False


def load_spices_from_taxonomy(taxonomy_path):
    """Recursively walk taxonomy and collect all spices (level == 'spice')."""
    with open(taxonomy_path, "r") as f:
        root = json.load(f)

    spices = []

    def walk(node):
        if node.get("level") == "spice":
            spices.append({
                "id": node["id"],
                "name": node["name"],
                "description": node.get("description", "")
            })
        for child in node.get("children", []):
            walk(child)

    walk(root)
    return spices


def load_nodes_csv(csv_path):
    """Load FlavorGraph nodes CSV and inspect structure."""
    print(f"\n[INSPECT] FlavorGraph nodes CSV: {csv_path}")
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        print(f"  Header: {header}")

        # Read first few rows
        rows = []
        for i, row in enumerate(reader):
            if i < 3:
                rows.append(row)
                print(f"  Row {i}: {row}")
            else:
                break

        # Build name -> node_index mapping (assumes 'name' and some index column exist)
        # Re-read to build full mapping
        f.seek(0)
        reader = csv.DictReader(f)
        node_map = {}
        for row in reader:
            name = row.get("name", "").strip().lower()
            if name:
                # FlavorGraph stores index or id; try to find it
                node_id = row.get("id") or row.get("node_id") or row.get("index")
                node_map[name] = {
                    "id": node_id,
                    "type": row.get("type", row.get("node_type", "unknown")),
                    "raw": row
                }

    print(f"  Loaded {len(node_map)} nodes")
    return node_map, header


def load_embeddings(pkl_path):
    """Load embeddings pickle and inspect structure."""
    print(f"\n[INSPECT] FlavorGraph embeddings: {pkl_path}")
    with open(pkl_path, "rb") as f:
        data = pickle.load(f)

    print(f"  Type: {type(data)}")
    if isinstance(data, dict):
        print(f"  Dict keys: {list(data.keys())[:5]}...")
        for key in list(data.keys())[:2]:
            val = data[key]
            print(f"    {key}: {type(val)} {getattr(val, 'shape', 'N/A')}")
    elif isinstance(data, (list, tuple)):
        print(f"  Length: {len(data)}")
        if len(data) > 0:
            print(f"  First element: {type(data[0])} {getattr(data[0], 'shape', 'N/A')}")
    elif isinstance(data, np.ndarray):
        print(f"  Array shape: {data.shape}")
        print(f"  Array dtype: {data.dtype}")

    return data


def normalize_spice_name(name):
    """Normalize a spice name to match FlavorGraph format."""
    # FlavorGraph names: lowercase, underscores instead of spaces/hyphens
    normalized = name.strip().lower().replace(" ", "_").replace("-", "_")
    return normalized


# Hand-verified node names for spices whose auto-normalized name has no embedding
# vector in the kitchenette embeddings (which use plural, recipe-style keys).
# Candidates are tried in order; first one with an embedding wins.
NAME_OVERRIDES = {
    "Chipotle": ["chipotle_pepper", "chipotle_chiles"],
    "Mustard Seed": ["yellow_mustard_seeds", "black_mustard_seeds"],
    "Fenugreek": ["fenugreek_leaves"],
    "Kaffir Lime Leaf": ["kaffir_lime_leaves"],
    "Amchur": ["amchur", "mango_powder"],
    "Dried Lime": ["dried_limes"],
    "Dried Mushroom": ["dried_mushrooms"],
    "Sesame Seed": ["sesame", "toasted_sesame_seeds"],
    "Nigella Seed": ["nigella_seeds"],
    "Tamarind": ["tamarind_paste", "tamarind_pulp"],
    "Red Pepper Flakes": ["red_pepper_flakes"],
    "Gochugaru": ["red_pepper_powder"],
    "Elderflower": ["elderflower_liqueur"],
    "Black Garlic": ["garlic"],
}

# Matches that stand in for a related-but-not-identical ingredient. Recorded in
# the coverage report so downstream UI can qualify the evidence.
APPROXIMATE_MATCHES = {
    ("Fenugreek", "fenugreek_leaves"),
    ("Gochugaru", "red_pepper_powder"),
    ("Elderflower", "elderflower_liqueur"),
    ("Black Garlic", "garlic"),
    ("Tamarind", "tamarind_paste"),
    ("Tamarind", "tamarind_pulp"),
}


def generate_name_variants(normalized):
    """Generate plausible FlavorGraph key variants for a normalized spice name."""
    variants = [normalized]
    # Plurals (kitchenette embedding keys are usually plural)
    variants.append(normalized + "s")
    variants.append(normalized + "es")
    if normalized.endswith("_seed"):
        variants.append(normalized + "s")
    else:
        variants.append(normalized + "_seed")
        variants.append(normalized + "_seeds")
    variants.append("dried_" + normalized)
    variants.append("ground_" + normalized)
    variants.append(normalized + "_powder")
    # De-duplicate preserving order
    seen = set()
    return [v for v in variants if not (v in seen or seen.add(v))]


def match_spices_to_flavorgraph(spices, node_map, embeddings_data):
    """Match project spices to FlavorGraph nodes that have an embedding vector.

    A match is only accepted if the candidate name has an embedding — a node-CSV
    name without a vector is useless for scoring and previously caused silent
    coverage loss.
    """
    matched = []
    unmatched = []

    def has_embedding(key):
        return get_embedding_vector(embeddings_data, key) is not None

    print(f"\n[MATCH] Matching {len(spices)} spices to FlavorGraph nodes (embedding required)")

    for spice in spices:
        name = spice["name"]
        normalized = normalize_spice_name(name)

        candidates = NAME_OVERRIDES.get(name, []) + generate_name_variants(normalized)

        fg_name = next((c for c in candidates if has_embedding(c)), None)
        if fg_name is not None:
            approximate = (name, fg_name) in APPROXIMATE_MATCHES
            matched.append({
                "spice_id": spice["id"],
                "spice_name": name,
                "fg_name": fg_name,
                "fg_data": node_map.get(fg_name),
                "approximate": approximate,
            })
            tag = "APPROX" if approximate else "MATCH"
            print(f"  [{tag}] {name:25} -> {fg_name}")
        else:
            unmatched.append({"spice_id": spice["id"], "spice_name": name})
            print(f"  [MISS] {name}")

    return matched, unmatched


def get_embedding_vector(embeddings_data, node_id):
    """Extract embedding vector for a node from the loaded embeddings."""
    if isinstance(embeddings_data, dict):
        if node_id in embeddings_data:
            return embeddings_data[node_id]
    elif isinstance(embeddings_data, (list, np.ndarray)):
        try:
            idx = int(node_id)
            return embeddings_data[idx]
        except (ValueError, IndexError, TypeError):
            pass
    return None


def compute_pairwise_scores(matched, embeddings_data):
    """Compute cosine similarity for all pairs of matched spices."""
    print(f"\n[COMPUTE] Computing pairwise scores for {len(matched)} matched spices")

    pairs = []

    # Build a list of matched spices with their embeddings
    spices_with_embeddings = []
    for m in matched:
        # Use FlavorGraph node NAME (not node_id) to look up embeddings
        fg_name = m["fg_name"]
        emb = get_embedding_vector(embeddings_data, fg_name)

        if emb is None:
            print(f"  [WARN] No embedding found for {m['spice_name']} (fg_name={fg_name})")
            continue

        emb_array = np.array(emb, dtype=np.float32)
        if len(emb_array.shape) != 1:
            print(f"  [WARN] Embedding for {m['spice_name']} has unexpected shape {emb_array.shape}")
            continue

        spices_with_embeddings.append({
            "spice_id": m["spice_id"],
            "spice_name": m["spice_name"],
            "embedding": emb_array
        })

    print(f"  {len(spices_with_embeddings)} spices have embeddings")

    # Compute all pairs
    for i in range(len(spices_with_embeddings)):
        for j in range(i + 1, len(spices_with_embeddings)):
            s1 = spices_with_embeddings[i]
            s2 = spices_with_embeddings[j]

            # Cosine similarity
            emb1 = s1["embedding"]
            emb2 = s2["embedding"]

            cos_sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2) + 1e-9)

            # Normalize to 0..1: (cos_sim + 1) / 2
            score = (cos_sim + 1.0) / 2.0
            score = float(score)

            pairs.append({
                "a": s1["spice_id"],
                "b": s2["spice_id"],
                "score": round(score, 4)
            })

    print(f"  Computed {len(pairs)} pairs")
    return pairs


def write_outputs(pairs, matched, unmatched):
    """Write output JSON files."""
    # Pairing scores
    print(f"\n[WRITE] {OUTPUT_PAIRINGS}")
    OUTPUT_PAIRINGS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PAIRINGS, "w") as f:
        json.dump(pairs, f, indent=2)
    print(f"  Wrote {len(pairs)} pairs")

    # Coverage report
    coverage = {
        "matched": [
            {
                "spiceId": m["spice_id"],
                "spiceName": m["spice_name"],
                "flavorGraphNode": m["fg_name"],
                "approximate": m["approximate"]
            }
            for m in matched
        ],
        "unmatched": [
            {
                "spiceId": u["spice_id"],
                "spiceName": u["spice_name"]
            }
            for u in unmatched
        ],
        "matchedCount": len(matched),
        "totalSpices": len(matched) + len(unmatched)
    }

    print(f"\n[WRITE] {OUTPUT_COVERAGE}")
    with open(OUTPUT_COVERAGE, "w") as f:
        json.dump(coverage, f, indent=2)
    print(f"  Matched: {len(matched)}")
    print(f"  Unmatched: {len(unmatched)}")

    return coverage


def main():
    """Main ingestion pipeline."""
    print("=" * 70)
    print("FlavorGraph Spice Pairing Ingestion")
    print("=" * 70)

    # Step 1: Download data
    print("\n[STEP 1] Downloading FlavorGraph data")
    if not download_file(NODES_CSV_URL, NODES_CSV_PATH):
        sys.exit(1)
    if not download_file(EMBEDDINGS_URL, EMBEDDINGS_PATH):
        sys.exit(1)

    # Step 2: Load spice taxonomy
    print("\n[STEP 2] Loading project spice taxonomy")
    try:
        spices = load_spices_from_taxonomy(TAXONOMY_PATH)
        print(f"  Loaded {len(spices)} spices")
        for s in spices[:3]:
            print(f"    - {s['id']}: {s['name']}")
    except Exception as e:
        print(f"[ERROR] Failed to load taxonomy: {e}")
        sys.exit(1)

    # Step 3: Load and inspect nodes CSV
    print("\n[STEP 3] Loading FlavorGraph nodes CSV")
    try:
        node_map, header = load_nodes_csv(NODES_CSV_PATH)
    except Exception as e:
        print(f"[ERROR] Failed to load nodes CSV: {e}")
        sys.exit(1)

    # Step 4: Load and inspect embeddings
    print("\n[STEP 4] Loading FlavorGraph embeddings")
    try:
        embeddings_data = load_embeddings(EMBEDDINGS_PATH)
    except Exception as e:
        print(f"[ERROR] Failed to load embeddings: {e}")
        sys.exit(1)

    # Step 5: Match spices
    print("\n[STEP 5] Matching spices to FlavorGraph nodes")
    try:
        matched, unmatched = match_spices_to_flavorgraph(spices, node_map, embeddings_data)
    except Exception as e:
        print(f"[ERROR] Failed to match spices: {e}")
        sys.exit(1)

    # Step 6: Compute scores
    print("\n[STEP 6] Computing pairwise cosine similarity scores")
    try:
        pairs = compute_pairwise_scores(matched, embeddings_data)
    except Exception as e:
        print(f"[ERROR] Failed to compute scores: {e}")
        sys.exit(1)

    # Step 7: Write outputs
    print("\n[STEP 7] Writing output files")
    try:
        coverage = write_outputs(pairs, matched, unmatched)
    except Exception as e:
        print(f"[ERROR] Failed to write outputs: {e}")
        sys.exit(1)

    # Summary
    print("\n" + "=" * 70)
    print(f"SUCCESS: Matched {coverage['matchedCount']} / {coverage['totalSpices']} spices")
    print(f"Wrote {len(pairs)} pairings to {OUTPUT_PAIRINGS}")
    print(f"Wrote coverage report to {OUTPUT_COVERAGE}")
    print("=" * 70)


if __name__ == "__main__":
    main()
