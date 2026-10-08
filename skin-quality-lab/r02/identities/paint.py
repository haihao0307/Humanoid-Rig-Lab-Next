"""Deterministic UV-aware identity painting on the locked R02 reference surface.
No image generation model and no screen-space portrait are used. Colour,
roughness and tangent-space detail are authored separately in metres.
"""
from pathlib import Path
import json, struct, hashlib, math
import numpy as np
from scipy.ndimage import gaussian_filter, distance_transform_edt
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
SIZE=2048
PROFILES={
 'porcelain':dict(seed=218, name='01 · 冷白雀斑',rgb=[.76,.585,.505], rough=.60, beard=0., age=.12, freckles=530, acne=3, brow='slender-copper'),
 'umber':dict(seed=734, name='02 · 深褐短须',rgb=[.355,.225,.165], rough=.55, beard=.52, age=.25, freckles=18, acne=20, brow='broad-notched'),
 'weathered':dict(seed=159, name='03 · 风化熟龄',rgb=[.59,.435,.345], rough=.65, beard=.84, age=.95, freckles=205, acne=3, brow='broken-silver'),
}

def glb_arrays(file):
 b=file.read_bytes(); n=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+n]);off=20+n;size,kind=struct.unpack_from('<II',b,off);binary=b[off+8:off+8+size]
 def a(i):
  x=doc['accessors'][i];v=doc['bufferViews'][x['bufferView']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[x['type']];dt=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2'}[x['componentType']]);return np.ndarray((x['count'],k),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+x.get('byteOffset',0),strides=(v.get('byteStride',k*dt.itemsize),dt.itemsize)).copy()
 p=doc['meshes'][0]['primitives'][0];return a(p['attributes']['POSITION'])*.04,a(p['attributes']['NORMAL']),a(p['attributes']['TEXCOORD_0']),a(p['indices']).reshape(-1,3)

def raster(positions,normals,uv,tri,size):
 xyz=np.zeros((size,size,3),np.float32); ns=np.zeros_like(xyz);valid=np.zeros((size,size),bool)
 q=uv*np.array([size-1,-(size-1)],np.float32)+np.array([0,size-1],np.float32)
 for ids in tri:
  t=q[ids];mn=np.maximum(0,np.floor(t.min(0)).astype(int));mx=np.minimum(size-1,np.ceil(t.max(0)).astype(int));
  if (mn>mx).any():continue
  xx,yy=np.meshgrid(np.arange(mn[0],mx[0]+1,dtype=np.float32),np.arange(mn[1],mx[1]+1,dtype=np.float32));a,b,c=t
  den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if abs(den)<1e-7:continue
  w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w2=1-w0-w1;m=(w0>=-1e-5)&(w1>=-1e-5)&(w2>=-1e-5);sl=np.s_[mn[1]:mx[1]+1,mn[0]:mx[0]+1]
  for out,arr in [(xyz,positions),(ns,normals)]:
   val=w0[...,None]*arr[ids[0]]+w1[...,None]*arr[ids[1]]+w2[...,None]*arr[ids[2]];out[sl][m]=val[m]
  valid[sl]|=m
 # Padding is generated from the same UV island boundary, not black seams.
 near=distance_transform_edt(~valid,return_distances=False,return_indices=True)
 xyz=xyz[tuple(near)];ns=ns[tuple(near)];ns/=np.maximum(np.linalg.norm(ns,axis=-1,keepdims=True),1e-6)
 return xyz,ns,valid,near

def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def gauss(x,y,cx,cy,sx,sy):return np.exp(-.5*(((x-cx)/sx)**2+((y-cy)/sy)**2))
def image(path,size=SIZE):return np.asarray(Image.open(path).convert('RGB').resize((size,size),Image.Resampling.LANCZOS),np.float32)/255

def noise3(x,y,z,seed,frequency=1):
 # Non-periodic superposition with incommensurate directions; bound to surface,
 # not texture-UV pixel noise, so seams share identical values.
 rng=np.random.default_rng(seed);out=np.zeros_like(x)
 for i in range(6):
  d=rng.normal(size=3);d/=np.linalg.norm(d);phase=rng.uniform(-10,10);f=frequency*(1+i*.43)
  out+=np.sin((x*d[0]+y*d[1]+z*d[2])*f+phase)/(3+i)
 return out

def write_rgb(path,array,quality=96):
 Image.fromarray(np.uint8(np.clip(array,0,1)*255+.5)).save(path,quality=quality,method=6)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def source_brow_mask(base):
 # The scan has asymmetric brows. The polygons only isolate each source-atlas
 # search region; actual hair coverage is extracted from local colour contrast.
 polygons=[[(1450,1190),(1490,1120),(1600,1020),(1700,980),(1860,985),(1970,1030),(2000,1140),(1880,1150),(1770,1120),(1660,1140),(1530,1240),(1440,1270)],[(2110,1030),(2220,980),(2400,985),(2530,1040),(2640,1160),(2640,1230),(2520,1190),(2390,1130),(2240,1140),(2130,1170)]]
 canvas=Image.new('L',(SIZE,SIZE),0);draw=ImageDraw.Draw(canvas)
 for poly in polygons:draw.polygon([(x*SIZE/4096,y*SIZE/4096) for x,y in poly],fill=255)
 gate=np.asarray(canvas,dtype=np.float32)/255
 lum=base@np.array([.2126,.7152,.0722],np.float32)
 low=gaussian_filter(lum,1.4);background=gaussian_filter(lum,20)
 darkness=np.clip((background-low-.008)/.11,0,1)
 # Soft anatomical patch, not a disconnected collection of individual black dots.
 from scipy.ndimage import maximum_filter, binary_fill_holes
 core=(maximum_filter(darkness,size=9)>.22)&(gate>.5)
 core=binary_fill_holes(core);mask=gaussian_filter(core.astype(np.float32),3.5)*gaussian_filter(gate,2.0)
 return np.clip(mask,0,1)

def main():
 dst=ROOT/'assets'/'identities';dst.mkdir(parents=True,exist_ok=True)
 pos,nor,uv,tri=glb_arrays(ROOT.parent/'r01/assets/head.glb');xyz,ns,valid,nearest=raster(pos,nor,uv,tri,SIZE)
 x,y,z=xyz.transpose(2,0,1);ax=np.abs(x);front=smooth(-.012,.05,z);neck=1-smooth(-.049,-.024,y)
 base=image(ROOT.parent/'r01/assets/hires/albedo-4k.jpg');baseN=image(ROOT.parent/'r01/assets/normal.jpg')*2-1
 originalSpec=image(ROOT.parent/'r01/assets/specular.jpg')[:,:,0]
 rootBrows=source_brow_mask(base)
 from scipy.ndimage import maximum_filter
 clearBrows=np.clip(gaussian_filter(maximum_filter(rootBrows,size=25),5.0)*1.15,0,1)
 # Transfer nearby measured forehead skin detail, rather than painting a flat
 # opaque swatch over the baked eyebrows. The original scan remains untouched.
 rows=np.maximum(0,np.arange(SIZE)-round(SIZE*.06));base=base*(1-clearBrows[...,None])+base[rows]*clearBrows[...,None]
 baseN=baseN*(1-clearBrows[...,None])+baseN[rows]*clearBrows[...,None]
 # Only the colour's high frequencies are inherited in exposed skin. Baked
 # original stubble and eyebrows are explicitly excluded before painting.
 beard=(1-smooth(.027,.047,y))*(1-smooth(.059,.076,ax))*front*(1-neck)
 moustache=gauss(x,y,0,.026,.024,.0048)*front
 brows=clearBrows
 hairRemove=np.clip(beard+1.1*moustache,0,1)
 lip=gauss(x,y,0,.019,.025,.0035)*front
 nostril=(gauss(x,y,.012,.033,.006,.0035)+gauss(x,y,-.012,.033,.006,.0035))*front
 eye=(gauss(x,y,.032,.066,.024,.006)+gauss(x,y,-.032,.066,.024,.006))*front
 cheeks=(gauss(x,y,.043,.041,.021,.027)+gauss(x,y,-.043,.041,.021,.027))*front
 eyelids=(gauss(x,y,.033,.060,.025,.007)+gauss(x,y,-.033,.060,.025,.007))*front
 sourceLum=np.maximum(base@np.array([.2126,.7152,.0722],np.float32),.025)
 blur=gaussian_filter(sourceLum,10);hi=np.clip(sourceLum/np.maximum(blur,.04),.80,1.22)
 lower=gaussian_filter(base,(8,8,0));sourceChroma=base/np.maximum(sourceLum[...,None],.025)
 sourceChroma=1+(sourceChroma/np.array([1.29,.925,.75])-1)*.30
 manifest={'schema':'kaopu/skin-identities@2','basis':'R02.1 scan and R02 split-band detail; independently painted identity maps','baselineCommit':'1d4a616672f2a45e869d4ef3e36e710b11f5cf41','resolution':[SIZE,SIZE],'sourceMeshSHA256':digest(ROOT.parent/'r01/assets/head.glb'),'geometryChanged':'weathered: authored reversible age morph; other identities: neutral scan','featureChannels':['source-brow-root-region','source-brow-detail-replacement-region','height'],'profiles':{}}
 for ident,p in PROFILES.items():
  out=dst/ident;out.mkdir(exist_ok=True);rng=np.random.default_rng(p['seed'])
  colour=np.empty_like(base);colour[:]=p['rgb']
  broad=noise3(x,y,z,p['seed'],95);mid=noise3(x,y,z,p['seed']+1,450)
  colour*= (1+broad*.045+mid*.018)[...,None]
  # Retain measured colour micro-variation outside removed source facial hair.
  colour*= (1+(hi-1)*(1-hairRemove*.97))[...,None]
  colour*= sourceChroma*(1-hairRemove[...,None]) + hairRemove[...,None]
  colour*=1+cheeks[...,None]*np.array([.025,-.05,-.035])*(.8 if ident!='umber' else .45)
  colour*=1+eyelids[...,None]*np.array([-.05,-.095,-.07])
  colour*=1+(gauss(x,y,0,.047,.014,.025)*front)[...,None]*np.array([.018,-.028,-.016])
  lipcol=np.array([.62,.29,.28] if ident=='porcelain' else [.31,.135,.125] if ident=='umber' else [.47,.25,.205])
  lipLines=(.8+.2*np.sin(x*7600+y*730+mid*3))*.10
  colour=colour*(1-lip[...,None]*.8)+lipcol*(1-lipLines[...,None])*lip[...,None]*.8
  colour*=1-nostril[...,None]*.47
  colour*=1-eye[...,None]*.03
  h=np.zeros_like(x);pigment=np.zeros_like(x);rough=np.ones_like(x)*p['rough']
  rough+=(.5-originalSpec)*.14+mid*.025
  rough-=gauss(x,y,0,.018,.025,.095)*front*(.12 if ident=='umber' else .035)
  # Seeded individual lesions, each with metric radius and a bounded influence.
  # Sample anatomical 3D surface locations, not an x/y stamp strip. The density
  # has broad cheek/nose exposure plus an irregular low-density forehead/temple tail.
  centers=pos[tri].mean(axis=1);px,py,pz=centers.T;pn=nor[tri,:,].mean(axis=1)[:,2];pax=np.abs(px)
  faceArea=np.linalg.norm(np.cross(pos[tri[:,1]]-pos[tri[:,0]],pos[tri[:,2]]-pos[tri[:,0]]),axis=1)*.5
  exposed=(pn>.12)&(pz>.014)&(py>.005)&(py<.143)&(pax<.085)
  central=(gauss(px,py,.042,.047,.030,.025)+gauss(px,py,-.042,.047,.030,.025))*.40
  bridge=gauss(px,py,0,.059,.017,.022)*.58
  forehead=gauss(px,py,0,.111,.066,.028)*(.47 if ident=='weathered' else .08)
  temples=gauss(pax,py,.068,.077,.016,.050)*.11
  prob=np.maximum(central+bridge+forehead+temples,0)*exposed
  prob*=1-np.clip(gauss(px,py,0,.019,.029,.007),0,1)
  prob*=faceArea;prob/=max(prob.sum(),1e-12)
  spots=[]
  for j in range(p['freckles']):
   k=rng.choice(len(tri),p=prob);ra=np.sqrt(rng.random());rb=rng.random();sx,sy,sz=pos[tri[k,0]]*(1-ra)+pos[tri[k,1]]*ra*(1-rb)+pos[tri[k,2]]*ra*rb
   r=rng.uniform(.00013,.00058) if ident!='weathered' else rng.uniform(.00023,.0010)
   if ident=='weathered' and rng.random()<.055:r*=1.65
   strength=rng.uniform(.045,.22) if ident!='weathered' else rng.uniform(.035,.18)
   angle=rng.uniform(-math.pi,math.pi);aspect=rng.uniform(.57,1.30)
   spots.append((float(sx),float(sy),float(sz),float(r),float(strength)))
   mask=(np.abs(x-sx)<r*3.6)&(np.abs(y-sy)<r*3.6)&(np.abs(z-sz)<r*4)&(front>.1)
   if not mask.any():continue
   xx=x[mask]-sx;yy=y[mask]-sy;zz=z[mask]-sz
   ca,sa=np.cos(angle),np.sin(angle);a=xx*ca-yy*sa;b=xx*sa+yy*ca
   irregular=1+.12*np.sin(a/r*5+angle)+.09*np.sin(b/r*7-angle)
   d=(a/(r*aspect))**2+(b/r)**2+(zz/(r*2.8))**2
   g=np.exp(-.5*d*irregular)*front[mask]*(1-lip[mask])
   pigment[mask]+=g*strength
  colour*=np.exp(-pigment[...,None]*np.array([.60,1.07,1.30]))
  for j in range(p['acne']):
   sx=rng.choice([-1,1])*rng.uniform(.036,.071);sy=rng.uniform(.009,.047);r=rng.uniform(.00035,.00075)
   mask=(np.abs(x-sx)<r*5)&(np.abs(y-sy)<r*5)&(front>.1)
   d=((x[mask]-sx)/r)**2+((y[mask]-sy)/r)**2;halo=np.exp(-d*.13);core=np.exp(-d*.75)
   colour[mask]*=1+halo[:,None]*np.array([.015,-.060,-.045]);h[mask]+=(core*.14-np.exp(-d*1.7)*.06);rough[mask]+=.06*halo
  # Creases are continuous in object metres; different height AND colour maps.
  age=p['age'];wrinkles=np.zeros_like(x)
  for j in range(4):
   line=.104+j*.0085+.0018*np.cos(x*52+j*.7)+.0008*np.sin(x*155+j)
   g=np.exp(-((y-line)/(.00022+j*.000025))**2)*np.exp(-(x/.062)**6)*front
   wrinkles+=g*age*(.64-j*.08)
  for side in [-1,1]:
   for j in range(4):
    xx=(x-side*.050)*side;yy=y-(.061-j*.0025);direction=-.28-j*.21
    across=(yy-xx*direction);g=np.exp(-(across/.00030)**2)*smooth(0,.007,xx)*(1-smooth(.024,.034,xx))*front
    wrinkles+=g*age*.6
   nasoX=side*(.016+(.034-y)*.39);naso=np.exp(-((x-nasoX)/.0009)**2)*smooth(.003,.013,y)*(1-smooth(.031,.039,y))*front
   wrinkles+=naso*age*.35
  h-=wrinkles*.090;colour*=1-wrinkles[...,None]*.055;rough+=wrinkles*.04
  # A healed, non-graphic eyebrow cut interrupts the dark profile's brow.
  scar=np.zeros_like(x)
  if ident=='umber':
   scar=np.exp(-((x-.033-(y-.079)*.25)/.0007)**2)*gauss(x,y,.033,.079,.006,.006)*front
   colour=colour*(1-scar[...,None]*.36)+np.array([.55,.34,.25])*scar[...,None]*.36;h+=scar*.10;rough-=scar*.045
  # Follicles are not screen-space dots. The mesh-bound beard fibres are added
  # in runtime; here only rooted pigment and follicular recesses are painted.
  fol=noise3(x,y,z,p['seed']+31,7600);fol2=noise3(x,y,z,p['seed']+78,13700)
  follicle=np.clip((fol+.5*fol2-.22)*2,0,1)**3
  bmask=np.clip(beard+.75*moustache-lip*1.6,0,1)*p['beard']
  colour*=1-bmask[...,None]*(.022+follicle[...,None]*(.10 if ident=='weathered' else .20))
  h-=follicle*bmask*.05
  if ident=='weathered':rough+=broad*.025
  # Height-derived tangent perturbation modifies the existing base normal only
  # where old facial-hair relief is cleared. R02 meso/micro scan bands remain.
  newN=baseN.copy();newN[:,:,:2]*=(1-hairRemove*.72)[...,None]
  dy,dx=np.gradient(h*.001);pyStep,pxStep=np.gradient(xyz,axis=(0,1));
  metricU=np.maximum(np.linalg.norm(pxStep,axis=-1),.000015);metricV=np.maximum(np.linalg.norm(pyStep,axis=-1),.000015)
  newN[:,:,0]-=np.clip(dx/metricU,-.6,.6)*.65;newN[:,:,1]+=np.clip(dy/metricV,-.6,.6)*.65;newN[:,:,2]=np.maximum(newN[:,:,2],.4)
  newN/=np.maximum(np.linalg.norm(newN,axis=-1,keepdims=True),1e-6)
  # Identity maps are authored at 2K; the measured source scan's 4K
  # meso/micro bands remain separate rather than claiming upsampled detail.
  colour=colour[tuple(nearest)];newN=newN[tuple(nearest)];rough=rough[tuple(nearest)];h=h[tuple(nearest)]
  maps={'albedo':colour,'normal':newN*.5+.5,'roughness':np.repeat(np.clip(rough,0,1)[...,None],3,axis=-1),'features':np.stack([np.clip(rootBrows,0,1),np.clip(clearBrows,0,1),np.clip(.5+h,0,1)],-1)}
  files={}
  for name,data in maps.items():
   file=out/(name+'.webp');write_rgb(file,data,98 if name!='albedo' else 97);files[name]={'file':str(file.relative_to(ROOT)),'sha256':digest(file),'bytes':file.stat().st_size,'resolution':[SIZE,SIZE]}
  manifest['profiles'][ident]={**p,'maps':files,'paintedSpots':len(spots),'nativeScanMesostructureRetained':True}
  print(ident,{k:v['bytes'] for k,v in files.items()},flush=True)
 (dst/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 # Semantic lookup is reusable for mesh-bound eyebrow/beard placement and QA.
 (dst/'profiles.json').write_text(json.dumps(PROFILES,ensure_ascii=False,indent=2))
if __name__=='__main__':main()

