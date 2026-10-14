"""Descriptive Pearson/Spearman checks; no recalibration or causal claims."""
import json
from pathlib import Path
import numpy as np
from scipy.stats import spearmanr
ROOT=Path(__file__).resolve().parent.parent
MATCH={'warmth':['sweet-balsamic','spicy-phenolic','woody'], 'brightness':['citrus','green-herbal'], 'earthiness':['earthy-roasty'], 'florality':['floral'], 'heat':['spicy-phenolic']}
def main():
    from complete_profile_identities import ALIASES
    from ingest_compound_overlap import load_spices,spice_key
    leaves={spice_key(s['name']):s['id'] for s in load_spices()}
    profiles=json.loads((ROOT/'ingestion/generated_profiles.json').read_text())
    fp=json.loads((ROOT/'src/data/aroma-fingerprints.json').read_text())
    rows={};differences=[]
    for axis,fs in MATCH.items():
        points=[]
        for p in profiles.values():
            k=spice_key(p['name']);tid=leaves[ALIASES.get(k,k)];r=fp[tid]
            if r['missing']:continue
            points.append((p['name'],float(p[axis]),sum(r['vector'][f] for f in fs),r['sourceQuality']))
        x=np.array([p[1] for p in points]);y=np.array([p[2] for p in points]);
        valid=len(points)>2 and np.std(x)>0 and np.std(y)>0
        rows[axis]={'families':fs,'n':len(points),'pearson':round(float(np.corrcoef(x,y)[0,1]),4) if valid else None,'spearman':round(float(spearmanr(x,y).statistic),4) if valid else None}
        exact=[p for p in points if p[3]=='exact']
        if len(exact)>2:
            ex=np.array([p[1] for p in exact]);ey=np.array([p[2] for p in exact]);rows[axis]['exactOnly']={'n':len(exact),'pearson':round(float(np.corrcoef(ex,ey)[0,1]),4),'spearman':round(float(spearmanr(ex,ey).statistic),4)}
        if valid:
            for p in points:
                gap=(p[1]-x.mean())/x.std()-(p[2]-y.mean())/y.std()
                differences.append({'spice':p[0],'axis':axis,'llm':p[1],'fingerprintShare':round(p[2],5),'zDifference':round(float(gap),4),'sourceQuality':p[3]})
    report={'correlations':rows,'biggestDisagreements':sorted(differences,key=lambda r:-abs(r['zDifference']))[:10],'method':'Absolute difference of within-axis population z-scores; all available profiles, exact + approx. Descriptive only; shared spices and source entities are dependent. Heat descriptor correlation is NOT pungency validation. No axes recalibrated.'}
    (ROOT/'docs/analysis/axis-fingerprint-audit.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__': main()
