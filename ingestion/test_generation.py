#!/usr/bin/env python3
"""Quick test of profile generation for a single spice."""

import os
import sys
import json

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from generate_spice_profiles import (
    load_raw_data,
    load_existing_profiles,
    format_compound_data,
    generate_profile,
    display_profile,
    SPICE_FAMILIES,
)

import google.generativeai as genai

def main():
    # Test with Cumin
    spice_name = "Cumin"
    family = SPICE_FAMILIES[spice_name]

    raw_data = load_raw_data()
    profiles = load_existing_profiles()

    raw_entry = raw_data.get(spice_name)
    if not raw_entry:
        print(f"Error: No USDA data for {spice_name}")
        sys.exit(1)

    compound_text = format_compound_data(raw_entry)

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not set")
        sys.exit(1)

    genai.configure(api_key=api_key)
    client = genai.GenerativeModel("gemini-2.0-flash")

    all_spice_names = sorted(set(
        name for name in SPICE_FAMILIES.keys()
        if not any(alt in name for alt in ['(ground)', '(dried)'])
    ))

    print(f"Generating profile for {spice_name}...\n")
    profile = generate_profile(client, spice_name, family, compound_text, all_spice_names)
    display_profile(profile)

    # Show JSON
    print("\n" + "="*60)
    print("JSON Output:")
    print("="*60)
    print(json.dumps(profile, indent=2))

if __name__ == "__main__":
    main()
