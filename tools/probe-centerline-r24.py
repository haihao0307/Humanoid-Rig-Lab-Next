"""Offline exact rational validation of ambiguous original centerline rays."""
import json,math
from pathlib import Path
from fractions import Fraction as F
import numpy as np
root=Path(__file__).resolve().parent.parent
source=json.loads((root/'qa/fidelity-r21/offline/original.json').read_text())
state=json.loads((root/'qa/fidelity-r21/offline/case-baseline.json').read_text())
points=np.array(state['positionsYUp']).reshape(-1,3);faces=np.array(source['faces']).reshape(-1,3)
q=json.loads((root/'qa/fidelity-r24/exact-domain-zero-interval-rays.json').read_text());result=[]
cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
sub=lambda a,b:[x-y for x,y in zip(a,b)]
for view in q['profiles'][0]['views']:
 for sample in view['worst']:
  if sample.get('positionMetres',0)<1e-8:continue
  yaw=math.pi if view['view']=='back' else 0;pitch=.04;h=float(points[:,1].max()-points[:,1].min());target=np.array([0,(points[:,1].max()+points[:,1].min())*.5,0]);distance=h*1.35
  eye=np.array([math.sin(yaw)*math.cos(pitch)*distance,target[1]+math.sin(pitch)*distance,math.cos(yaw)*math.cos(pitch)*distance]);forward=target-eye;forward/=np.linalg.norm(forward);right=np.array([-forward[2],0,forward[0]]);right/=np.linalg.norm(right);up=np.cross(right,forward)
  direction=forward+.95*((sample['x']+.5-641*.5)/826*right+(826*.5-sample['y']-.5)/826*up);direction/=np.linalg.norm(direction)
  a,b,c=[points[faces[:,i]] for i in range(3)];e1=b-a;e2=c-a;hh=np.cross(np.broadcast_to(direction,e2.shape),e2);det=np.sum(e1*hh,axis=1);inv=np.zeros_like(det);inv[det>0]=1/det[det>0];ss=eye-a;u=np.sum(ss*hh,axis=1)*inv;qq=np.cross(ss,e1);v=np.sum(direction*qq,axis=1)*inv;t=np.sum(e2*qq,axis=1)*inv
  near=np.where((det>0)&(u>=-1e-10)&(v>=-1e-10)&(u+v<=1+1e-10)&(t>0))[0];origin=list(map(F,eye));ray=list(map(F,direction));hits=[]
  for face in near:
   aa,bb,cc=[list(map(F,points[i])) for i in faces[face]];ee1=sub(bb,aa);ee2=sub(cc,aa);hh=cross(ray,ee2);dd=dot(ee1,hh)
   if dd<=0:continue
   ss=sub(origin,aa);uu=dot(ss,hh)/dd;qq=cross(ss,ee1);vv=dot(ray,qq)/dd;tt=dot(ee2,qq)/dd
   if uu>=0 and vv>=0 and uu+vv<=1 and tt>0:hits.append({'face':int(face),'t':float(tt),'barycentric':[float(1-uu-vv),float(uu),float(vv)]})
  hits.sort(key=lambda v:v['t']);result.append({'view':view['view'],'pixel':[sample['x'],sample['y']],'candidate':sample,'exactRationalOriginalHits':hits[:8]})
(root/'qa/fidelity-r24/centerline-rational-probe.json').write_text(json.dumps({'offlineOnly':True,'cases':result},indent=2))
for item in result:print(json.dumps(item))
