"""
Dish-anchoring ingestion: score every matched spice against common base
ingredients ("what goes on salmon?") using FlavorGraph embeddings.

Reuses the spice->FlavorGraph node matching already verified by
ingest_flavorgraph.py (via flavorgraph_coverage.json), so run that first.

Source: FlavorGraph (Park et al. 2021, Scientific Reports), Apache 2.0.
"""

import json
import pickle
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("ERROR: numpy not installed. Install with: pip install numpy")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).parent.parent
INGESTION_DIR = Path(__file__).parent
EMBEDDINGS_PATH = INGESTION_DIR / "flavorgraph_data" / "kitchenette_embeddings.pkl"
COVERAGE_PATH = INGESTION_DIR / "flavorgraph_coverage.json"
OUTPUT_PATH = PROJECT_ROOT / "src" / "data" / "dish-affinities.json"

# (id, display name, category, candidate embedding keys - first hit wins)
DISHES = [
    ("chicken", "Chicken", "protein", ["chicken"]),
    ("beef", "Beef", "protein", ["beef", "ground_beef"]),
    ("pork", "Pork", "protein", ["pork", "pork_chops"]),
    ("lamb", "Lamb", "protein", ["lamb"]),
    ("duck", "Duck", "protein", ["duck", "duck_breasts"]),
    ("turkey", "Turkey", "protein", ["turkey"]),
    ("salmon", "Salmon", "protein", ["salmon"]),
    ("white-fish", "White fish", "protein", ["cod"]),
    ("shrimp", "Shrimp", "protein", ["shrimp"]),
    ("tofu", "Tofu", "protein", ["tofu"]),
    ("eggs", "Eggs", "protein", ["egg"]),
    ("potato", "Potatoes", "vegetable", ["potato"]),
    ("sweet-potato", "Sweet potatoes", "vegetable", ["sweet_potatoes"]),
    ("tomato", "Tomatoes", "vegetable", ["tomato"]),
    ("carrot", "Carrots", "vegetable", ["carrot"]),
    ("cauliflower", "Cauliflower", "vegetable", ["cauliflower"]),
    ("mushroom", "Mushrooms", "vegetable", ["mushroom", "wild_mushrooms"]),
    ("spinach", "Spinach", "vegetable", ["spinach"]),
    ("cabbage", "Cabbage", "vegetable", ["cabbage"]),
    ("eggplant", "Eggplant", "vegetable", ["eggplant"]),
    ("zucchini", "Zucchini", "vegetable", ["zucchini"]),
    ("squash", "Butternut squash", "vegetable", ["butternut_squash", "pumpkin"]),
    ("corn", "Corn", "vegetable", ["corn"]),
    ("rice", "Rice", "grain", ["rice"]),
    ("pasta", "Pasta", "grain", ["pasta"]),
    ("bread", "Bread", "grain", ["bread"]),
    ("lentils", "Lentils", "grain", ["lentil", "red_lentils"]),
    ("chickpeas", "Chickpeas", "grain", ["chickpea", "garbanzo_beans"]),
    ("apple", "Apples", "fruit & sweet", ["apple"]),
    ("orange", "Oranges", "fruit & sweet", ["orange"]),
    ("peach", "Peaches", "fruit & sweet", ["peach"]),
    ("strawberry", "Strawberries", "fruit & sweet", ["strawberry"]),
    ("chocolate", "Chocolate", "fruit & sweet", ["chocolate", "dark_chocolate"]),
    ("coffee", "Coffee", "fruit & sweet", ["coffee"]),
    ("honey", "Honey", "fruit & sweet", ["honey"]),
    ("yogurt", "Yogurt", "dairy", ["yogurt", "greek_yogurt"]),
    ("cheese", "Cheese", "dairy", ["cheese", "goat_cheese"]),
    ("cream", "Cream", "dairy", ["cream"]),
]


def cosine01(a, b):
    """Cosine similarity normalized to 0..1, same convention as pairing-scores."""
    sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)
    return float((sim + 1.0) / 2.0)


def main():
    with open(EMBEDDINGS_PATH, "rb") as f:
        embeddings = pickle.load(f)
    with open(COVERAGE_PATH) as f:
        coverage = json.load(f)

    spice_vecs = {}
    for m in coverage["matched"]:
        vec = embeddings.get(m["flavorGraphNode"])
        if vec is not None:
            spice_vecs[m["spiceId"]] = np.array(vec, dtype=np.float32)
    print(f"[LOAD] {len(spice_vecs)} spices with embeddings")

    dishes = []
    for dish_id, name, category, candidates in DISHES:
        fg_node = next((c for c in candidates if c in embeddings), None)
        if fg_node is None:
            print(f"[MISS] {name}: none of {candidates} in embeddings")
            continue
        dish_vec = np.array(embeddings[fg_node], dtype=np.float32)
        scores = {
            spice_id: round(cosine01(dish_vec, vec), 4)
            for spice_id, vec in spice_vecs.items()
        }
        dishes.append({
            "id": dish_id,
            "name": name,
            "category": category,
            "fgNode": fg_node,
            "scores": scores,
        })
        top = sorted(scores.items(), key=lambda kv: -kv[1])[:3]
        top_str = ", ".join(f"{sid.split('.')[-1]} {s:.2f}" for sid, s in top)
        print(f"[OK]   {name:18} ({fg_node}) top: {top_str}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(dishes, f, indent=2)
    print(f"\n[WRITE] {OUTPUT_PATH} — {len(dishes)} dishes × {len(spice_vecs)} spices")


if __name__ == "__main__":
    main()
