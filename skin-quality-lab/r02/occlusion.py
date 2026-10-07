"""Cosine-weighted static hemispherical visibility. Geometry, not painted dark regions."""
from pathlib import Path
import json,struct,hashlib,os
import numpy as np
from numba import njit
ROOT=Path(os.environ.get('SKIN_LAB_ROOT',Path(__file__).resolve().parent));source=ROOT.parent/'r01/assets/head.glb'
data=source.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);payload=data[28+n:];primitive=doc['meshes'][0]['primitives'][0]
def attribute(index,columns):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.frombuffer(payload,dtype=dtype,count=a['count']*columns,offset=offset).reshape(-1,columns).copy()
p=attribute(primitive['attributes']['POSITION'],3)*.04;norm=attribute(primitive['attributes']['NORMAL'],3);norm/=np.linalg.norm(norm,axis=1)[:,None]
indices=attribute(primitive['indices'],1).reshape(-1,3).astype(np.int32);tri=p[indices].astype(np.float64);lower=tri.min(axis=1);upper=tri.max(axis=1);centers=tri.mean(axis=1);bounds=[];links=[];order=[]
def build(ids):
 i=len(bounds);bounds.append(np.r_[lower[ids].min(axis=0),upper[ids].max(axis=0)]);links.append([-1,-1,0,0])
 if len(ids)<=8:
  start=len(order);order.extend(ids);links[i]=[-1,-1,start,len(ids)]
 else:
  axis=np.argmax(np.ptp(centers[ids],axis=0));ids=ids[np.argsort(centers[ids,axis],kind='stable')];m=len(ids)//2;l=build(ids[:m]);r=build(ids[m:]);links[i]=[l,r,0,0]
 return i
build(np.arange(len(tri)));bb=np.array(bounds);ll=np.array(links,dtype=np.int32);tt=tri[np.array(order)]
@njit(cache=True)
def hit(o,d,box,maximum):
 near=0.;far=maximum
 for c in range(3):
  if abs(d[c])<1e-12:
   if o[c]<box[c] or o[c]>box[c+3]:return False
  else:
   t0=(box[c]-o[c])/d[c];t1=(box[c+3]-o[c])/d[c];near=max(near,min(t0,t1));far=min(far,max(t0,t1))
   if near>far:return False
 return True
@njit(cache=True)
def closest(o,d,bb,ll,tri,maximum):
 stack=np.empty(64,np.int32);stack[0]=0;count=1;best=maximum
 while count:
  count-=1;k=stack[count]
  if not hit(o,d,bb[k],best):continue
  if ll[k,0]>=0:
   stack[count]=ll[k,0];stack[count+1]=ll[k,1];count+=2
  else:
   for j in range(ll[k,2],ll[k,2]+ll[k,3]):
    v=tri[j,0];e1=tri[j,1]-v;e2=tri[j,2]-v;h=np.cross(d,e2);det=np.dot(e1,h)
    if abs(det)<1e-12:continue
    inv=1./det;s=o-v;u=inv*np.dot(s,h)
    if u<0 or u>1:continue
    q=np.cross(s,e1);w=inv*np.dot(d,q)
    if w<0 or w+u>1:continue
    distance=inv*np.dot(e2,q)
    if distance>1e-7 and distance<best:best=distance
 return best
@njit(cache=True)
def bake(p,n,bb,ll,tri):
 ao=np.ones(len(p),np.float32);S=64;radius=.035
 for i in range(len(p)):
  N=n[i].astype(np.float64);ref=np.array([0.,1.,0.]) if abs(N[1])<.9 else np.array([1.,0.,0.]);T=np.cross(ref,N);T/=np.sqrt(np.dot(T,T));B=np.cross(N,T);o=p[i].astype(np.float64)+N*.00022;shadow=0.
  rotation=(np.sin(p[i,0]*1251+p[i,1]*3122+p[i,2]*8153)*43758.5453)%1
  for j in range(S):
   u=(j+.5)/S;phi=6.28318530718*((j*.61803398875+rotation)%1);r=np.sqrt(u);d=T*(r*np.cos(phi))+B*(r*np.sin(phi))+N*np.sqrt(1-u);distance=closest(o,d,bb,ll,tri,radius);shadow+=(1-distance/radius)**2
  ao[i]=max(.12,1-shadow/S)
 return ao
values=bake(p,norm,bb,ll,tt);seams={}
for i,point in enumerate(p):seams.setdefault(tuple(np.rint(point/1e-6).astype(int)),[]).append(i)
for group in seams.values():
 if len(group)>1:values[group]=np.mean(values[group])
out=ROOT/'assets';out.mkdir(exist_ok=True);encoded=values.astype('<f4').tobytes();(out/'occlusion.bin').write_bytes(encoded)
report={'method':'64 cosine-weighted rays per original vertex, 35 mm maximum radius, squared distance falloff. Indirect illumination only. Static reference visibility, not dynamic GI.','source_sha256':hashlib.sha256(data).hexdigest(),'vertices':len(values),'rays':len(values)*64,'min':float(values.min()),'mean':float(values.mean()),'max':float(values.max()),'bytes':len(encoded),'sha256':hashlib.sha256(encoded).hexdigest()}
(out/'occlusion.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));assert len(values)==9279 and values.min()<.6 and values.max()>.95
