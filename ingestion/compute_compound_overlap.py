"""
Compute Jaccard compound overlap scores for all spice pairings and update Supabase.

Usage:
  python compute_compound_overlap.py

Uses local spice_data_raw.json (USDA compound data) — no network requests needed.
Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local.
"""

import json
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

try:
    from supabase import create_client
except ImportError:
    print("Install supabase: pip install supabase")
    sys.exit(1)

PROFILES_PATH = os.path.join(os.path.dirname(__file__), 'generated_profiles.json')
RAW_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'idea', 'spice_data_raw.json')


def jaccard(set_a, set_b):
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


def main():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Error: Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_KEY in .env.local")
        sys.exit(1)

    supabase = create_client(url, key)

    # Load profiles to build spice_id -> spice_name mapping
    with open(PROFILES_PATH, 'r') as f:
        profiles = json.load(f)

    id_to_name = {p["id"]: name for name, p in profiles.items()}

    # Load USDA raw data and build spice_name -> set of compound IDs
    if not os.path.exists(RAW_DATA_PATH):
        print(f"Error: {RAW_DATA_PATH} not found. Run usda_scraper.py first.")
        sys.exit(1)

    with open(RAW_DATA_PATH, 'r') as f:
        raw_data = json.load(f)

    # Build compound set per spice name
    name_to_compounds: dict[str, set] = {}
    for spice_name, raw in raw_data.items():
        compound_ids = {c["id"] for c in raw.get("compounds", []) if c.get("id")}
        if compound_ids:
            name_to_compounds[spice_name] = compound_ids

    # Build compound set per spice_id (via profile name lookup)
    id_to_compounds: dict[str, set] = {}
    for spice_id, spice_name in id_to_name.items():
        if spice_name in name_to_compounds:
            id_to_compounds[spice_id] = name_to_compounds[spice_name]

    spices_with_data = len(id_to_compounds)
    total_compounds = sum(len(s) for s in id_to_compounds.values())
    print(f"Compound data available for {spices_with_data} spices ({total_compounds} compound-spice links)")

    # Fetch all pairings from Supabase
    try:
        res = supabase.table("pairings").select("id,spice_a,spice_b").execute()
    except Exception as e:
        print(f"Error fetching pairings: {e}")
        print("  → Make sure load_to_supabase.py has been run first.")
        sys.exit(1)

    pairings = res.data
    print(f"Found {len(pairings)} pairings to score\n")

    updated = 0
    skipped = 0
    errors = []
    scores = []

    for pairing in pairings:
        spice_a = pairing["spice_a"]
        spice_b = pairing["spice_b"]
        compounds_a = id_to_compounds.get(spice_a, set())
        compounds_b = id_to_compounds.get(spice_b, set())

        if not compounds_a or not compounds_b:
            skipped += 1
            continue

        score = jaccard(compounds_a, compounds_b)
        scores.append(score)

        try:
            supabase.table("pairings").update({"compound_overlap": round(score, 4)}).eq("id", pairing["id"]).execute()
            updated += 1
        except Exception as e:
            msg = f"  ERROR updating pairing {pairing['id']}: {e}"
            print(msg)
            errors.append(msg)

    print(f"{'='*50}")
    print(f"Summary:")
    print(f"  Updated: {updated} pairings")
    print(f"  Skipped: {skipped} (missing compound data for one or both spices)")
    if scores:
        print(f"  Overlap scores — min: {min(scores):.4f}, max: {max(scores):.4f}, avg: {sum(scores)/len(scores):.4f}")
    if errors:
        print(f"\n  {len(errors)} error(s) encountered (shown above)")
    else:
        print(f"\n  No errors!")


if __name__ == "__main__":
    main()
