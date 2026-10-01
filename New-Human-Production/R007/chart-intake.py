"""Offline-only, exhaustive reference intake. No source mesh is a runtime input."""
import json,numpy as np
from collections import defaultdict,Counter
from pathlib import Path
ROOT=Path(__file__).parent
d=json.load(open(ROOT/'qa/capture.json'));m=d['meshes'][0]
a=m['attributes'];raw=np.array(a['position']['array']).reshape(-1,3)
mat=np.array(m['matrix']).reshape(4,4).T
world=raw@mat[:3,:3].T+mat[:3,3]
scale=1.8/(world[:,1].max()-world[:,1].min());offset=np.array([0,-world[:,1].min()*scale,0]);world=world*scale+offset
# Weld only the position domain. UV/material/skin samples remain per corner.
positions,inv=np.unique(np.round(world,9),axis=0,return_inverse=True)
tri=inv.reshape(-1,3);fn=np.cross(positions[tri[:,1]]-positions[tri[:,0]],positions[tri[:,2]]-positions[tri[:,0]])
area=np.linalg.norm(fn,axis=1);norm=fn/np.maximum(area[:,None],1e-15)
axis=np.argmax(abs(norm),axis=1);sgn=np.sign(norm[np.arange(len(norm)),axis]);label=axis*2+(sgn<0)
names={n['uuid']:n['name'] for n in d['nodes']};boneNames=[names[b] for b in m['skeleton']['bones']]
def region(name):
 if name=='root' or name=='pelvis' or name.startswith('spine'):return 'torso'
 if name.startswith('neck') or name=='head':return 'head'
 if 'twist' in name:return name.split('_twist')[0]+'_'+name[-1]
 if name.startswith('clavicle'):return 'upperarm_'+name[-1]
 if name.startswith(('thumb','index','middle','ring','pinky')):return name.split('_')[0]+'_'+name[-1]
 if name.startswith('ball'):return 'foot_'+name[-1]
 return name
regions=sorted(set(region(n) for n in boneNames));boneRegion=np.array([regions.index(region(n)) for n in boneNames]);si=np.array(a['skinIndex']['array']).reshape(-1,4).astype(int);sw=np.array(a['skinWeight']['array']).reshape(-1,4);rw=np.zeros((len(tri),len(regions)))
for k in range(4):np.add.at(rw,(np.repeat(np.arange(len(tri)),3),boneRegion[si[:,k]]),sw[:,k])
anatomy=np.argmax(rw,axis=1)
label=label+6*anatomy
edges=defaultdict(list)
for t,(a,b,c) in enumerate(tri):
 for x,y in ((a,b),(b,c),(c,a)):edges[tuple(sorted((int(x),int(y))))].append(t)
adj=[[] for _ in tri]
for ts in edges.values():
 for t in ts:adj[t].extend(x for x in ts if x!=t)
parents=list(range(len(tri)))
def find(x):
 while parents[x]!=x:parents[x]=parents[parents[x]];x=parents[x]
 return x
for t,neighbors in enumerate(adj):
 for n in neighbors:
  if label[t]==label[n]:parents[find(n)]=find(t)
groups=defaultdict(list)
for i in range(len(tri)):groups[find(i)].append(i)
# Merge tiny normal-axis islands into neighboring height domains only while
# every source face remains an oriented graph over the chosen plane.
regionOf=np.array([find(i) for i in range(len(tri))]); active={int(k):set(v) for k,v in groups.items()};regionAxes={k:(int(axis[v[0]]),int(sgn[v[0]])) for k,v in groups.items()};regionAnatomy={k:int(anatomy[v[0]]) for k,v in groups.items()}
for key in sorted(active,key=lambda k:-len(active[k])):
 if key not in active:continue
 ax,sign=regionAxes[key];again=True
 while again:
  again=False;neighbors=set(int(regionOf[n]) for t in active[key] for n in adj[t])-set([key])
  for neighbor in sorted(neighbors):
   if neighbor not in active:continue
   ts=list(active[neighbor])
   if regionAnatomy[key]==regionAnatomy[neighbor] and np.min(norm[ts,ax]*sign)>.20:
    active[key].update(ts);regionOf[ts]=key;del active[neighbor];again=True
groups={k:sorted(v) for k,v in active.items()}
# Guarantee a single-valued graph: reject positive-area overlaps in the
# parameter projection while growing each connected chart. Shared edges pass.
splitGroups=[]
for key,ts in groups.items():
 ax,sign=regionAxes[key];plane=[k for k in range(3) if k!=ax];remaining=set(ts)
 while remaining:
  seed=min(remaining);queue=[seed];accepted=[];projected=[];remaining.remove(seed)
  while queue:
   t=queue.pop();uvtri=positions[tri[t]][:,plane];overlap=False
   if projected:
    other=np.array(projected);mins=other.min(axis=1);maxs=other.max(axis=1);lo=uvtri.min(axis=0);hi=uvtri.max(axis=0);ids=np.where(np.all(maxs>=lo-2e-6,axis=1)&np.all(mins<=hi+2e-6,axis=1))[0]
    for i in ids:
     b=other[i];separated=False
     # Parameter contacts are legal only when the height is also identical.
     # An ear/toe fold can touch in projection without positive-area overlap.
     ah=positions[tri[t],ax];bh=positions[tri[accepted[i]],ax]
     for x,y,hx,hy in ((uvtri,b,ah,bh),(b,uvtri,bh,ah)):
      aa,bb,cc=y;delta1=bb-aa;delta2=cc-aa;den=delta1[0]*delta2[1]-delta1[1]*delta2[0]
      if abs(den)<1e-18:continue
      us=((x[:,0]-aa[0])*(cc[1]-aa[1])-(x[:,1]-aa[1])*(cc[0]-aa[0]))/den;vs=((bb[0]-aa[0])*(x[:,1]-aa[1])-(bb[1]-aa[1])*(x[:,0]-aa[0]))/den;ws=1-us-vs;contained=(us>=-.001)&(vs>=-.001)&(ws>=-.001)
      if np.any(contained&(abs(hx-(hy[0]*ws+hy[1]*us+hy[2]*vs))>.0001)):overlap=True;break
     if overlap:break
     for polygon in (uvtri,b):
      for e in range(3):
       delta=polygon[(e+1)%3]-polygon[e];normal=np.array([-delta[1],delta[0]]);aProj=uvtri@normal;bProj=b@normal
       if min(aProj.max(),bProj.max())-max(aProj.min(),bProj.min())<=1e-10*np.linalg.norm(normal):separated=True;break
      if separated:break
     if not separated:overlap=True;break
   if overlap:remaining.add(t);continue
   accepted.append(t);projected.append(uvtri)
   for n in adj[t]:
    if n in remaining and len(accepted)+len(queue)<320:remaining.remove(n);queue.append(n)
  splitGroups.append((key,sorted(accepted)))
charts=[]
for key,ts in splitGroups:
 ids=sorted(set(int(x) for x in tri[ts].ravel()));ax,sign=regionAxes[key];plane=[k for k in range(3) if k!=ax]
 counts=Counter(tuple(sorted((int(x),int(y)))) for t in ts for x,y in zip(tri[t],np.roll(tri[t],-1)))
 boundary=[]
 for t in ts:
  for x,y in zip(tri[t],np.roll(tri[t],-1)):
   if counts[tuple(sorted((int(x),int(y))))]==1:boundary.append([int(x),int(y)])
 charts.append({'axis':ax,'sign':sign,'plane':plane,'anatomy':regions[regionAnatomy[key]],'triangles':ts,'vertices':ids,'boundary':boundary})
charts.sort(key=lambda x:len(x['triangles']),reverse=True)
out={'scale':scale,'offset':offset.tolist(),'positions':positions.tolist(),'sourceIndex':inv.tolist(),'triangles':tri.tolist(),'charts':charts}
json.dump(out,open(ROOT/'qa/projection-charts.json','w'))
print(json.dumps({'charts':len(charts),'tinyCharts':sum(len(c['triangles'])<4 for c in charts),'trimEdges':sum(len(c['boundary']) for c in charts),'largest':[len(c['triangles']) for c in charts[:20]],'nonmanifoldEdges':sum(len(ts)>2 for ts in edges.values()),'openSourceEdges':sum(len(ts)==1 for ts in edges.values()),'uniqueVertices':len(positions),'scale':scale}))
