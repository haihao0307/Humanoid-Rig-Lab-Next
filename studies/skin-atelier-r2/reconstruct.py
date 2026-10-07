"""R2: limited-angle, image-based surface reconstruction.
The input is the exact public reference supplied by the user. This is not an
original procedural character or a recovered production shader. Lighting is
retained in image observations; unseen geometry and independent organs are
not recovered. No new GPU service call or paid resource is created here.
"""
import os, json, gzip, base64, urllib.request
os.environ['OPENBLAS_NUM_THREADS']='2'
import cv2, numpy as np
from pathlib import Path
from scipy import ndimage as ndi
from scipy.sparse import coo_matrix, diags
from scipy.sparse.linalg import cg, LinearOperator
cv2.setNumThreads(2)
root=Path(__file__).resolve().parent
work=root/'_working';work.mkdir(exist_ok=True)
source='https://cdn.artstation.com/p/video_sources/002/676/142/shadowheart-custom-black-double.mp4'
video=work/'reference.mp4'
if not video.exists():
 with urllib.request.urlopen(source,timeout=90) as response:video.write_bytes(response.read())
cap=cv2.VideoCapture(str(video));indices=list(range(60,-1,-4));images=[]
for frame in indices:
 cap.set(cv2.CAP_PROP_POS_FRAMES,frame);ok,im=cap.read()
 if not ok:raise RuntimeError('Source video frame unavailable: '+str(frame))
 images.append(cv2.resize(im,(1280,1280),interpolation=cv2.INTER_AREA))
y,x=np.mgrid[12:1268:4,12:1268:4];shape=x.shape
points=np.stack([x.ravel(),y.ravel()],axis=-1).astype(np.float32)
tracks=[points.copy()];quality=np.ones(len(points),bool)
dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM);dis.setUseSpatialPropagation(True);dis.setFinestScale(0)
prev=cv2.cvtColor(images[0],cv2.COLOR_BGR2GRAY)
def sample(flow,p):return cv2.remap(flow,p[:,0].reshape(shape),p[:,1].reshape(shape),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT).reshape(-1,flow.shape[-1])
for k,im in enumerate(images[1:],1):
 cur=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY);flow=dis.calc(prev,cur,None);back=dis.calc(cur,prev,None)
 nxt=points+sample(flow,points);err=np.linalg.norm(sample(back,nxt)+nxt-points,axis=1)
 quality&=(err<.8)&(nxt[:,0]>3)&(nxt[:,0]<1276)&(nxt[:,1]>3)&(nxt[:,1]<1276)
 tracks.append(nxt.copy());points=nxt;prev=cur
 print('Tracking',k,int(quality.sum()),flush=True)
tracks=np.stack(tracks);p=tracks[0];xx,yy=p.T
fit=quality&(((xx-580)/300)**2+((yy-665)/390)**2<1)&(yy>390)&~(((xx-550)/145)**2+((yy-370)/95)**2<1)
gray=cv2.cvtColor(images[0],cv2.COLOR_BGR2GRAY).astype(float)
var=cv2.GaussianBlur(gray*gray,(0,0),3)-cv2.GaussianBlur(gray,(0,0),3)**2
fit&=cv2.remap(var.astype(np.float32),xx.reshape(shape),yy.reshape(shape),cv2.INTER_LINEAR).ravel()>10
if fit.sum()<300:raise RuntimeError('Insufficient stable camera observations')
W=tracks[:,fit].transpose(0,2,1).reshape(len(images)*2,-1).astype(float);trans=W.mean(axis=1);W-=trans[:,None]
U,s,V=np.linalg.svd(W,full_matrices=False);M=U[:,:3]*np.sqrt(s[:3])
def symrow(a,b):return np.array([a[0]*b[0],a[1]*b[1],a[2]*b[2],a[0]*b[1]+a[1]*b[0],a[0]*b[2]+a[2]*b[0],a[1]*b[2]+a[2]*b[1]])
A=[];B=[]
for k in range(len(images)):
 a,b=M[2*k:2*k+2];A.extend([symrow(a,a),symrow(b,b),symrow(a,b)]);B.extend([1,1,0])
l=np.linalg.lstsq(A,B,rcond=None)[0];L=np.array([[l[0],l[3],l[4]],[l[3],l[1],l[5]],[l[4],l[5],l[2]]]);ev,ec=np.linalg.eigh(L)
if ev.min()<=0:raise RuntimeError('Metric camera upgrade is not positive definite')
Q=ec@np.diag(np.sqrt(ev));R=M@Q;rx=R[0]/np.linalg.norm(R[0]);ry=R[1]-np.dot(R[1],rx)*rx;ry/=np.linalg.norm(ry);rz=np.cross(rx,ry);rot=np.stack([rx,ry,rz]);R=R@rot.T
allxy=tracks.transpose(0,2,1).reshape(len(images)*2,-1).astype(float)-trans[:,None]
S=np.linalg.lstsq(R,allxy,rcond=None)[0];err=np.sqrt(np.mean((R@S-allxy)**2,axis=0))
# Segmentation restricts the visible domain, not its shape.
mask=np.full((1280,1280),cv2.GC_PR_BGD,np.uint8)
poly=np.array([[450,5],[720,8],[854,150],[909,401],[941,686],[908,943],[943,1130],[1268,1257],[8,1257],[16,1190],[270,1100],[386,1060],[397,949],[264,835],[209,634],[165,468],[196,278],[315,102]],np.int32)
cv2.fillPoly(mask,[poly],cv2.GC_PR_FGD)
fg=np.array([[429,126],[648,92],[823,300],[832,532],[769,754],[719,1009],[825,1150],[454,1239],[436,1015],[349,847],[286,674],[258,458],[315,246]],np.int32);cv2.fillPoly(mask,[fg],cv2.GC_FGD)
mask[:,:90]=cv2.GC_BGD;mask[:,1010:]=cv2.GC_BGD;mask[1140:,:90]=cv2.GC_PR_FGD;mask[1140:,1010:]=cv2.GC_PR_FGD
# This matches the full-resolution decoding used in the authoring experiment.
cap.set(cv2.CAP_PROP_POS_FRAMES,60);ok,full=cap.read();assert ok
cv2.grabCut(cv2.resize(full,(1280,1280)),mask,None,np.zeros((1,65)),np.zeros((1,65)),6,cv2.GC_INIT_WITH_MASK)
alpha=((mask==1)|(mask==3)).astype('uint8');alpha=ndi.binary_fill_holes(alpha).astype('uint8');alpha=ndi.binary_closing(alpha,iterations=2).astype('uint8')
ma=cv2.remap(alpha,xx.reshape(shape),yy.reshape(shape),cv2.INTER_NEAREST).ravel()>0
n=len(p);z=np.clip(S[2],-190,320);raw=z.copy();median=ndi.median_filter(z.reshape(shape),size=5).ravel()
confidence=np.exp(-np.minimum(16,err**2)/3)*(quality*.8+.2)*ma*np.where(yy>1020,.22,1);confidence*=np.exp(-((raw-median)/22)**2)
ids=np.arange(n).reshape(shape);aa=[];bb=[]
for dim in [0,1]:
 ia=(slice(None,-1),slice(None)) if dim==0 else (slice(None),slice(None,-1));ib=(slice(1,None),slice(None)) if dim==0 else (slice(None),slice(1,None));aa.append(ids[ia].ravel());bb.append(ids[ib].ravel())
aa=np.concatenate(aa);bb=np.concatenate(bb);degree=np.bincount(np.r_[aa,bb],minlength=n).astype(float)
L=coo_matrix((np.r_[-np.ones(len(aa)*2),degree],(np.r_[aa,bb,np.arange(n)],np.r_[bb,aa,np.arange(n)])),shape=(n,n)).tocsr();w=confidence+.00003;lam=1.6
A=LinearOperator((n,n),matvec=lambda z:w*z+lam*(L@(L@z)),dtype=np.float64);pre=diags(1/(w+lam*(degree**2+degree)))
z,info=cg(A,w*raw,x0=median,M=pre,rtol=1e-5,maxiter=800)
X=(xx-trans[0])/R[0,0];Y=(yy-trans[1]-R[1,0]*X)/R[1,1];P=np.stack([X,Y,z],axis=1)
faces=[]
for j in range(shape[0]-1):
 for i in range(shape[1]-1):
  a=j*shape[1]+i;b=a+1;c=a+shape[1];d=c+1
  if ma[a] and ma[b] and ma[c]:faces.append([a,b,c])
  if ma[b] and ma[d] and ma[c]:faces.append([b,d,c])
faces=np.array(faces,np.uint32);used=np.unique(faces);remap=np.full(n,-1,int);remap[used]=np.arange(len(used));faces=remap[faces].astype('uint32');P=P[used].astype('float32');confidence=confidence[used].astype('float32')
Pw=P*np.array([1,-1,-1],np.float32);e1=Pw[faces[:,1]]-Pw[faces[:,0]];e2=Pw[faces[:,2]]-Pw[faces[:,0]];fn=np.cross(e2,e1);nn=np.zeros_like(Pw)
for k in range(3):np.add.at(nn,faces[:,k],fn)
nn/=np.maximum(1e-5,np.linalg.norm(nn,axis=1))[:,None]
texture_frames=[60,48,36,24,12,0];appearance=[]
for frame in texture_frames:
 cap.set(cv2.CAP_PROP_POS_FRAMES,frame);ok,im=cap.read();assert ok
 ok,enc=cv2.imencode('.jpg',im,[cv2.IMWRITE_JPEG_QUALITY,94]);assert ok
 appearance.append('data:image/jpeg;base64,'+base64.b64encode(enc).decode())
uv=np.array([tracks[indices.index(f),used]/1280 for f in texture_frames],np.float32)
def packed(a):return base64.b64encode(gzip.compress(a.tobytes(),compresslevel=9,mtime=0)).decode()
camera=[{'r':R[k*2:k*2+2].ravel().tolist(),'t':trans[k*2:k*2+2].tolist(),'frame':indices[k]} for k in range(len(indices))]
D={'schema':'kaopu/observed-surface@2','geometryKind':'regularized-multiview-surface','positions':packed(P),'normals':packed(nn),'triangles':packed(faces),'confidence':packed(confidence),'uvs':packed(uv),'camera':camera,'appearanceFrames':texture_frames,'images':appearance,'vertices':len(P),'faces':len(faces),'observations':16,'maxCameraYawDeg':float(np.degrees(np.arctan2(R[-2,2],R[-2,0]))),'originalLightingPreserved':True,'relightable':False,'full360':False,'scale':'uncalibrated relative units','source':source,'credit':'Natallia Sudas / BLU1304 × Symbiote. Reference appearance is not an original production asset or shader.'}
report={k:v for k,v in D.items() if k not in ['positions','normals','triangles','confidence','uvs','images','camera']}
report.update({'surfaceDepthRange':float(np.ptp(P[:,2])),'regularizationConverged':info==0,'fitErrorDescription':'in-sample 2D reprojection error, NOT physical 3D accuracy','rawFitMedianPx':float(np.median(err[quality])),'measuredCameraTracks':int(fit.sum()),'knownMissing':['unseen back of head','independent eye/hair geometry','material/light separation','facial animation','absolute physical scale'],'qualityStatus':'partial reconstruction, NOT final digital-human acceptance'})
(root/'build-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
np.savez_compressed(work/'geometry.npz',positions=P,normals=nn,triangles=faces,confidence=confidence,R=R,translations=trans)
html=(root/'template.html').read_text().replace('__DATA__',json.dumps(D,separators=(',',':'))).replace('__VIEWER__',(root/'viewer.js').read_text())
(root/'observed-surface.html').write_text(html)
print(json.dumps(report,indent=2,ensure_ascii=False));print('HTML bytes',len(html.encode()),flush=True)
