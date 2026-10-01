import json,numpy as np
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];d=json.load(open(root/'qa/capture.json'));out=[]
for m in d['meshes']:
 p=np.array(m['attributes']['position']['array']).reshape(-1,3);u=np.array(m['attributes']['uv']['array']).reshape(-1,2)
 M=np.array(m['matrix']).reshape(4,4).T;p=p@M[:3,:3].T+M[:3,3]
 uniq,inv=np.unique(np.round(u,7),axis=0,return_inverse=True);tri=inv.reshape(-1,3)
 edges=np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1);edges,counts=np.unique(edges,axis=0,return_counts=True)
 parent=np.arange(len(uniq))
 def find(a):
  while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
  return a
 for a,b in edges:
  x,y=find(a),find(b)
  if x!=y:parent[y]=x
 groups=np.array([find(i) for i in range(len(uniq))]);ids,cs=np.unique(groups,return_counts=True)
 out.append({'part':m['name'],'faces':len(tri),'positionMin':p.min(axis=0).tolist(),'positionMax':p.max(axis=0).tolist(),'uvMin':u.min(axis=0).tolist(),'uvMax':u.max(axis=0).tolist(),'uvIslands':len(ids),'islandSizes':sorted(cs.tolist(),reverse=True)[:20],'boundaryEdges':int((counts==1).sum())})
 print(out[-1],flush=True)
json.dump(out,open(root/'qa/part-analysis.json','w'),indent=2)
folder=next((root/'qa/source-intake').glob('*.fbm'))
print('texture sizes',[(f.name,Image.open(f).size) for f in folder.glob('*basecolor*')])
