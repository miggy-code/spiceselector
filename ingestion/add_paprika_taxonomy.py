"""Idempotently generate the additional sweet paprika taxonomy leaf.
Retains every pre-existing node and property; no whole-taxonomy reconstruction.
"""
import json
from pathlib import Path
PATH=Path(__file__).resolve().parent.parent/'src/data/spice-taxonomy.json'
def main():
 root=json.loads(PATH.read_text());found=[]
 def walk(n):
  if n['id']=='earthy.smoky':
   found.append(n)
   if not any(c['id']=='earthy.smoky.paprika' for c in n['children']):
    n['children'].append({'id':'earthy.smoky.paprika','name':'Paprika','level':'spice','description':'Sweet unsmoked ground Capsicum; distinct from smoked paprika'})
  for c in n.get('children',[]):walk(c)
 walk(root)
 if len(found)!=1:raise ValueError('Expected exactly one earthy.smoky parent')
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
