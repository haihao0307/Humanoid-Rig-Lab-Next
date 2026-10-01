"""Offline intake: continuous UV surface bases, material wavelets, transferred skin fields."""
import sys,json,gzip,time,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'qa/python-deps'))
import numpy as np
from scipy.spatial import cKDTree,Delaunay,QhullError
from scipy.interpolate import LinearNDInterpolator
from PIL import Image
started=time.time();source=json.load(open(ROOT/'qa/capture.json'));rig=json.load(open(ROOT/'qa/rig-source.json'));template=json.load(open(ROOT/'qa/rig-samples.json'))
refP=np.array(template['positions']).reshape(-1,3);refI=np.array(template['ids']).reshape(-1,8);refW=np.array(template['weights']).reshape(-1,8);tree=cKDTree(refP)
scale=1.8/(source['bbox'][4]-source['bbox'][1]);offset=np.array([0,-source['bbox'][1]*scale,0]);folder=next((ROOT/'qa/source-intake').glob('*.fbm'))
def transfer(p):
 dist,ids=tree.query(p,k=4,workers=1);influence=1/np.maximum(dist,1e-5)**2;influence/=influence.sum(axis=1,keepdims=True);out=np.zeros((len(p),61));row=np.arange(len(p))
 for j in range(4):
  for k in range(8):np.add.at(out,(row,refI[ids[:,j],k]),refW[ids[:,j],k]*influence[:,j])
 return out
def eval_field(f,q):
 k=f['channels'];out=np.tile(f['mean'],(len(q),1)).astype(float)
 for l in f['layers']:
  n=l['n'];xy=np.minimum(np.maximum(q*n,0),n-1e-9);ij=np.floor(xy).astype(int);a=xy-ij;i,j=ij.T;u,v=a.T;ids=np.stack([i*(n+1)+j,(i+1)*(n+1)+j,i*(n+1)+j+1,(i+1)*(n+1)+j+1],1);w=np.stack([(1-u)*(1-v),u*(1-v),(1-u)*v,u*v],1);dense=np.zeros(((n+1)**2,k));dense[l['ids']]=np.array(l['c']).reshape(-1,k)*f['unit'];out+=(dense[ids]*w[:,:,None]).sum(axis=1)
 return out
def grid_field(q,target,fn,tol,maxn,unit):
 f={'channels':target.shape[1],'mean':target.mean(axis=0).tolist(),'unit':unit,'layers':[]};error=target-eval_field(f,q)
 for n in (4,8,16,32,64,128,256):
  if n>maxn or np.quantile(np.linalg.norm(error,axis=1),.995)<tol:break
  xy=np.floor(np.minimum(q*n,n-1e-8)).astype(int);ids=np.unique(np.concatenate([xy[:,0]*(n+1)+xy[:,1]+off for off in (0,1,n+1,n+2)]));nodes=np.column_stack([ids//(n+1),ids%(n+1)])/n
  c=np.rint((fn(nodes)-eval_field(f,nodes))/unit).astype(int);keep=np.any(c!=0,axis=1);f['layers'].append({'n':n,'ids':ids[keep].tolist(),'c':c[keep].ravel().tolist()});error=target-eval_field(f,q)
 return f,error
def interpolator(q,values,extrapolate=False):
 kd=cKDTree(q)
 try:fn=LinearNDInterpolator(Delaunay(q),values)
 except QhullError:fn=None
 affine=np.linalg.lstsq(np.column_stack([np.ones(len(q)),q]),values,rcond=None)[0]
 def sample(x):
  result=fn(x) if fn else np.column_stack([np.ones(len(x)),x])@affine;bad=~np.isfinite(result).all(axis=1)
  if bad.any():
   _,ids=kd.query(x[bad],k=min(8,len(q)));ids=np.asarray(ids).reshape(bad.sum(),-1)
   if extrapolate and len(q)>=3:
    near=q[ids]-x[bad,None,:];A=np.concatenate([np.ones((*near.shape[:2],1)),near],axis=2);coef=np.linalg.pinv(A)@values[ids];result[bad]=coef[:,0]
   else:result[bad]=values[ids[:,0]]
  return result
 return sample
def haar(image):
 a=np.array(image,dtype=np.int32);n=a.shape[0];size=n
 while size>1:
  block=a[:size,:size].copy();diff=block[:,1::2]-block[:,::2];low=block[:,::2]+np.floor_divide(diff,2);block=np.concatenate([low,diff],axis=1);diff=block[1::2]-block[::2];low=block[::2]+np.floor_divide(diff,2);a[:size,:size]=np.concatenate([low,diff],axis=0);size//=2
 return {'size':n,'channels':a.shape[2],'c':a.ravel().tolist()}
materials=[];charts=[];errors=[];normalErrors=[];seams={};uvConflicts=[];referenceFaces=0;openLoops=0
for part,m in enumerate(source['meshes']):
 name=m['name'];M=np.array(m['matrix']).reshape(4,4).T;raw=np.array(m['attributes']['position']['array']).reshape(-1,3);p=(raw@M[:3,:3].T+M[:3,3])*scale+offset;normal=np.array(m['attributes']['normal']['array']).reshape(-1,3)@np.linalg.inv(M[:3,:3]);normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12);uv=np.array(m['attributes']['uv']['array']).reshape(-1,2)
 tu=uv.reshape(-1,3,2);aa=tu[:,1]-tu[:,0];bb=tu[:,2]-tu[:,0];orientation=np.repeat((aa[:,0]*bb[:,1]-aa[:,1]*bb[:,0])<0,3);keys=np.column_stack([np.round(uv,8),np.round(p,8),orientation]);unique,inv=np.unique(keys,axis=0,return_inverse=True);U=unique[:,:2];P=np.zeros((len(U),3));N=P.copy();counts=np.bincount(inv)
 for k in range(3):np.add.at(P[:,k],inv,p[:,k]);np.add.at(N[:,k],inv,normal[:,k])
 P/=counts[:,None];N/=counts[:,None];conflict=np.linalg.norm(p-P[inv],axis=1).max();uvConflicts.append(float(conflict))
 if conflict>.0001:raise ValueError('Overlapping UV domain in '+name)
 T=inv.reshape(-1,3);referenceFaces+=len(T);allEdges=np.sort(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]),axis=1);edges,countsE=np.unique(allEdges,axis=0,return_counts=True);parent=np.arange(len(U))
 def find(a):
  while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
  return a
 for a,b in edges:
  x,y=find(a),find(b)
  if x!=y:parent[y]=x
 component=np.array([find(i) for i in range(len(U))]);faceComponent=component[T[:,0]];W=transfer(P)
 for comp in np.unique(faceComponent):
  ts=np.where(faceComponent==comp)[0];ids=np.unique(T[ts]);uc=U[ids];pc=P[ids];originalUV=uc.copy();domainU=U
  if len(ts)<=6:
   faceP=P[T[ts]];fn=np.cross(faceP[:,1]-faceP[:,0],faceP[:,2]-faceP[:,0]);axis=int(np.argmax(np.abs(fn.sum(axis=0))));plane=[k for k in range(3) if k!=axis];domainU=U.copy();domainU[ids]=pc[:,plane];uc=domainU[ids]
  lo=uc.min(axis=0);extent=np.maximum(uc.max(axis=0)-lo,1e-10);q=(uc-lo)/extent;linear=np.linalg.lstsq(np.column_stack([np.ones(len(q)),q]),pc,rcond=None)[0];residual=pc-np.column_stack([np.ones(len(q)),q])@linear
  shapeFn=interpolator(q,residual,True);field,err=grid_field(q,residual,shapeFn,.00012,128,2e-5)
  weights=W[ids];bones=np.where(weights.max(axis=0)>1e-6)[0];weights=weights[:,bones]
  def weightFn(x):
   pp=np.column_stack([np.ones(len(x)),x])@linear+shapeFn(x);return transfer(pp)[:,bones]
  wf,we=grid_field(q,weights,weightFn,.012,32,1/4096)
  nf,ne=grid_field(q,N[ids],interpolator(q,N[ids]),.025,64,1/4096)
  # UV trim loops, with global physical seam identities. No XYZ/triangle arrays are retained.
  localT=T[ts].copy();a=domainU[localT[:,1]]-domainU[localT[:,0]];b=domainU[localT[:,2]]-domainU[localT[:,0]];cross=a[:,0]*b[:,1]-a[:,1]*b[:,0];negative=cross<0;localT[negative]=localT[negative][:,[0,2,1]]
  oriented=np.concatenate([localT[:,[0,1]],localT[:,[1,2]],localT[:,[2,0]]]);net={}
  for a,b in oriented:
   key=(int(min(a,b)),int(max(a,b)));net[key]=net.get(key,0)+(1 if a<b else -1)
  boundary=np.array([(a,b) if count>0 else (b,a) for (a,b),count in net.items() for _ in range(abs(count))],dtype=int).reshape(-1,2);edgeDict={}
  for a,b in boundary:edgeDict.setdefault(int(a),[]).append(int(b))
  trim=[]
  while edgeDict:
   start=next(iter(edgeDict));cur=start;loop=[]
   for _ in range(len(boundary)+1):
    loop.append(cur)
    if cur not in edgeDict:openLoops+=1;break
    curNext=edgeDict[cur].pop()
    if not edgeDict[cur]:del edgeDict[cur]
    cur=curNext
    if cur==start:break
   if len(loop)<3:continue
   seamIds=[]
   for i in loop:
    key=tuple(np.rint(P[i]*1e6).astype(int))
    if key not in seams:seams[key]=len(seams)
    seamIds.append(seams[key])
   trim.append({'uv':np.rint((domainU[loop]-lo)/extent*1e6).astype(int).ravel().tolist(),'seams':seamIds})
  if not trim:continue
  tq=(domainU[T[ts]].mean(axis=1)-lo)/extent;tp=P[T[ts]].mean(axis=1);pred=np.column_stack([np.ones(len(tq)),tq])@linear+eval_field(field,tq);heldError=np.linalg.norm(pred-tp,axis=1);errors.extend(heldError.tolist());normalErrors.extend(np.linalg.norm(ne,axis=1).tolist())
  charts.append({'id':len(charts),'part':part,'uvSign':-1 if cross[0]<0 else 1,'textureLinear':np.linalg.lstsq(np.column_stack([np.ones(len(q)),q]),originalUV,rcond=None)[0].ravel().tolist(),'anatomy':name,'lo':lo.tolist(),'extent':extent.tolist(),'linear':linear.ravel().tolist(),'shape':field,'bones':bones.tolist(),'weights':wf,'normals':nf,'trim':trim,'sourceFaces':len(ts),'maxFitError':float(np.linalg.norm(err,axis=1).max())})
 stem='human_figure_3d_model_'+name+'_';mat={'name':name}
 for channel in ('basecolor','normal','roughness','metallic'):
  image=Image.open(folder/(stem+channel+'.JPEG')).convert('RGB');mat[channel]=haar(image)
 materials.append(mat);print(json.dumps({'part':part,'name':name,'charts':len(charts),'seconds':round(time.time()-started,1),'maxUVConflict':float(conflict)}),flush=True)
rig['schema']='parametric-human-uv-fields/v2';rig['charts']=charts;rig['materials']=materials;rig['source']={'zipSHA256':hashlib.sha256(Path('C:/Users/Administrator/Downloads/human+figure+3d+model (1).zip').read_bytes()).hexdigest(),'faces':referenceFaces,'parts':len(materials),'bones':61,'clips':4,'samples':len(errors),'sourceRigAbsent':True};rig['binding']={'method':'continuous nearest-surface weight transfer from previous authored rig','referenceRigSHA256':hashlib.sha256((ROOT.parent/'R007/parameters.phf.gz').read_bytes()).hexdigest(),'referenceHeight':1.8,'newHeight':1.8,'referencePose':'inverse-bind','candidate':True}
payload=gzip.compress(json.dumps(rig,separators=(',',':')).encode(),9,mtime=0);(ROOT/'qa/coefficients.json.gz').write_bytes(payload)
report={'source':rig['source'],'charts':len(charts),'openTrimLoops':openLoops,'maxUVConflictMetres':max(uvConflicts),'parametersBytes':len(payload),'referenceZipBytes':33357858,'referenceFilesAtRuntime':False,'geometryCentroidErrorsMetres':{'p95':float(np.quantile(errors,.95)),'p99':float(np.quantile(errors,.99)),'rms':float(np.sqrt(np.mean(np.square(errors)))),'max':max(errors)},'normalFitP95':float(np.quantile(normalErrors,.95)),'materialWavelets':'reversible integer lifting Haar; decoded source RGB samples preserved','visualAccepted':False,'elapsedSeconds':time.time()-started}
json.dump(report,open(ROOT/'fit-report.json','w'),indent=2);print(json.dumps(report),flush=True)
