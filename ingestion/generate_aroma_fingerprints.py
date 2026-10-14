"""Descriptor-derived fingerprints; presence evidence, never measured sensory intensity.
No network. FlavorDB2 CC BY-NC-SA 3.0; FooDB noncommercial terms.
"""
import json
import math
import re
from collections import Counter
from pathlib import Path
from ingest_compound_overlap import load_spices, resolve
from ingest_flavordb2 import FLAVORDB2_MAP
ROOT = Path(__file__).resolve().parent.parent
# Explicit whole-word vocabulary: unmatched descriptors remain visible in the audit.
VOCAB = {
 'woody': 'wood woody cedar pine resinous sandalwood',
 'citrus': 'citrus lemon lime orange grapefruit bergamot',
 'floral': 'floral flower rose violet jasmine lavender lilac geranium carnation',
 'sweet-balsamic': 'sweet balsam balsamic vanilla honey caramel tonka licorice anise',
 'spicy-phenolic': 'spicy spice clove cinnamon phenolic pepper pungent nutmeg',
 'green-herbal': 'green herbal herb grassy grass leafy hay tea vegetable',
 'earthy-roasty': 'earth earthiness earthy musty mushroom roast roasted coffee cocoa chocolate smoky smoke burnt',
 'sulfurous-alliaceous': 'sulfur sulfurous sulphur sulphurous garlic onion cabbage meaty alliaceous',
 'minty-camphor': 'mint minty menthol camphor camphoraceous eucalyptus cooling',
 'fruity': 'fruit fruity apple pear peach plum berry raspberry strawberry banana pineapple apricot grape melon coconut',
 'fatty-waxy': 'fat fatty wax waxy oily oil creamy butter buttery cheese cheesy dairy',
 'nutty': 'nut nutty almond hazelnut peanut walnut sesame popcorn',
}
TOKENS = {k:set(v.split()) for k,v in VOCAB.items()}
def families(word):
    tokens=set(re.findall(r'[a-z]+', word.lower()))
    return [k for k,v in TOKENS.items() if tokens & v]
def write(path, obj): path.write_text(json.dumps(obj,indent=2,allow_nan=False)+'\n')
def main():
    spices=load_spices(); foodb=json.loads((ROOT/'idea/foodb_spice_data.json').read_text())
    # Resolve only FooDB here: USDA has no descriptor annotations.
    index={re.sub('[^a-z]','',n.lower()):cs for n,cs in foodb.items()}
    cache=ROOT/'ingestion/flavordb2_cache'
    # Crosswalk exact chemical-name matches to PubChem, without stripping stereochemistry.
    raws={eid:json.loads((cache/f'{eid}.json').read_text()) for eid,_ in set(FLAVORDB2_MAP.values()) if (cache/f'{eid}.json').exists()}
    norm=lambda s: re.sub(r'\s+', ' ', s.strip().lower())
    cross={}
    for raw in raws.values():
        for m in raw.get('molecules',[]):
            if m.get('pubchem_id') is not None:
                cross.setdefault(norm(m.get('common_name') or ''),set()).add(str(m['pubchem_id']))
    docs={}; evidence={}; source_docs={}
    for sp in spices:
        mols={}; sources=[]; qualities=[]
        mapped=FLAVORDB2_MAP.get(sp['name'])
        if mapped and mapped[0] in raws:
            eid,q=mapped; raw=raws[eid]
            for m in raw.get('molecules',[]):
                if m.get('pubchem_id') is not None:
                    mols.setdefault('pubchem:'+str(m['pubchem_id']),set()).update(w.strip().lower() for w in (m.get('flavor_profile') or '').split('@') if w.strip())
            sources.append({'source':'FlavorDB2','entityId':eid,'quality':q}); qualities.append(q)
            source_docs['fdb:'+str(eid)]=set(mols)
        cs=resolve(sp,index) or []
        fm=set()
        for c in cs:
            if not c.get('flavors'): continue
            ids=cross.get(norm(c['name']),set())
            key='pubchem:'+next(iter(ids)) if len(ids)==1 else 'foodb:'+str(c['id'])
            mols.setdefault(key,set()).update(w.strip().lower() for w in c['flavors'] if w.strip());fm.add(key)
        if fm:
            q = 'approx' if sp['name'] == 'Rose Water' else 'exact'
            sources.append({'source':'FooDB','quality':q,'ingredient':sp['name']});qualities.append(q)
            source_docs['foodb:'+sp['name']]=fm
        docs[sp['id']]=mols;evidence[sp['id']]=(sources,qualities)
    # IDF documents are distinct source ingredients/entities, so stand-ins count once.
    df=Counter(m for ms in source_docs.values() for m in ms);N=len(source_docs)
    idf={m:math.log(N/n) for m,n in df.items()}
    out={};unmatched=Counter()
    for sp in spices:
        mols=docs[sp['id']]; weights=Counter();desc=Counter();annotated=0;mapped_count=0
        for m, words in mols.items():
            if words: annotated+=1
            hits=set()
            for w in words:
                fs=families(w);hits.update(fs)
                desc[w]+=idf.get(m,0)
                if not fs: unmatched[w]+=1
            if hits:
                mapped_count+=1
                for f in hits: weights[f]+=idf.get(m,0)/len(hits)
        total=sum(weights.values());sources,qualities=evidence[sp['id']]
        out[sp['id']]={'name':sp['name'],'vector':{f:round(weights[f]/total,8) for f in VOCAB} if total else None,
          'topDescriptors':[{'descriptor':w,'weight':round(v,5)} for w,v in sorted(desc.items(),key=lambda x:(-x[1],x[0]))[:15]],
          'moleculeCount':len(mols),'annotatedMoleculeCount':annotated,'mappedMoleculeCount':mapped_count,
          'sourceQuality':('approx' if 'approx' in qualities else 'exact') if total else 'none',
          'missing':not bool(total),'missingReason':None if total else ('no source molecules' if not mols else 'no positive mapped descriptor weight'),'sources':sources}
    write(ROOT/'src/data/aroma-fingerprints.json',out)
    write(ROOT/'docs/analysis/aroma-method.json',{'vocabulary':VOCAB,'idfDocuments':N,'idf':'ln(N / df); distinct source ingredients/entities; equal mass per molecule split across matched families; L1 normalization', 'unmatchedDescriptors':dict(unmatched.most_common()),'license':'FlavorDB2-derived: CC BY-NC-SA 3.0; FooDB noncommercial terms', 'limitations':['Presence and molecule descriptors, not concentrations or odor activity values.','Source lists can include nonvolatile/taste descriptors and contaminants.','Exact means ingredient mapping, not analytical validation.','Approximate input is conservatively flagged even when exact FooDB input also exists.']})
    print('Fingerprint coverage:',Counter(r['sourceQuality'] for r in out.values()))
if __name__=='__main__':main()
