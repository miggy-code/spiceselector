"""Generate a sourced pungency reference layer without equating odor and heat.
Facts and citations only; no copied publisher tables or figures. No scalar recalibration.
"""
import json
from pathlib import Path
from ingest_compound_overlap import load_spices
ROOT=Path(__file__).resolve().parent.parent
NMSU='https://bernalilloextension.nmsu.edu/documents/redchile-part3.pdf'
METHOD='https://pubs.nmsu.edu/_h/H237/index.html'
ITC='https://doi.org/10.1038/nature02282'
REVIEW='https://pmc.ncbi.nlm.nih.gov/articles/PMC10296967/'
def main():
 rows={}
 for s in load_spices():
  name=s['name'];r={'name':name,'scovilleRange':None,'pungencyClass':None,'sourceQuality':'none','sources':[],'missing':True}
  if name=='Cayenne':
   r.update(scovilleRange={'min':30000,'max':50000,'unit':'SHU'},pungencyClass='capsaicinoid-hot',sourceQuality='exact',sources=[NMSU,METHOD],missing=False,note='Published typical range, not a measurement of this product. NMSU cultivar trials also report cayenne types below this typical range.')
  elif name in ['Black Pepper','White Pepper','Long Pepper']:
   r.update(pungencyClass='piperine-biting',sourceQuality='exact',sources=[REVIEW],missing=False,note='Mechanism evidence; no defensible universal product SHU or total rank relative to hydrated mustard and ginger.')
  elif name in ['Mustard Seed','Horseradish','Wasabi']:
   r.update(pungencyClass='isothiocyanate-sharp',sourceQuality='exact',sources=[ITC],missing=False,note='Mechanism evidence; preparation/species and myrosinase activation determine intensity. Does not imply capsaicin-equivalent heat.')
  elif name=='Ginger':
   r.update(pungencyClass='gingerol-shogaol-warming',sourceQuality='exact',sources=[REVIEW],missing=False,note='Mechanism evidence; drying changes gingerol/shogaol composition. Pure-compound potency is not whole-ingredient potency.')
  elif '.chili.' in s['id'] or name in ['Paprika','Smoked Paprika']:
   r.update(pungencyClass='capsaicinoid-variable',sources=[METHOD],note='Cultivar, blend and processing unspecified; no ingredient-specific measured range available in this reference layer.')
  rows[s['id']]=r
 out={'method':'Reference layer only. Existing heat coordinates remain LLM estimates. Odor spicy/phenolic is not pungency. No cross-mechanism total ranking or invented Scoville values.','sourcesAre':'Cited facts and findings; no additional bulk dataset integrated.','spices':rows}
 (ROOT/'src/data/pungency-evidence.json').write_text(json.dumps(out,indent=2)+'\n')
if __name__=='__main__':main()
