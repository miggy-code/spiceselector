import csv
import json
import os
import sys

# Import SPICE_MAPPING from the existing script to keep it DRY
from usda_scraper import SPICE_MAPPING

CSV_DIR = os.path.join(os.path.dirname(__file__), '..', 'foodb_2020_04_07_csv')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'idea', 'foodb_spice_data.json')

def load_flavors():
    """Load flavor dictionaries."""
    print("Loading Flavors...")
    flavor_map = {}
    flavor_csv_path = os.path.join(CSV_DIR, 'Flavor.csv')
    if not os.path.exists(flavor_csv_path):
        return flavor_map
        
    with open(flavor_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            flavor_map[row['id']] = row['name']
            
    # Load compound to flavor mappings
    print("Loading CompoundsFlavor mapping...")
    compound_flavor = {}
    comp_flavor_csv_path = os.path.join(CSV_DIR, 'CompoundsFlavor.csv')
    if not os.path.exists(comp_flavor_csv_path):
        return compound_flavor
        
    with open(comp_flavor_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            comp_id = row['compound_id']
            flav_id = row['flavor_id']
            flav_name = flavor_map.get(flav_id)
            if flav_name:
                if comp_id not in compound_flavor:
                    compound_flavor[comp_id] = []
                compound_flavor[comp_id].append(flav_name)
                
    return compound_flavor


def load_compounds(interesting_compound_ids, compound_flavor_map):
    """Load compound data for only the ones we care about."""
    print("Loading Compounds...")
    compounds = {}
    compound_csv_path = os.path.join(CSV_DIR, 'Compound.csv')
    
    with open(compound_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cid = row['id']
            if cid in interesting_compound_ids:
                compounds[cid] = {
                    "name": row['name'],
                    "description": row['description'],
                    "superklass": row.get('superklass', ''),
                    "klass": row.get('klass', ''),
                    "subklass": row.get('subklass', ''),
                    "flavors": list(set(compound_flavor_map.get(cid, [])))
                }
    return compounds

def main():
    if not os.path.exists(CSV_DIR):
        print(f"Error: {CSV_DIR} not found.")
        sys.exit(1)

    print("Step 1: Mapping Spices to FoodB Food IDs")
    # Invert SPICE_MAPPING for searching: botanical name or common name to our spice key
    search_keys = {}
    for common_name, botanical_name in SPICE_MAPPING.items():
        search_keys[botanical_name.lower()] = common_name
        search_keys[common_name.lower()] = common_name
        # Add basic name without (ground) or (dried)
        clean_name = common_name.replace("(ground)", "").replace("(dried)", "").strip().lower()
        search_keys[clean_name] = common_name

    foodb_to_spice = {}
    food_csv_path = os.path.join(CSV_DIR, 'Food.csv')
    with open(food_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fid = row['id']
            name = row.get('name', '').lower()
            sci_name = row.get('name_scientific', '').lower()
            
            # Exact matches first
            matched = False
            for target_name in [name, sci_name]:
                if target_name in search_keys:
                    foodb_to_spice[fid] = search_keys[target_name]
                    matched = True
                    break
            
            # Partial match as fallback if not exact (e.g., standardizing "black pepper")
            if not matched:
                for search_str, spice_key in search_keys.items():
                    if search_str in name or search_str in sci_name:
                        foodb_to_spice[fid] = spice_key
                        break

    print(f"Mapped {len(set(foodb_to_spice.values()))} unique spices to {len(foodb_to_spice)} Food IDs.")

    print("Step 2: Processing Content.csv (This will take a moment...)")
    spice_compounds = {spice_key: {} for spice_key in set(foodb_to_spice.values())}
    interesting_compound_ids = set()
    
    content_csv_path = os.path.join(CSV_DIR, 'Content.csv')
    
    # Increase field size limit for large CSV fields
    csv.field_size_limit(sys.maxsize)
    
    with open(content_csv_path, 'r', encoding='utf-8') as f:
        # Standardize units to mg/100g if possible? We'll just store the amount and standard unit.
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            count += 1
            if count % 1000000 == 0:
                print(f"  Processed {count/1000000}M rows...")
                
            if row['source_type'] == 'Compound' and row['food_id'] in foodb_to_spice:
                fid = row['food_id']
                spice_key = foodb_to_spice[fid]
                cid = row['source_id']
                
                try:
                    val = float(row.get('standard_content') or row.get('orig_content') or 0)
                except ValueError:
                    val = 0
                
                if val <= 0:
                    continue
                    
                interesting_compound_ids.add(cid)
                
                # Keep max value if multiple exist (scientific studies have many samples)
                if cid not in spice_compounds[spice_key]:
                    spice_compounds[spice_key][cid] = {
                        "amount": val,
                        "unit": "mg/100g" # Content.csv standard_content usually normalizes.
                    }
                else:
                    if val > spice_compounds[spice_key][cid]['amount']:
                        spice_compounds[spice_key][cid]['amount'] = val

    print(f"Found {len(interesting_compound_ids)} unique compounds across our spices.")

    compound_flavor_map = load_flavors()
    compounds_data = load_compounds(interesting_compound_ids, compound_flavor_map)

    print("Step 3: Assembling Graph Profile...")
    final_data = {}
    for spice_key, comp_dict in spice_compounds.items():
        compiled_compounds = []
        for cid, data in comp_dict.items():
            if cid in compounds_data:
                compiled_compounds.append({
                    "id": cid,
                    "name": compounds_data[cid]['name'],
                    "amount": data['amount'], # usually mg/100g
                    "unit": data['unit'],
                    "flavors": compounds_data[cid]['flavors'],
                    "class": compounds_data[cid].get('klass', '')
                })
        
        # Sort compounds by concentration amount descending
        compiled_compounds.sort(key=lambda x: x['amount'], reverse=True)
        final_data[spice_key] = compiled_compounds
        
    print(f"Saving compiled data to {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2)
        
    print("Complete!")

if __name__ == "__main__":
    main()
