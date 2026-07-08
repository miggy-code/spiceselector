# Data Ingestion Pipeline

Two-step process to generate spice data and profiles.

## Step 1: Scrape USDA Phytochemical Data

```bash
python3 usda_scraper.py
```

- Scrapes USDA phytochemical database for 55+ spices
- Fetches chemical compound data (volatiles, essential oils)
- Appends to existing data in `../idea/spice_data_raw.json`
- **Time:** ~2-3 minutes (1-sec delay between requests to be respectful)

## Step 2: Generate Spice Profiles with Gemini

```bash
# Test with one spice first
GOOGLE_API_KEY=AIza... python3 generate_spice_profiles.py --spice "Cumin"

# Generate all spices interactively
GOOGLE_API_KEY=AIza... python3 generate_spice_profiles.py --all

# List status of all spices
GOOGLE_API_KEY=AIza... python3 generate_spice_profiles.py --list
```

- Takes USDA compound data as input
- Generates structured JSON: flavor profiles (5-axis), cuisines, pairings, substitutes
- Interactive review: accept / regenerate / skip for each spice
- Outputs to `generated_profiles.json`
- **Cost:** Free tier available for Gemini 2.0 Flash

## Outputs

- `../idea/spice_data_raw.json` — Raw USDA compound data (auto-generated)
- `generated_profiles.json` — LLM-generated spice profiles (you approve)

## Notes

- All scripts are idempotent (safe to re-run)
- Scraper won't re-fetch spices already in raw JSON
- Profile generator won't overwrite existing profiles
