"""CulinaryDB empirical cuisine frequencies, CC BY-NC-SA 3.0.
Run --download once (network); subsequent runs use local CSV cache.
Only explicit ingredient identities; no decomposition of compound ingredients.
"""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from ingest_compound_overlap import load_spices
ROOT=Path(__file__).resolve().parent.parent
CACHE=Path(__file__).parent/'culinarydb_cache'
URL='https://cosylab.iiitd.edu.in/culinarydb/static/data/CulinaryDB.zip'
# Ambiguous plant/part or processed forms are approximate; no generic chili stand-ins.
MAPPING={
 'Mint':(262,'approx'),  # Generic mint; entity 266 specifically aliases spearmint oil.
 'Curry Leaf':(385,'exact'),'Asafoetida':(376,'exact'),'Ajwain':(381,'exact'),
 'Epazote':(708,'exact'),'Savory':(444,'exact'),
 'Cinnamon':(330,'exact'),'Nutmeg':(336,'exact'),'Allspice':(375,'exact'),
 'Mace':(334,'exact'),'Clove':(331,'exact'),'Star Anise':(325,'exact'),
 'Cardamom':(327,'exact'),'Cassia':(328,'exact'),'Black Pepper':(339,'approx'),
 'White Pepper':(399,'exact'),'Cayenne':(992,'exact'),'Vanilla':(245,'exact'),
 'Anise Seed':(323,'approx'),'Fennel Seed':(257,'approx'),'Fenugreek':(258,'approx'),
 'Turmeric':(341,'exact'),'Ginger':(333,'exact'),'Cumin':(332,'exact'),
 'Caraway':(326,'exact'),'Celery Seed':(329,'approx'),'Coriander Seed':(254,'approx'),
 'Oregano':(337,'exact'),'Thyme':(269,'exact'),'Rosemary':(264,'exact'),
 'Marjoram':(335,'exact'),'Sage':(265,'exact'),'Basil':(250,'exact'),
 'Parsley':(338,'exact'),'Dill':(256,'exact'),'Tarragon':(268,'exact'),
 'Saffron':(340,'exact'),'Poppy Seed':(395,'exact'),'Hibiscus':(623,'exact'),
}
def rows(name):
 with (CACHE/name).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');args=parser.parse_args()
 if args.download:
  payload=urllib.request.urlopen(URL,timeout=90).read();CACHE.mkdir(exist_ok=True)
  with zipfile.ZipFile(io.BytesIO(payload)) as z:
   for n in z.namelist():
    if n.endswith('.csv'):(CACHE/Path(n).name).write_bytes(z.read(n))
 recipes={r['Recipe ID']:r['Cuisine'].strip() for r in rows('01_Recipe_Details.csv')}
 totals=Counter(recipes.values());members=defaultdict(set)
 for r in rows('04_Recipe-Ingredients_Aliases.csv'):
  if r['Recipe ID'] in recipes:members[r['Entity ID'].strip()].add(r['Recipe ID'])
 entities={int(r['Entity ID']):r['Aliased Ingredient Name'] for r in rows('02_Ingredients.csv')}
 result={}
 for sp in load_spices():
  mapped=MAPPING.get(sp['name'])
  if not mapped:
   result[sp['id']]={'name':sp['name'],'sourceQuality':'none','missing':True,'cuisines':[]};continue
  eid,q=mapped;assert eid in entities
  counts=Counter(recipes[r] for r in members[str(eid)])
  result[sp['id']]={'name':sp['name'],'entityId':eid,'entityName':entities[eid], 'sourceQuality':q,'missing':False,'recipeCount':sum(counts.values()),
   'cuisines':[{'cuisine':c,'recipeCount':counts[c],'totalRecipes':totals[c],'frequency':round(counts[c]/totals[c],6)} for c in sorted(totals)]}
 output={'source':'CulinaryDB, CoSyLab / IIIT-Delhi / Ganesh Bagler','url':URL,'license':'CC BY-NC-SA 3.0','licenseUrl':'https://creativecommons.org/licenses/by-nc-sa/3.0/', 'retrieved':'2026-10-13',
 'method':'Unique recipe IDs containing ingredient / all recipes in that cuisine. Zero is observed absence in this corpus, not universal absence. Unmapped ingredients are missing. Compound ingredients are not decomposed. Corpus selection bias applies; no quantity inference.',
 'inputSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(CACHE.glob('*.csv'))},'recipeCount':len(recipes),'cuisineTotals':dict(sorted(totals.items())),'spices':result}
 (ROOT/'src/data/cuisine-frequencies.json').write_text(json.dumps(output,indent=2)+'\n')
 print(f'CulinaryDB: {len(recipes)} recipes, {len(totals)} cuisines, {sum(not r["missing"] for r in result.values())}/{len(result)} spices mapped')
if __name__=='__main__':main()
