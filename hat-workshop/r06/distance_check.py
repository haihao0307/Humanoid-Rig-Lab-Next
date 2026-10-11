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
  candidates=self.tree.query_ball_point(P,upper+self.max_radius+1e-10);n=np.array([len(i) for i in candidates]);rows=np.repeat(np.arange(len(P)),n);cols=np.concatenate(candidates);possible=(np.linalg.norm(self.centers[cols]-P[rows],axis=1)-self.radius[cols]<=upper[rows]+1e-9);rows=rows[possible];cols=cols[possible];n=np.bincount(rows,minlength=len(P));Q=closest_point(self.tri[cols],P[rows]);delta=P[rows]-Q;dd=np.linalg.norm(delta,axis=1);result=np.empty(len(P));c=0
  for i,nn in enumerate(n):
   j=c+np.argmin(dd[c:c+nn]);result[i]=dd[j]*np.sign(np.dot(delta[j],self.norm[cols[j]]));c+=nn
  return result
 def query(self,P):return np.concatenate([self.batch(q) for q in np.array_split(P,max(1,int(np.ceil(len(P)/256))))])
def summary(d):return {'samples':len(d),'minimumSignedMM':float(d.min()*1000),'medianSignedMM':float(np.median(d)*1000),'maximumSignedMM':float(d.max()*1000),'negativeOverTolerance':int((d<-.0001).sum())}
