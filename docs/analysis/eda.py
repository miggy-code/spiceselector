import json, re, itertools
from pathlib import Path
from collections import Counter, defaultdict
import numpy as np
from scipy.stats import spearmanr
from scipy.spatial.distance import pdist, squareform
from sklearn.decomposition import PCA

ROOT = Path(__file__).resolve().parents[2]
def read(p): return json.loads((ROOT/p).read_text())
profiles = list(read('ingestion/generated_profiles.json').values())
axes = ['warmth','brightness','earthiness','florality','heat']
leaves=[]
def walk(n):
    if n['level']=='spice': leaves.append(n)
    for c in n.get('children',[]): walk(c)
walk(read('src/data/spice-taxonomy.json'))
normalize=lambda s: re.sub('[^a-z]','',s.lower())
names={normalize(n['name']):n['id'] for n in leaves}
segments={normalize(n['id'].split('.')[-1]):n['id'] for n in leaves}
aliases={'bayleaves':'herbal.leafy.bay-leaf','chilipowder':'hot-pungent.chili.red-pepper-flakes','paprika':'earthy.smoky.smoked-paprika','rose':'floral.rose-family.rose-water'}
def resolve(p):
    for c in [p['id'],p['name'],re.sub('s$','',p['id']),re.sub('s$','',p['name'])]:
        key=normalize(c)
        v=aliases.get(key) or names.get(key) or segments.get(key)
        if v:return v
mapped=defaultdict(list)
for p in profiles: mapped[resolve(p)].append(p['name'])
pairkey=lambda a,b: tuple(sorted((a,b)))
aff={pairkey(p['a'],p['b']):p['score'] for p in read('src/data/pairing-scores.json')}
chem={pairkey(p['a'],p['b']):p['compoundScore'] for p in read('src/data/compound-overlap.json')}
X=np.array([[p[a] for a in axes] for p in profiles],float)
full=squareform(pdist(X))
neighbors=lambda D,k: np.argsort(np.where(np.eye(len(D)),np.inf,D),axis=1)[:,:k]
orig=neighbors(full,6)
pair_results=[]
for a,b in itertools.combinations(range(5),2):
    D=squareform(pdist(X[:,[a,b]])); nn=neighbors(D,6)
    overlap=np.mean([len(set(x)&set(y))/6 for x,y in zip(orig,nn)])
    duplicates=defaultdict(list)
    for p in profiles: duplicates[(p[axes[a]],p[axes[b]])].append(p['name'])
    sx=(X[:,a]-X[:,a].min()+5)/(np.ptp(X[:,a])+10)*720
    sy=(X[:,b]-X[:,b].min()+5)/(np.ptp(X[:,b])+10)*520
    radii=np.array([3+9*p['intensity']/100 for p in profiles])
    screen=np.column_stack([sx,sy]); ds=squareform(pdist(screen))
    collisions=[(i,j) for i in range(len(X)) for j in range(i+1,len(X)) if ds[i,j]<radii[i]+radii[j]]
    pair_results.append({'axes':[axes[a],axes[b]],'neighbors_retained':round(float(overlap),4),'dot_overlaps':len(collisions),'exact_coordinate_groups':[v for v in duplicates.values() if len(v)>1]})
pca=PCA().fit(X); projected=pca.transform(X)[:,:2]; pn=neighbors(squareform(pdist(projected)),6)
pca_retention=np.mean([len(set(a)&set(b))/6 for a,b in zip(orig,pn)])
paired=[]
for i,p in enumerate(profiles):
    for j in range(i+1,len(profiles)):
        q=profiles[j]; a,b=resolve(p),resolve(q)
        if not a or not b or a==b:continue
        key=pairkey(a,b)
        if key in aff:
            paired.append({'a':p['name'],'b':q['name'],'affinity':aff[key],'distance5':float(full[i,j]),'distance2':float(np.linalg.norm(X[i,:2]-X[j,:2])),'chemistry':chem.get(key),'same_family':p['family']==q['family']})
affnodes=sorted(set(itertools.chain.from_iterable(aff)))
scores=np.array(list(aff.values()))
top6=Counter()
for a in affnodes:
    top=sorted([(b,aff[pairkey(a,b)]) for b in affnodes if a!=b],key=lambda p:-p[1])[:6]
    top6.update(b for b,s in top if s>=.5)
shared=sorted(set(aff)&set(chem))
coverage=read('ingestion/flavorgraph_coverage.json')
vectors=read('src/data/flavor-vectors.json')
unique_distances=[]
unique_affinities=[]
for a,b in itertools.combinations(sorted(vectors),2):
    key=pairkey(a,b)
    if key in aff:
        unique_distances.append(-float(np.linalg.norm(np.array([vectors[a][t] for t in axes])-np.array([vectors[b][t] for t in axes]))))
        unique_affinities.append(aff[key])
canonical_families={'warm','hot-pungent','sweet','earthy','herbal','floral','citrus-bright','umami-savory'}
report={
 'display_quality':{'profiles_missing_canonical_family_color':sum(p['family'] not in canonical_families for p in profiles),'profiles_with_heat_at_most_10':sum(p['heat']<=10 for p in profiles)},
 'unique_vector_relationship':{'pair_observations':len(unique_affinities),'flavor_similarity_vs_recipe_spearman':round(float(spearmanr(unique_distances,unique_affinities).statistic),4)},
 'scope':{'profiles':len(profiles),'taxonomy':len(leaves),'unique_profile_taxonomy_ids':len([k for k in mapped if k]),'mapped_duplicates':{k:v for k,v in mapped.items() if len(v)>1},'unmapped':mapped.get(None,[]),'taxonomy_absent_from_map':[n['name'] for n in leaves if n['id'] not in mapped],'missing_axis_values':{a:sum(p.get(a) is None for p in profiles) for a in axes},'profile_families':dict(Counter(p['family'] for p in profiles))},
 'axes':{a:{'min':float(X[:,i].min()),'median':float(np.median(X[:,i])),'max':float(X[:,i].max()),'unique_values':len(set(X[:,i])),'pct_multiple_5':round(float(np.mean(X[:,i]%5==0))*100,1)} for i,a in enumerate(axes)},
 'axis_correlations':np.round(np.corrcoef(X.T),3).tolist(),
 'axis_pairs':pair_results,
 'pca':{'explained_variance_ratios':np.round(pca.explained_variance_ratio_,4).tolist(),'top6_neighbors_retained':round(float(pca_retention),4),'loadings':np.round(pca.components_[:2],3).tolist()},
 'affinity':{'nodes':len(affnodes),'pairs':len(aff),'quantiles':dict(zip(['min','p10','p25','median','p75','p90','p95','max'],np.round(np.quantile(scores,[0,.1,.25,.5,.75,.9,.95,1]),4).tolist())),'thresholds':{str(t):{'edges':int(sum(scores>=t)),'fraction':round(float(np.mean(scores>=t)),4)} for t in [.5,.6,.7,.8,.9]},'most_frequent_top6_partners':top6.most_common(10),'map_profiles_with_recipe_signal':sum(resolve(p) in affnodes for p in profiles),'map_profiles_without_recipe_signal':[p['name'] for p in profiles if resolve(p) not in affnodes],'approximate_matches':[p for p in coverage['matched'] if p['approximate']]},
 'signal_relationships':{'mapped_pair_observations':len(paired),'flavor5_similarity_vs_recipe_spearman':round(float(spearmanr([-p['distance5'] for p in paired],[p['affinity'] for p in paired]).statistic),4),'default2_similarity_vs_recipe_spearman':round(float(spearmanr([-p['distance2'] for p in paired],[p['affinity'] for p in paired]).statistic),4),'recipe_vs_compound_spearman':round(float(spearmanr([aff[k] for k in shared],[chem[k] for k in shared]).statistic),4),'recipe_compound_shared_pairs':len(shared),'same_family_affinity_median':round(float(np.median([p['affinity'] for p in paired if p['same_family']])),4),'cross_family_affinity_median':round(float(np.median([p['affinity'] for p in paired if not p['same_family']])),4),'high_affinity_distant_flavor':sorted(paired,key=lambda p:(-p['affinity'], -p['distance5']))[:15]},
}
out=Path(__file__).resolve().parent
(out/'results.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'plot-data.json').write_text(json.dumps({'profiles':profiles,'pca':projected.tolist(),'pairs':paired}))
print(json.dumps(report,indent=2))
