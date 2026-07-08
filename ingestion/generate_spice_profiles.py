"""
Interactive spice profile generator.

Takes USDA compound data for each spice and uses Gemini to generate
structured flavor profiles, cuisine associations, pairings, and substitutes.

Usage:
  python generate_spice_profiles.py [--spice "Cumin"] [--all] [--skip-existing]

Requires GOOGLE_API_KEY environment variable (loaded from .env.local).
"""

import json
import os
import sys
from pydantic import BaseModel, Field
from typing import List
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables from .env.local in the project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

RAW_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'idea', 'spice_data_raw.json')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'generated_profiles.json')

# The full spice list with family assignments
SPICE_FAMILIES = {
    "Black pepper": "hot-pungent",
    "Cinnamon": "warm",
    "Nutmeg": "warm",
    "Allspice": "warm",
    "Mace": "warm",
    "Cloves": "warm",
    "Star anise": "warm",
    "Cardamom": "warm",
    "Cassia": "warm",
    "White pepper": "hot-pungent",
    "Sichuan pepper": "hot-pungent",
    "Long pepper": "hot-pungent",
    "Cayenne": "hot-pungent",
    "Chipotle": "hot-pungent",
    "Gochugaru": "hot-pungent",
    "Aleppo pepper": "hot-pungent",
    "Mustard seeds": "hot-pungent",
    "Vanilla": "sweet",
    "Fennel seed": "sweet",
    "Anise seed": "sweet",
    "Fenugreek": "sweet",
    "Tonka bean": "sweet",
    "Cumin": "earthy",
    "Coriander": "earthy",
    "Turmeric": "earthy",
    "Ginger": "earthy",
    "Ginger (ground)": "earthy",
    "Galangal": "earthy",
    "Caraway": "earthy",
    "Celery seed": "earthy",
    "Smoked paprika": "earthy",
    "Paprika": "earthy",
    "Sumac": "earthy",
    "Oregano": "herbal",
    "Oregano (dried)": "herbal",
    "Thyme": "herbal",
    "Thyme (dried)": "herbal",
    "Rosemary": "herbal",
    "Basil": "herbal",
    "Basil (dried)": "herbal",
    "Bay leaf": "herbal",
    "Bay leaves": "herbal",
    "Sage": "herbal",
    "Marjoram": "herbal",
    "Tarragon": "herbal",
    "Dill": "herbal",
    "Lemongrass": "herbal",
    "Thai basil": "herbal",
    "Saffron": "floral",
    "Lavender": "floral",
    "Rose": "floral",
    "Hibiscus": "floral",
    "Chamomile": "floral",
    "Amchur": "citrus-bright",
    "Tamarind": "citrus-bright",
    "Garlic powder": "umami-savory",
    "Onion powder": "umami-savory",
    "Sesame seed": "umami-savory",
    "Nigella seed": "umami-savory",
    "Poppy seed": "umami-savory",
    "Chili powder": "hot-pungent",
}

SYSTEM_PROMPT = """You are a culinary scientist and spice expert. You have deep knowledge of:
- Aromatic chemistry (volatile compounds, essential oils)
- Culinary traditions across all major world cuisines
- Flavor pairing theory (food pairing hypothesis, complementary/contrasting flavors)
- Practical cooking applications

You will be given a spice name and its chemical compound data from the USDA phytochemical database.
Your job is to generate a structured profile for use in a spice pairing web application.

IMPORTANT: Be precise with numerical scores. Use the full 0-100 range meaningfully:
- 0-15: negligible/absent
- 16-35: subtle/mild
- 36-55: moderate/noticeable
- 56-75: prominent/strong
- 76-100: dominant/intense

For heat specifically: 0 = no heat at all, 100 = Carolina Reaper level.
Most spices should have heat under 20 unless they are actual chili peppers."""

USER_PROMPT_TEMPLATE = """Generate a complete profile for: {spice_name}
Flavor family: {family}

USDA Compound Data:
{compound_data}

Include 4-8 cuisines, 6-10 pairings, 3-5 substitutes, and 3-5 key compounds.
For pairings, use spice names from this list where possible: {all_spices}"""


def load_raw_data():
    if os.path.exists(RAW_DATA_PATH):
        with open(RAW_DATA_PATH, 'r') as f:
            return json.load(f)
    return {}


def load_existing_profiles():
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH, 'r') as f:
            return json.load(f)
    return {}


def save_profiles(profiles):
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(profiles, f, indent=2)


def format_compound_data(raw_entry):
    """Format USDA compound data for the LLM prompt."""
    if not raw_entry or 'compounds' not in raw_entry:
        return "No USDA compound data available."

    lines = []
    ingredient = raw_entry.get('ingredient', {})
    if ingredient.get('botanical_family'):
        lines.append(f"Botanical family: {ingredient['botanical_family']}")
    if ingredient.get('common_names'):
        lines.append(f"Common names: {ingredient['common_names']}")

    # Deduplicate and show most relevant compounds
    seen = set()
    compounds = []
    for c in raw_entry['compounds']:
        key = c['chemical_name']
        if key not in seen:
            seen.add(key)
            ppm = ""
            if c.get('high_ppm') and c['high_ppm'] != 'not available':
                ppm = f" ({c.get('low_ppm', '?')}-{c['high_ppm']} ppm)"
            compounds.append(f"  - {c['chemical_name']} [{c.get('part', '')}]{ppm}")

    if compounds:
        lines.append(f"Key compounds ({len(compounds)} unique):")
        lines.extend(compounds[:20])  # Cap at 20 for prompt length
        if len(compounds) > 20:
            lines.append(f"  ... and {len(compounds) - 20} more")

    return "\n".join(lines) if lines else "No USDA compound data available."


class CuisineFrequency(BaseModel):
    cuisine: str
    frequency: str = Field(description="common, occasional, or rare")
    typical_quantity: str = Field(description="e.g. 1 tsp per 4 servings")

class Pairing(BaseModel):
    spice: str
    affinity: str = Field(description="classic, complementary, or surprising")
    note: str = Field(description="why they work together")
    cuisines: list[str]

class Substitute(BaseModel):
    spice: str
    similarity: float = Field(description="0.0 to 1.0 score")
    notes: str = Field(description="how it differs")

class KeyCompound(BaseModel):
    name: str = Field(description="compound name")
    role: str = Field(description="what flavor/aroma it contributes")

class SpiceProfileSchema(BaseModel):
    id: str = Field(description="kebab-case-slug")
    name: str
    botanical_name: str = Field(description="Latin binomial")
    botanical_family: str = Field(description="family name")
    common_names: list[str]
    origin: str = Field(description="primary region/country")
    description: str = Field(description="1-2 sentence flavor description for a chef")
    warmth: int = Field(ge=0, le=100)
    brightness: int = Field(ge=0, le=100)
    earthiness: int = Field(ge=0, le=100)
    florality: int = Field(ge=0, le=100)
    heat: int = Field(ge=0, le=100)
    family: str
    subfamilies: list[str]
    heat_level: str = Field(description="mild, medium, hot, or extreme")
    intensity: int = Field(description="0-100, how potent/assertive")
    commonality: int = Field(description="0-100, how widely used globally")
    cuisines: list[CuisineFrequency]
    top_pairings: list[Pairing]
    substitutes: list[Substitute]
    key_compounds: list[KeyCompound]


def generate_profile(client, spice_name, family, compound_data, all_spices):
    """Call Gemini to generate a spice profile."""
    prompt = USER_PROMPT_TEMPLATE.format(
        spice_name=spice_name,
        family=family,
        compound_data=compound_data,
        all_spices=", ".join(all_spices),
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
            response_mime_type="application/json",
            response_schema=SpiceProfileSchema,
        ),
    )

    raw_text = response.text.strip()
    
    try:
        profile = json.loads(raw_text)
        return profile
    except json.JSONDecodeError as e:
        print(f"\n  Error: Failed to parse JSON from AI.")
        print(f"  Reason: {e}")
        print("-" * 40)
        print("  RAW TEXT:")
        print(raw_text)
        print("-" * 40)
        raise e


def display_profile(profile):
    """Pretty-print a profile for review."""
    print("\n" + "=" * 60)
    print(f"  {profile.get('name', 'Unknown')}  ({profile.get('botanical_name', '?')})")
    print(f"  {profile.get('description', '')}")
    print("=" * 60)
    print(f"  Family: {profile.get('family', '?')} | Subfamilies: {', '.join(profile.get('subfamilies', []))}")
    print(f"  Origin: {profile.get('origin', '?')}")
    print()
    print("  Flavor Profile:")
    for axis in ['warmth', 'brightness', 'earthiness', 'florality', 'heat']:
        val = profile.get(axis, 0)
        bar = "#" * (int(val) // 5) if isinstance(val, (int, float)) else "???"
        bar = bar + "." * (20 - len(bar))
        print(f"    {axis:12s} [{bar}] {val}")
    print(f"    {'intensity':12s} {profile.get('intensity', '?')}/100")
    print(f"    {'commonality':12s} {profile.get('commonality', '?')}/100")
    print()
    print("  Top Pairings:")
    for p in profile.get('top_pairings', [])[:8]:
        cuisines = ", ".join(p.get('cuisines', []))
        print(f"    - {p.get('spice', 'Unknown'):20s} ({p.get('affinity', '?')}) {p.get('note', '')}  [{cuisines}]")
    print()
    print("  Cuisines:")
    for c in profile.get('cuisines', [])[:6]:
        print(f"    - {c.get('cuisine', 'Unknown'):20s} ({c.get('frequency', '?')}) {c.get('typical_quantity', '')}")
    print()
    print("  Substitutes:")
    for s in profile.get('substitutes', [])[:5]:
        print(f"    - {s.get('spice', 'Unknown'):20s} (sim: {s.get('similarity', 0)}) {s.get('notes', '')}")
    print()
    print("  Key Compounds:")
    for c in profile.get('key_compounds', [])[:5]:
        print(f"    - {c.get('name', 'Unknown'):25s} → {c.get('role', '')}")
    print()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate spice profiles using Gemini")
    parser.add_argument("--spice", type=str, help="Generate for a single spice")
    parser.add_argument("--all", action="store_true", help="Generate for all spices")
    parser.add_argument("--skip-existing", action="store_true", help="Skip spices that already have profiles")
    parser.add_argument("--list", action="store_true", help="List all spices and their status")
    args = parser.parse_args()

    raw_data = load_raw_data()
    profiles = load_existing_profiles()

    all_spice_names = sorted(set(
        name for name in SPICE_FAMILIES.keys()
        if not any(alt in name for alt in ['(ground)', '(dried)'])
    ))

    if args.list:
        print(f"\nSpice Status ({len(all_spice_names)} total):\n")
        for name in all_spice_names:
            has_usda = "USDA" if name in raw_data else "    "
            has_profile = "DONE" if name in profiles else "    "
            family = SPICE_FAMILIES.get(name, "?")
            print(f"  [{has_usda}] [{has_profile}] {name:25s} ({family})")
        print(f"\n  USDA data: {sum(1 for n in all_spice_names if n in raw_data)}/{len(all_spice_names)}")
        print(f"  Profiles:  {sum(1 for n in all_spice_names if n in profiles)}/{len(all_spice_names)}")
        return

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable not set in .env.local")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    spices_to_process = []
    if args.spice:
        spices_to_process = [args.spice]
    elif args.all:
        spices_to_process = all_spice_names
    else:
        print("Usage: python generate_spice_profiles.py --spice 'Cumin' | --all | --list")
        sys.exit(0)

    for spice_name in spices_to_process:
        if args.skip_existing and spice_name in profiles:
            print(f"Skipping {spice_name} (already has profile)")
            continue

        family = SPICE_FAMILIES.get(spice_name, "earthy")

        # Find matching raw data (try exact match, then variations)
        raw_entry = raw_data.get(spice_name)
        if not raw_entry:
            for variant in [f"{spice_name} (ground)", f"{spice_name} (dried)", f"{spice_name}s"]:
                raw_entry = raw_data.get(variant)
                if raw_entry:
                    break

        compound_text = format_compound_data(raw_entry)

        print(f"\nGenerating profile for: {spice_name}...")
        try:
            profile = generate_profile(client, spice_name, family, compound_text, all_spice_names)
            display_profile(profile)

            # Batch Processing Flow
            # Accept automatically instead of waiting for user input
            profiles[spice_name] = profile
            save_profiles(profiles)
            print(f"  [AUTO] Saved {spice_name}. ({len(profiles)} total)")

        except json.JSONDecodeError:
            # Error already printed in generate_profile
            print("  Skipping this spice due to JSON error.")
        except Exception as e:
            print(f"  Error generating profile: {e}")
            import traceback
            traceback.print_exc()
            print("  Skipping this spice.")


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
