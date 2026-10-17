"""Idempotently generate the curated taxonomy additions.
Retains every pre-existing node and property; no whole-taxonomy reconstruction.
"""
import json
from pathlib import Path
PATH=Path(__file__).resolve().parent.parent/'src/data/spice-taxonomy.json'
def main():
 additions = [
  ('earthy.smoky', 'paprika', 'Paprika', 'Sweet unsmoked ground Capsicum; distinct from smoked paprika'),
  ('herbal.leafy', 'mint', 'Mint', 'Spearmint leaf with sweet, cooling green aroma'),
  ('herbal.asian', 'curry-leaf', 'Curry Leaf', 'Citrusy, nutty aromatic leaf used in South Asian tempering'),
  ('umami-savory.resin', 'asafoetida', 'Asafoetida', 'Sulfurous Ferula resin that mellows to savory onion-like notes when cooked'),
  ('earthy.seed', 'ajwain', 'Ajwain', 'Thyme-like, pungent seed spice also called carom'),
  ('warm.woody', 'black-cardamom', 'Black Cardamom', 'Smoky, camphoraceous pod distinct from green cardamom'),
  ('earthy.seed', 'annatto', 'Annatto', 'Achiote seed with mild earthy, peppery flavor and orange-red color'),
  ('herbal.leafy', 'epazote', 'Epazote', 'Pungent Mexican herb with resinous citrus notes'),
  ('herbal.leafy', 'huacatay', 'Huacatay', 'Peruvian black mint with minty, anise-like aroma'),
  ('hot-pungent.chili', 'aji-amarillo', 'Ají Amarillo', 'Fruity Peruvian yellow-orange Capsicum baccatum chili'),
  ('hot-pungent.chili', 'aji-panca', 'Ají Panca', 'Mild dried Peruvian chili with berry-like, earthy depth'),
  ('hot-pungent.chili', 'rocoto', 'Rocoto', 'Juicy, hot Capsicum pubescens chili with black seeds'),
  ('herbal.mediterranean', 'juniper-berry', 'Juniper Berry', 'Piney, resinous culinary Juniperus communis cone'),
  ('herbal.mediterranean', 'savory', 'Savory', 'Summer savory leaf with peppery, thyme-like flavor'),
 ]
 root=json.loads(PATH.read_text());nodes={}
 def walk(n):
  if n['id'] in nodes: raise ValueError(f"Duplicate taxonomy id: {n['id']}")
  nodes[n['id']]=n
  for c in n.get('children',[]):walk(c)
 walk(root)
 if 'umami-savory.resin' not in nodes:
  resin={'id':'umami-savory.resin','name':'Savory Resin','level':'subcategory','children':[]}
  nodes['umami-savory']['children'].append(resin);nodes[resin['id']]=resin
 for parent,slug,name,description in additions:
  node_id=parent+'.'+slug
  if parent not in nodes:raise ValueError(f'Missing taxonomy parent: {parent}')
  if node_id not in nodes:
   leaf={'id':node_id,'name':name,'level':'spice','description':description}
   nodes[parent]['children'].append(leaf);nodes[node_id]=leaf
  elif nodes[node_id]['name']!=name:raise ValueError(f'Conflicting existing leaf: {node_id}')
 # Keep leaf records compact, matching the taxonomy source's established style.
 def render(n,depth=0):
  pad='  '*depth
  if n.get('level')=='spice':return '{ ' + json.dumps(n,ensure_ascii=False)[1:-1] + ' }'
  lines=['{']
  items=list(n.items())
  for i,(k,v) in enumerate(items):
   suffix=',' if i<len(items)-1 else ''
   if k=='children':
    lines.append('  '*(depth+1)+json.dumps(k)+': [')
    for j,c in enumerate(v):lines.append('  '*(depth+2)+render(c,depth+2)+(',' if j<len(v)-1 else ''))
    lines.append('  '*(depth+1)+']'+suffix)
   else:lines.append('  '*(depth+1)+json.dumps(k)+': '+json.dumps(v,ensure_ascii=False)+suffix)
  lines.append(pad+'}');return '\n'.join(lines)
 PATH.write_text(render(root)+'\n')
if __name__=='__main__':main()
