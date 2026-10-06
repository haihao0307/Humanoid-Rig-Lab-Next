"""Reference compiler: graph charts -> sparse hierarchical scalar fields.

Only basis coefficients, trim parameters, bone relationships and motion curves
are written to parameters.json.gz. Source triangles/XYZ/UV/images stay in qa.
"""
from pathlib import Path
import json,numpy as np,gzip,time,hashlib
from PIL import Image
from collections import defaultdict
ROOT=Path(__file__).parent
capture=json.load(open(ROOT/'qa/capture.json'));src=capture['meshes'][0];intake=json.load(open(ROOT/'qa/projection-charts.json'))
P=np.array(intake['positions']);T=np.array(intake['triangles']);inv=np.array(intake['sourceIndex']);scale=intake['scale'];offset=np.array(intake['offset'])
W=np.zeros((len(P),61));skinI=np.array(src['attributes']['skinIndex']['array']).reshape(-1,4).astype(int);skinW=np.array(src['attributes']['skinWeight']['array']).reshape(-1,4)
counts=np.bincount(inv,minlength=len(P))
for k in range(4):np.add.at(W,(inv,skinI[:,k]),skinW[:,k])
W/=counts[:,None];W/=np.maximum(W.sum(axis=1,keepdims=True),1e-12)
uv=np.array(src['attributes']['uv']['array']).reshape(-1,3,2)
folder=next((ROOT/'qa/source-intake').glob('*.fbm'))
def pixels(name):return np.asarray(Image.open(folder/name).convert('RGB'),dtype=np.float64)/255
img=pixels('shirtless_male_model_3d_basecolor.JPEG');rough=pixels('shirtless_male_model_3d_roughness.JPEG');normal=pixels('shirtless_male_model_3d_normal.JPEG');metal=pixels('shirtless_male_model_3d_metallic.JPEG')
def sample(tex,uv):
 h,w=tex.shape[:2];x=np.clip(uv[:,0]*(w-1),0,w-1);y=np.clip((1-uv[:,1])*(h-1),0,h-1);ix=x.astype(int);iy=y.astype(int);jx=np.minimum(ix+1,w-1);jy=np.minimum(iy+1,h-1);a=(x-ix)[:,None];b=(y-iy)[:,None]
 return tex[iy,ix]*(1-a)*(1-b)+tex[iy,jx]*a*(1-b)+tex[jy,ix]*(1-a)*b+tex[jy,jx]*a*b
def basis(q,n):
 a=np.minimum(q*n,n-1e-8);ij=np.floor(a).astype(int);f=a-ij;i=ij[:,0];j=ij[:,1];u=f[:,0];v=f[:,1];ids=np.stack([i*(n+1)+j,(i+1)*(n+1)+j,i*(n+1)+j+1,(i+1)*(n+1)+j+1],axis=1);b=np.stack([(1-u)*(1-v),u*(1-v),(1-u)*v,u*v],axis=1);return ids,b
def fit(q,target,n):
 ids,b=basis(q,n);used=np.unique(ids);lookup=np.zeros((n+1)**2,int);lookup[used]=np.arange(len(used));ids=lookup[ids];size=len(used);channels=target.shape[1]
 def forward(c):return np.sum(c[ids]*b[:,:,None],axis=1)
 def backward(y):
  out=np.zeros((size,channels))
  for k in range(4):np.add.at(out,ids[:,k],y*b[:,k,None])
  return out
 diag=np.zeros(size)
 for k in range(4):np.add.at(diag,ids[:,k],b[:,k]**2)
 regular=.0001
 rhs=backward(target);x=np.zeros_like(rhs);r=rhs.copy();z=r/(diag[:,None]+regular);p=z.copy();rz=(r*z).sum(axis=0)
 for it in range(100):
  Ap=backward(forward(p))+p*regular;alpha=rz/np.maximum((p*Ap).sum(axis=0),1e-25);x+=p*alpha;r-=Ap*alpha;z=r/(diag[:,None]+regular);next_rz=(r*z).sum(axis=0);p=z+p*(next_rz/np.maximum(rz,1e-25));rz=next_rz
  if np.max(np.sqrt(np.maximum(rz,0)))<1e-6:break
 return used,x,forward(x)
def layers(q,target,tol,maxN=128,unit=.00001):
 mean=target.mean(axis=0);residual=target-mean;out=[]
 for n in (2,4,8,16,32,64,128,256):
  if n>maxN or np.max(abs(residual))<=tol:break
  ids,c,pred=fit(q,residual,n);qc=np.rint(c/unit).astype(int);keep=np.any(qc!=0,axis=1)
  out.append({'n':n,'ids':ids[keep].tolist(),'c':qc[keep].ravel().tolist()});residual-=pred
 return {'mean':np.round(mean,8).tolist(),'unit':unit,'channels':target.shape[1],'layers':out},residual
def evaluate(field,q):
 out=np.tile(np.array(field['mean'],dtype=float),(len(q),1));k=field['channels']
 for layer in field['layers']:
  ids,b=basis(q,layer['n']);dense=np.zeros(((layer['n']+1)**2,k));dense[layer['ids']]=np.array(layer['c']).reshape(-1,k)*field['unit'];out+=(dense[ids]*b[:,:,None]).sum(axis=1)
 return out
def graph_sample(q,triangleQ,triangleH):
 result=np.zeros(len(q));found=np.zeros(len(q),bool);closest=np.full(len(q),np.inf)
 for uv,h in zip(triangleQ,triangleH):
  a,b,c=uv;den=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
  if abs(den)<1e-15:continue
  u=((q[:,0]-a[0])*(c[1]-a[1])-(q[:,1]-a[1])*(c[0]-a[0]))/den;v=((b[0]-a[0])*(q[:,1]-a[1])-(b[1]-a[1])*(q[:,0]-a[0]))/den;w=1-u-v;inside=(u>=-1e-10)&(v>=-1e-10)&(w>=-1e-10)
  value=h[0]*w+h[1]*u+h[2]*v;result[inside]=value[inside];found[inside]=True
  # Immediate outside support uses the neighboring triangle's plane. Nodes
  # farther from the domain never contribute to sampled interior cells.
  distances=[]
  for x,y in ((a,b),(b,c),(c,a)):
   delta=y-x;t=np.clip(((q-x)*delta).sum(axis=1)/max(np.dot(delta,delta),1e-20),0,1);distances.append(((q-x-t[:,None]*delta)**2).sum(axis=1))
  distance=np.min(distances,axis=0);better=(~found)&(distance<closest);result[better]=value[better];closest[better]=distance[better]
 return result
def graph_vector_sample(q,triangleQ,triangleValues):
 result=np.zeros((len(q),triangleValues.shape[-1]));found=np.zeros(len(q),bool);closest=np.full(len(q),np.inf)
 for uv,values in zip(triangleQ,triangleValues):
  a,b,c=uv;den=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
  if abs(den)<1e-15:continue
  u=((q[:,0]-a[0])*(c[1]-a[1])-(q[:,1]-a[1])*(c[0]-a[0]))/den;v=((b[0]-a[0])*(q[:,1]-a[1])-(b[1]-a[1])*(q[:,0]-a[0]))/den;w=1-u-v;inside=(u>=-1e-10)&(v>=-1e-10)&(w>=-1e-10);bary=np.column_stack([w,u,v]);result[inside]=(bary@values)[inside];found[inside]=True
  distance=np.full(len(q),np.inf);nearest=np.zeros((len(q),3))
  for j,(x,y) in enumerate(((a,b),(b,c),(c,a))):
   delta=y-x;t=np.clip(((q-x)*delta).sum(axis=1)/max(np.dot(delta,delta),1e-20),0,1);e=((q-x-t[:,None]*delta)**2).sum(axis=1);better=e<distance;distance[better]=e[better];nearest[better]=0;nearest[better,j]=1-t[better];nearest[better,(j+1)%3]=t[better]
  better=(~found)&(distance<closest);result[better]=(nearest@values)[better];closest[better]=distance[better]
 return result
def domain_nodes(triangleQ,n):
 mask=np.zeros((n+1)**2,bool)
 for uv in triangleQ:
  lo=np.clip(np.floor(uv.min(axis=0)*n).astype(int),0,n-1);hi=np.clip(np.floor(uv.max(axis=0)*n).astype(int),0,n-1);ii,jj=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1),indexing='ij');cells=np.column_stack([ii.ravel(),jj.ravel()]);centers=(cells+.5)/n;keep=np.ones(len(cells),bool);aa,bb,cc=uv;sign=np.sign((bb[0]-aa[0])*(cc[1]-aa[1])-(bb[1]-aa[1])*(cc[0]-aa[0]))
  for j in range(3):
   a=uv[j];b=uv[(j+1)%3];e=b-a;s=sign*(e[0]*(centers[:,1]-a[1])-e[1]*(centers[:,0]-a[0]));keep&=s+(abs(e[0])+abs(e[1]))/(2*n)>=-1e-10
  cells=cells[keep];at=cells[:,0]*(n+1)+cells[:,1]
  for off in (0,1,n+1,n+2):mask[at+off]=True
 return np.where(mask)[0]
def graph_weight_layers(q,target,triangleQ,triangleValues):
 field={'mean':target.mean(axis=0).tolist(),'unit':1/4096,'channels':target.shape[1],'layers':[]};residual=target-evaluate(field,q)
 for n in (2,4,8,16,32,64,128):
  if abs(residual).max()<.015:break
  ids=domain_nodes(triangleQ,n);nodeQ=np.column_stack([ids//(n+1),ids%(n+1)])/n;sampled=graph_vector_sample(nodeQ,triangleQ,triangleValues);c=np.rint((sampled-evaluate(field,nodeQ))/field['unit']).astype(int);floor=0 if n<=4 else 10;keep=np.any(abs(c)>floor,axis=1);field['layers'].append({'n':n,'ids':ids[keep].tolist(),'c':c[keep].ravel().tolist()});residual=target-evaluate(field,q)
 return field,residual
def graph_layers(q,target,triangleQ,triangleH,linear,tol=.00045,maxN=64):
 extent=np.ptp(triangleQ.reshape(-1,2),axis=0)
 field={'mean':[0],'unit':.00001,'channels':1,'layers':[]};residual=target.copy()
 for n in (2,4,8,16,32,64,128,256):
  if n>maxN:break
  if abs(residual).max()<tol:break
  ids=domain_nodes(triangleQ,n);nodeQ=np.column_stack([ids//(n+1),ids%(n+1)])/n
  h=graph_sample(nodeQ,triangleQ,triangleH)-(linear[0]+linear[1]*nodeQ[:,0]+linear[2]*nodeQ[:,1]);c=np.rint((h-evaluate(field,nodeQ)[:,0])/field['unit']).astype(int);keep=abs(c)>=2
  field['layers'].append({'n':n,'ids':ids[keep].tolist(),'c':c[keep].tolist()});residual=target-evaluate(field,q)
 return field,residual
def add_local_corrections(field,q,residual,extent,tol=.0005):
 knots=[];r=residual[:,0].copy();physical=q*extent
 for step in range(600):
  idx=int(np.argmax(abs(r)));amplitude=float(r[idx])
  if abs(amplitude)<=tol:break
  distances=np.linalg.norm(physical-physical[idx],axis=1);opposite=(r*amplitude<0)&(abs(r)>.00015)&(distances>1e-10)
  radius=max(float(max(extent))/64*.8,.0001)
  if opposite.any():radius=min(radius,max(.00002,float(distances[opposite].min())*.7))
  t=np.clip(distances/radius,0,1);phi=(1-t)**4*(4*t+1);coefficient=round(amplitude/field['unit']);r-=coefficient*field['unit']*phi;knots.append([round(float(q[idx,0]),8),round(float(q[idx,1]),8),round(radius,8),coefficient])
 field['metric']=extent.tolist();field['knots']=knots
 return r[:,None]
charts=[];errors=[];coefs=0;started=time.time();captured=0
# All corners, all three edge midpoints and every face centroid are sampled.
barys=np.array([[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3,1/3,1/3]])
for chartId,ch in enumerate(intake['charts']):
 ts=np.array(ch['triangles']);verts=np.array(ch['vertices']);plane=ch['plane'];axis=ch['axis'];triP=P[T[ts]]
 xyz=np.einsum('kc,tcd->tkd',barys,triP).reshape(-1,3); texUV=np.einsum('kc,tcd->tkd',barys,uv[ts]).reshape(-1,2);captured+=len(xyz)
 q=xyz[:,plane];lo=q.min(axis=0);extent=np.maximum(q.max(axis=0)-lo,1e-8);q=(q-lo)/extent
 linear=np.linalg.lstsq(np.column_stack([np.ones(len(q)),q]),xyz[:,axis],rcond=None)[0];height=(xyz[:,axis]-np.column_stack([np.ones(len(q)),q])@linear)[:,None]
 triangleQ=(triP[:,:,plane]-lo)/extent
 field,err=graph_layers(q,height,triangleQ,triP[:,:,axis],linear,maxN=256 if ch['anatomy']=='head' else 64);err=add_local_corrections(field,q,err,extent);errors.extend(abs(err[:,0]).tolist())
 ws=np.einsum('kc,tcd->tkd',barys,W[T[ts]]).reshape(-1,61);bones=np.where(ws.max(axis=0)>.00001)[0];weights,werr=graph_weight_layers(q,ws[:,bones],triangleQ,W[T[ts]][:,:,bones])
 # Sample every texture channel as continuous fields; source images are excluded.
 color=sample(img,texUV);appearance=np.column_stack([color,sample(rough,texUV)[:,0],sample(metal,texUV)[:,0]])
 appearanceField,cerr=layers(q,appearance,.09,16,1/256)
 rawNormals=np.array(src['attributes']['normal']['array']).reshape(-1,3,3)[ts];normalMatrix=np.array(src['matrix']).reshape(4,4).T[:3,:3];sampleNormals=np.einsum('kc,tcd->tkd',barys,rawNormals).reshape(-1,3)@normalMatrix.T;sampleNormals/=np.maximum(np.linalg.norm(sampleNormals,axis=1,keepdims=True),1e-12);normalField,nerr=layers(q,sampleNormals,.055,16,1/512)
 # Mean tangent-normal relief contributes procedural roughness; no baked normal map.
 normSample=sample(normal,texUV);relief=float(np.mean(np.linalg.norm(normSample[:,:2]-.5,axis=1)))
 # Directed trim parameter loops. Shared source boundary vertices receive compact
 # seam identifiers, never source XYZ data or triangle connectivity.
 edgeDict=defaultdict(list)
 for a,b in ch['boundary']:edgeDict[a].append(b)
 loops=[]
 while edgeDict:
  first=next(iter(edgeDict));current=first;loop=[]
  for _ in range(len(ch['boundary'])+1):
   loop.append(current)
   if current not in edgeDict:break
   nxt=edgeDict[current].pop()
   if not edgeDict[current]:del edgeDict[current]
   current=nxt
   if current==first:break
  if len(loop)>=3:loops.append(loop)
 trim=[]
 for loop in loops:
  params=(P[loop][:,plane]-lo)/extent;trim.append({'seams':loop,'uv':np.rint(params*1000000).astype(int).ravel().tolist()})
 charts.append({'id':chartId,'axis':axis,'sign':ch['sign'],'plane':plane,'anatomy':ch['anatomy'],'lo':np.round(lo,9).tolist(),'extent':np.round(extent,9).tolist(),'linear':np.round(linear,9).tolist(),'height':field,'bones':bones.tolist(),'weights':weights,'appearance':appearanceField,'normals':normalField,'relief':round(relief,5),'trim':trim,'area':round(float(np.linalg.norm(np.cross(triP[:,1]-triP[:,0],triP[:,2]-triP[:,0]),axis=1).sum()/2),7),'sourceFaces':len(ts),'maxFitError':round(float(abs(err).max()),8)})
 if chartId%20==0:print('fitted',chartId,'of',len(intake['charts']),'seconds',round(time.time()-started,1),flush=True)
# Retain exactly the authored node transforms, bind frames and normalized curves.
nodes=capture['nodes'];names={n['uuid']:n['name'] for n in nodes};boneNodes=[n for n in nodes if n['type']=='Bone'];rig=[]
for n in boneNodes:rig.append({k:v for k,v in {'name':n['name'],'parent':names.get(n.get('parent')),'p':n['position'],'q':n['quaternion'],'s':n['scale']}.items()})
arm=next(n for n in nodes if n['name']=='Armature')
def reduce_track(track):
 t=np.array(track['times']);dim=len(track['values'])//len(t);v=np.array(track['values']).reshape(-1,dim)
 if track['type']=='quaternion':
  for i in range(1,len(v)):
   if np.dot(v[i],v[i-1])<0:v[i]*=-1
  tolerance=.0001
 else:tolerance=.00002
 keep={0,len(t)-1};stack=[(0,len(t)-1)]
 while stack:
  a,b=stack.pop()
  if b<=a+1:continue
  f=((t[a+1:b]-t[a])/(t[b]-t[a]))[:,None];pred=v[a]*(1-f)+v[b]*f
  if dim==4:pred/=np.maximum(np.linalg.norm(pred,axis=1,keepdims=True),1e-12)
  err=np.max(abs(v[a+1:b]-pred),axis=1);i=int(np.argmax(err))+a+1
  if err.max()>tolerance:keep.add(i);stack.extend([(a,i),(i,b)])
 ids=sorted(keep)
 return {'name':track['name'],'type':track['type'],'times':np.round(t[ids],7).tolist(),'values':np.round(v[ids],7).ravel().tolist(),'interpolation':track['interpolation']}
anims=[{'name':a['name'],'duration':a['duration'],'tracks':[reduce_track(t) for t in a['tracks']]} for a in capture['animations']]
data={'schema':'parametric-human-fields/v1','source':{'zipSHA256':hashlib.sha256(Path('C:/Users/Administrator/Downloads/shirtless+male+model+3d (1).zip').read_bytes()).hexdigest(),'faces':len(T),'drawVertices':len(inv),'uniquePositions':len(P),'bones':len(rig),'clips':len(anims),'samples':captured},'scale':scale,'offset':offset.tolist(),'armature':{'p':arm['position'],'q':arm['quaternion'],'s':arm['scale']},'rig':rig,'boneOrder':[names[x] for x in src['skeleton']['bones']],'bind':src['skeleton']['bindMatrix'],'inverses':src['skeleton']['inverses'],'animations':anims,'charts':charts,'controls':{'heightMetres':1.8,'detail':1,'muscle':0,'skinRoughness':1}}
raw=json.dumps(data,separators=(',',':')).encode();compressed=gzip.compress(raw,compresslevel=9,mtime=0);(ROOT/'qa/coefficients.json.gz').write_bytes(compressed)
report={'source':data['source'],'charts':len(charts),'parametersBytes':len(compressed),'decodedBytes':len(raw),'referenceZipBytes':9293736,'reductionPercent':round((1-len(compressed)/9293736)*100,2),'surfaceFitMetres':{'mean':float(np.mean(errors)),'rms':float(np.sqrt(np.mean(np.square(errors)))),'p95':float(np.quantile(errors,.95)),'max':float(np.max(errors))},'sourceFilesInRuntime':False,'visualAccepted':False,'elapsedSeconds':time.time()-started,'method':'trimmed projection graphs, sparse multilevel bilinear residual basis; authored bone transforms; simplified animation curves'}
json.dump(report,open(ROOT/'fit-report.json','w'),indent=2);print(json.dumps(report),flush=True)
