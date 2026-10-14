"""Normalize source families and merge the bay-leaf duplicate without regenerating scores."""
import json
from pathlib import Path
from ingest_compound_overlap import load_spices, spice_key
ROOT = Path(__file__).resolve().parent.parent
ALIASES = {'cloves':'clove','coriander':'corianderseed','mustardseeds':'mustardseed','rose':'rosewater','chilipowder':'redpepperflakes','bayleaves':'bayleaf'}
def main():
    path = ROOT / 'ingestion/generated_profiles.json'
    profiles = json.loads(path.read_text())
    leaves = {spice_key(s['name']): s for s in load_spices()}
    # Retain the original singular profile and preserve the alternate record as provenance.
    if 'Bay leaves' in profiles and 'Bay leaf' in profiles:
        alternate = profiles.pop('Bay leaves')
        profiles['Bay leaf']['merged_profiles'] = [alternate]
    by_id = {}
    for key, p in profiles.items():
        k = spice_key(p['name']); k = ALIASES.get(k, k)
        leaf = leaves[k]
        p['family'] = leaf['id'].split('.')[0]
        if key == 'Paprika':
            p['legacy_id'] = p.get('legacy_id', p['id'])
            p['id'] = 'sweet-paprika'
        if leaf['id'] in by_id:
            raise ValueError(f'Duplicate identity: {key}, {by_id[leaf["id"]]}')
        by_id[leaf['id']] = key
    path.write_text(json.dumps(profiles, indent=2)+'\n')
    print(f'{len(by_id)}/{len(leaves)} unique profiles')
if __name__ == '__main__': main()
