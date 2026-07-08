import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re

BASE_URL = "https://phytochem.nal.usda.gov"
SEARCH_URL = f"{BASE_URL}/?type=All&keyword="

SPICE_MAPPING = {
    # Warm
    "Black pepper": "Piper nigrum",
    "Cinnamon": "Cinnamomum verum",
    "Nutmeg": "Myristica fragrans",
    "Allspice": "Pimenta dioica",
    "Mace": "Myristica fragrans",
    "Cloves": "Syzygium aromaticum",
    "Star anise": "Illicium verum",
    "Cardamom": "Elettaria cardamomum",
    "Cassia": "Cinnamomum cassia",
    # Hot & Pungent
    "White pepper": "Piper nigrum",
    "Sichuan pepper": "Zanthoxylum piperitum",
    "Long pepper": "Piper longum",
    "Cayenne": "Capsicum annuum",
    "Chipotle": "Capsicum annuum",
    "Gochugaru": "Capsicum annuum",
    "Aleppo pepper": "Capsicum annuum",
    "Mustard seeds": "Sinapis alba",
    # Sweet & Aromatic
    "Vanilla": "Vanilla planifolia",
    "Fennel seed": "Foeniculum vulgare",
    "Anise seed": "Pimpinella anisum",
    "Fenugreek": "Trigonella foenum-graecum",
    "Tonka bean": "Dipteryx odorata",
    # Earthy
    "Cumin": "Cuminum cyminum",
    "Coriander": "Coriandrum sativum",
    "Turmeric": "Curcuma longa",
    "Ginger": "Zingiber officinale",
    "Galangal": "Alpinia galanga",
    "Caraway": "Carum carvi",
    "Celery seed": "Apium graveolens",
    "Smoked paprika": "Capsicum annuum",
    "Sumac": "Rhus coriaria",
    # Herbal
    "Oregano": "Origanum vulgare",
    "Thyme": "Thymus vulgaris",
    "Rosemary": "Rosmarinus officinalis",
    "Basil": "Ocimum basilicum",
    "Bay leaf": "Laurus nobilis",
    "Sage": "Salvia officinalis",
    "Marjoram": "Origanum majorana",
    "Tarragon": "Artemisia dracunculus",
    "Dill": "Anethum graveolens",
    "Lemongrass": "Cymbopogon citratus",
    "Thai basil": "Ocimum basilicum",
    # Floral
    "Saffron": "Crocus sativus",
    "Lavender": "Lavandula angustifolia",
    "Rose": "Rosa damascena",
    "Hibiscus": "Hibiscus sabdariffa",
    "Chamomile": "Matricaria chamomilla",
    # Citrus & Bright
    "Amchur": "Mangifera indica",
    "Tamarind": "Tamarindus indica",
    # Umami & Savory
    "Garlic powder": "Allium sativum",
    "Onion powder": "Allium cepa",
    "Sesame seed": "Sesamum indicum",
    "Nigella seed": "Nigella sativa",
    "Poppy seed": "Papaver somniferum",
}

def get_soup(url):
    retries = 3
    for i in range(retries):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            print(f"Error fetching {url} (attempt {i+1}): {e}")
            time.sleep(2)
    return None

def search_spice(spice_name):
    print(f"Searching for: {spice_name}")
    botanical_name = SPICE_MAPPING.get(spice_name)
    search_term = botanical_name if botanical_name else spice_name.replace("(ground)", "").replace("(dried)", "").strip()
    
    soup = get_soup(SEARCH_URL + search_term.replace(" ", "+"))
    if not soup: return None
    
    results = soup.find_all('li')
    # Try to find 'Plant' first, then 'Ethnobotanical Plant'
    for li in results:
        text = li.get_text()
        if 'Plant' in text and not 'Ethnobotanical' in text and search_term.lower() in text.lower():
            link = li.find('a')
            if link: return BASE_URL + link['href']
            
    for li in results:
        text = li.get_text()
        if 'Ethnobotanical Plant' in text and search_term.lower() in text.lower():
            link = li.find('a')
            if link: return BASE_URL + link['href']
            
    return None

def scrape_plant_details(plant_url, spice_original_name):
    print(f"Scraping plant: {plant_url}")
    soup = get_soup(plant_url)
    if not soup: return None
    
    data = {
        "ingredient": {
            "id": plant_url.split("/")[-1],
            "original_name": spice_original_name,
            "state": "ground" if "ground" in spice_original_name.lower() else "dried" if "dried" in spice_original_name.lower() else "whole"
        },
        "compounds": []
    }
    
    title_tag = soup.find('h1')
    if title_tag:
        title = title_tag.get_text(strip=True)
        data["ingredient"]["name"] = title.replace("Plant ", "").replace("Ethnobotanical Plant ", "").split("(")[0].strip()
        data["ingredient"]["botanical_family"] = re.search(r'\((.*?)\)', title).group(1) if "(" in title else ""
    
    common_names_label = soup.find('div', string=re.compile('Common Names', re.I))
    if common_names_label:
        common_names_div = common_names_label.find_next_sibling('div')
        if common_names_div:
            data["ingredient"]["common_names"] = common_names_div.get_text(strip=True)
    
    table = soup.find('table')
    if table:
        rows = table.find_all('tr')[1:]
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 1:
                chem_link = cols[0].find('a')
                if chem_link:
                    compound = {
                        "id": chem_link['href'].split("/")[-1],
                        "chemical_name": chem_link.get_text(strip=True),
                        "url": BASE_URL + chem_link['href'],
                        "part": cols[2].get_text(strip=True) if len(cols) > 2 else "",
                        "low_ppm": cols[3].get_text(strip=True) if len(cols) > 3 else "",
                        "high_ppm": cols[4].get_text(strip=True) if len(cols) > 4 else ""
                    }
                    data["compounds"].append(compound)
    return data

def main():
    output_file = os.path.join(os.path.dirname(__file__), '..', 'idea', 'spice_data_raw.json')

    # Load existing data to avoid re-scraping
    all_data = {}
    if os.path.exists(output_file):
        with open(output_file, 'r') as f:
            all_data = json.load(f)
        print(f"Loaded {len(all_data)} existing spices from {output_file}")

    spices = list(SPICE_MAPPING.keys())
    new_count = 0

    for spice in spices:
        if spice in all_data:
            print(f"Skipping {spice} (already scraped)")
            continue

        plant_url = search_spice(spice)
        if plant_url:
            plant_data = scrape_plant_details(plant_url, spice)
            if plant_data:
                all_data[spice] = plant_data
                new_count += 1
                # Save incrementally so we don't lose progress
                with open(output_file, 'w') as f:
                    json.dump(all_data, f, indent=4)
        else:
            print(f"Could not find plant for {spice}")
        time.sleep(1)

    print(f"Scraping complete. {new_count} new spices added. Total: {len(all_data)}. Saved to {output_file}")

if __name__ == "__main__":
    main()
