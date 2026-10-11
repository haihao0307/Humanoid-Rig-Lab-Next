"""Actual browser points -> nearest source triangle checks. Not continuous collision.
The centroid search includes every triangle that can beat the current upper bound.
Signs use the closest oriented source face; no pressure or closed-body claim.
"""
from pathlib import Path
import argparse,json,gzip,base64,hashlib
import numpy as np
from scipy.spatial import cKDTree
from trimesh.triangles import closest_point
R=Path(__file__).resolve().parent
class TriangleDistance:
 def __init__(self,tri):
  self.tri=np.asarray(tri,dtype=float);self.centers=self.tri.mean(1);self.radius=np.linalg.norm(self.tri-self.centers[:,None],axis=2).max(1);self.tree=cKDTree(self.centers);self.max_radius=float(self.radius.max());self.norm=np.cross(self.tri[:,1]-self.tri[:,0],self.tri[:,2]-self.tri[:,0]);self.norm/=np.maximum(1e-15,np.linalg.norm(self.norm,axis=1))[:,None]
 def batch(self,P):
  _,idx=self.tree.query(P,k=16);Q=closest_point(self.tri[idx.ravel()],np.repeat(P,16,0));d=np.linalg.norm(Q-np.repeat(P,16,0),axis=1).reshape(-1,16);upper=d.min(1)
  candidates=self.tree.query_ball_point(P,upper+self.max_radius+1e-10);n=np.array([len(i) for i in candidates]);rows=np.repeat(np.arange(len(P)),n);cols=np.concatenate(candidates);Q=closest_point(self.tri[cols],P[rows]);delta=P[rows]-Q;dd=np.linalg.norm(delta,axis=1);result=np.empty(len(P));c=0
  for i,nn in enumerate(n):
   j=c+np.argmin(dd[c:c+nn]);result[i]=dd[j]*np.sign(np.dot(delta[j],self.norm[cols[j]]));c+=nn
  return result
 def query(self,P):return np.concatenate([self.batch(q) for q in np.array_split(P,max(1,int(np.ceil(len(P)/256))))])
def summary(d):return {'samples':len(d),'minimumSignedMM':float(d.min()*1000),'medianSignedMM':float(np.median(d)*1000),'maximumSignedMM':float(d.max()*1000),'negativeOverTolerance':int((d<-.0001).sum())}
def run(kind):
 out=R/'qa'/kind;report={'scope':'Actual browser-generated default cable hat on three immutable native heads. All inner vertices plus all inner triangle centroids against oriented source-head triangles. This is sampled static geometry, not continuous collision or a physical material test.','checks':[],'heads':[]}
 def check(name,ok,detail=None):
  report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});print(name,bool(ok),flush=True)
  if not ok:raise AssertionError(name)
 try:
  for n,hid in enumerate(['native-default','long_narrow','short_broad']):
   path=out/('cable-inspect.json' if n==0 else 'cable-head-'+str(n)+'-geometry.json');g=json.loads(path.read_text());p=np.array(g['position']).reshape(-1,3);f=np.array(g['index']).reshape(-1,3);inside=np.array(g['inner']).reshape(-1,3)[len(p):];pair=np.linalg.norm(p-inside,axis=1)
   check('real material wall '+hid,float(pair.min())>.00359 and float(pair.max())<.00361,{'minMM':float(pair.min()*1000),'maxMM':float(pair.max()*1000)})
   h=json.loads(gzip.decompress((R.parent/'r03/assets'/('head-'+hid+'.bin')).read_bytes()));decode=lambda x,dtype:np.frombuffer(gzip.decompress(base64.b64decode(x)),dtype=dtype);hp=decode(h['p'],'<f4').reshape(-1,3);hf=decode(h['i'],'<u4').reshape(-1,3);alltri=hp[hf];tri=alltri[alltri[:,:,1].max(1)>-.10];D=TriangleDistance(tri);points=np.concatenate([inside,inside[f].mean(1)]);dist=D.query(points)
   # Excluded lower-body triangles cannot beat these closest points by their Y bound.
   check('head cropping bound '+hid,np.all(abs(dist)<points[:,1]+.10))
   stat=summary(dist);check('inner material outside source head samples '+hid,stat['negativeOverTolerance']==0,stat)
   rec={'head':hid,'headPositionSHA256':hashlib.sha256(hp.tobytes()).hexdigest(),'browserGeometrySHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'innerToHead':stat}
   if n==0:
    wall=TriangleDistance(p[f]).query(inside);check('inner surface does not emerge through outer cap',not np.any(wall>.0001),summary(wall));check('no local paper collapse in measured wall',float(np.min(abs(wall)))>.0024,{'minimumNearestOuterMM':float(np.min(abs(wall))*1000),'medianNearestOuterMM':float(np.median(abs(wall))*1000)});rec['nearestOuter']=summary(wall)
   report['heads'].append(rec)
  report['passed']=True
 except Exception as e:
  report['passed']=False;report['failure']=str(e);raise
 finally:(out/'WALL_DISTANCE_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--kind',default='local');a=p.parse_args();run(a.kind)
