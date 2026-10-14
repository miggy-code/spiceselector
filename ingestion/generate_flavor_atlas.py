"""Generate stable PCA atlas positions from all five flavor axes.

Run from any directory: python3 ingestion/generate_flavor_atlas.py
The committed output is used by the app; browsers never fit a projection.
"""

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
AXES = ["warmth", "brightness", "earthiness", "florality", "heat"]


def main():
    profiles = list(json.loads((ROOT / "ingestion/generated_profiles.json").read_text()).values())
    usable = [p for p in profiles if all(isinstance(p.get(a), (int, float)) and np.isfinite(p[a]) for a in AXES)]
    if len(usable) < 2:
        raise ValueError("Atlas needs at least two complete flavor profiles")
    values = np.array([[p[a] for a in AXES] for p in usable], dtype=float)
    centered = values - values.mean(axis=0)
    _, singular_values, components = np.linalg.svd(centered, full_matrices=False)
    # Fix each component's sign so repeat runs cannot arbitrarily mirror the atlas.
    for component in components:
        if component[np.argmax(np.abs(component))] < 0:
            component *= -1
    points = centered @ components[:2].T
    total_variance = float(np.sum(singular_values ** 2))
    output = {
        "method": "PCA on five raw 0–100 flavor axes",
        "axes": AXES,
        "explainedVariance": round(float(np.sum(singular_values[:2] ** 2)) / total_variance, 4) if total_variance else 0,
        "points": {p["id"]: {"x": round(float(c[0]), 5), "y": round(float(c[1]), 5)} for p, c in zip(usable, points)},
    }
    path = ROOT / "src/data/flavor-atlas.json"
    path.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {len(usable)} atlas points to {path}")
    if len(usable) != len(profiles):
        print(f"Skipped {len(profiles) - len(usable)} incomplete profiles")


if __name__ == "__main__":
    main()
