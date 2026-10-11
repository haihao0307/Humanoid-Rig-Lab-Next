"""Frozen-source R02 build. Public: SHA-pinned lazy packages. Standalone: identical embedded assets."""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,re,subprocess,copy
import numpy as np
ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent/'r01'
BASE_SHA='448f503fe17536583e0c64d58123b67ae578f4d0'
BASE_HASH='41cd9a3059ffb66c41e2c7c7badce2eee63ebb07e4ab42facf76cdfd2c707568'
VERSION='HAT-R02.0'
def sha(b):return hashlib.sha256(b).hexdigest()
def encode(a):return base64.b64encode(gzip.compress(np.asarray(a).tobytes(),mtime=0)).decode()
def decode(s,dtype='<f4'):return np.frombuffer(gzip.decompress(base64.b64decode(s)),dtype=dtype)
def pack(o):return gzip.compress(json.dumps(o,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
def read_base():
 b=(OLD/'index.html').read_bytes()
 if sha(b)!=BASE_HASH:raise ValueError('Frozen R01 bytes changed; refusing to substitute a baseline')
 s=b.decode();text=re.search(r'<div id="payload" hidden>(.*?)</div>',s,re.S).group(1)
 return json.loads(gzip.decompress(base64.b64decode(text))),s

def repaired_uv(h):
 """Apply matching Catmull-Clark subdivision to continuous UVs, preserving seam identities.
 R01 kept UV vertices fixed while smoothing position. Preserve a separate original UV buffer.
 Geometry and texture bytes used by the runtime remain exactly those of R01.
 """
 import importlib.util
 spec=importlib.util.spec_from_file_location('hat_r01_prepare',OLD/'prepare.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 cage=h['cage'];p=decode(cage['p']).reshape(-1,3).astype(float);uv=decode(cage['u']).reshape(-1,2).astype(float);tri=decode(cage['i'],'<u4').reshape(-1,3)
 faces=[];fu=[]
 for a,b in zip(tri[::2],tri[1::2]):
  if not (a[0]==b[0] and a[2]==b[1] and len(set([*a,b[2]]))==4):raise ValueError('Unexpected control-cage quad order')
  f=[int(a[0]),int(a[1]),int(a[2]),int(b[2])];faces.append(f);fu.append(uv[f])
 unique,inverse=np.unique(p,axis=0,return_inverse=True);faces=[inverse[f].tolist() for f in faces]
 v=unique;old_uv=fu
 for _ in range(h['subdivision']):v,faces,old_uv=mod.subdiv(v,faces,old_uv)
 candidate=mod.flatten(v,faces,old_uv);sourcep=decode(h['geometry']['p']);generatedp=decode(candidate['p'])
 if len(sourcep)!=len(generatedp) or np.max(np.abs(sourcep-generatedp))>2e-7:raise ValueError('Recovered cage does not reproduce the frozen surface')
 v=unique;gfaces=[inverse[f].tolist() for f in [[int(a[0]),int(a[1]),int(a[2]),int(b[2])] for a,b in zip(tri[::2],tri[1::2])]]
 uverts=[];ufaces=[];lookup={}
 for f,coords in zip(gfaces,fu):
  row=[]
  for vi,coord in zip(f,coords):
   key=(vi,*np.round(coord,7))
   if key not in lookup:lookup[key]=len(uverts);uverts.append([*coord,0])
   row.append(lookup[key])
  ufaces.append(row)
 uverts=np.array(uverts,dtype=float)
 for _ in range(h['subdivision']):
  corner=[uverts[f,:2] for f in ufaces]
  v,gfaces,_=mod.subdiv(v,gfaces,corner)
  uverts,ufaces,_=mod.subdiv(uverts,ufaces,corner)
 new=mod.flatten(v,gfaces,[uverts[f,:2] for f in ufaces]);newp=decode(new['p']);newix=decode(new['i'],'<u4')
 if len(newp)!=len(sourcep) or np.max(np.abs(newp-sourcep))>2e-7 or not np.array_equal(newix,decode(h['geometry']['i'],'<u4')):raise ValueError('UV smoothing changed render topology')
 h['originalUV']=h['geometry']['u'];h['geometry']['u']=new['u']
 return {'method':'face-varying Catmull-Clark, UV seams preserved','runtimePositionBytesUnchanged':True,'reconstructedCageMaxPositionDeltaM':float(np.max(np.abs(newp-sourcep))),'uvChangedVertices':int(np.count_nonzero(np.linalg.norm(decode(new['u']).reshape(-1,2)-decode(h['originalUV']).reshape(-1,2),axis=1)>1e-7)),'textureBytesUnchanged':True,'userAccepted':False}

def scalp_grid(head):
 p=decode(head['p']).reshape(-1,3).astype(float);tri=decode(head['i'],'<u4').reshape(-1,3);v=p[tri];ys=np.linspace(-.095,.0995,100);angles=np.arange(192)*2*np.pi/192;directions=np.stack([np.cos(angles),np.sin(angles)],axis=1);radii=[]
 for y in ys:
  mask=(v[:,:,1].min(1)<=y)&(v[:,:,1].max(1)>=y);tv=v[mask];segments=[]
  for xyz in tv:
   hits=[]
   for i,j in [(0,1),(1,2),(2,0)]:
    dy=xyz[j,1]-xyz[i,1]
    if abs(dy)>1e-10:
     t=(y-xyz[i,1])/dy
     if 0<=t<1:hits.append((xyz[i]+t*(xyz[j]-xyz[i]))[[0,2]])
   if len(hits)==2:segments.append(hits)
  if not segments:radii.append(np.zeros(len(angles)));continue
  seg=np.array(segments);a=seg[:,0];e=seg[:,1]-a;den=directions[:,None,0]*e[None,:,1]-directions[:,None,1]*e[None,:,0];safe=np.where(abs(den)>1e-12,den,np.nan)
  rr=(a[:,0]*e[:,1]-a[:,1]*e[:,0])[None,:]/safe;tt=(a[None,:,0]*directions[:,None,1]-a[None,:,1]*directions[:,None,0])/safe
  valid=(rr>0)&(tt>=0)&(tt<=1)&(rr<.18);radii.append(np.max(np.where(valid,rr,0),axis=1))
 return ys,np.array(radii)

def clearance(points,grid):
 ys,rad=grid;y=points[:,1];rho=np.hypot(points[:,0],points[:,2]);ang=(np.arctan2(points[:,2],points[:,0])%(2*np.pi))*rad.shape[1]/(2*np.pi);j=np.floor(ang).astype(int)%rad.shape[1];a=ang-np.floor(ang);yf=(y-ys[0])/(ys[1]-ys[0]);i=np.clip(np.floor(yf).astype(int),0,len(ys)-2);b=np.clip(yf-i,0,1)
 r=(1-b)*((1-a)*rad[i,j]+a*rad[i,(j+1)%rad.shape[1]])+b*((1-a)*rad[i+1,j]+a*rad[i+1,(j+1)%rad.shape[1]])
 use=(y>=ys[0])&(y<=ys[-1])&(r>.006);return rho[use]-r[use]

def calibrate_visor(h,heads):
 p=decode(h['geometry']['p']).reshape(-1,3).astype(float);ix=decode(h['geometry']['i'],'<u4').reshape(-1,3);points=np.concatenate([p,p[ix].mean(1)]);corrections=[];reports=[]
 for hd in heads:
  grid=scalp_grid(hd);sx=hd['headWidthM']/.148;sz=hd['headDepthM']/.19221;sy=(sx+sz)/2;base=(points-np.array(h['origin']))*np.array([sx,sy,sz]);small=base[::5];before=clearance(base,grid);best=None
  for xscale in np.arange(1,1.121,.02):
   for zscale in np.arange(1,1.241,.02):
    for forward in np.arange(0,.0151,.003):
     candidate=small*np.array([xscale,1,zscale])+[0,0,forward];d=clearance(candidate,grid)
     if len(d) and d.min()>=.0006:
      cost=(xscale-1)**2+(zscale-1)**2+(forward/.1)**2
      if best is None or cost<best[0]:best=(cost,xscale,zscale,forward)
  if best is None:raise ValueError('No acceptable bounded visor calibration for '+hd['id'])
  _,xs,zs,fw=best;after=clearance(base*np.array([xs,1,zs])+[0,0,fw],grid)
  if after.min()<0:raise ValueError('Dense visor samples failed for '+hd['id'])
  corrections.append({'scaleX':float(xs),'scaleZ':float(zs),'forward':float(fw),'lift':0})
  reports.append({'head':hd['id'],'samples':len(after),'penetratingBefore':int((before<0).sum()),'penetratingAfter':int((after<0).sum()),'minimumClearanceBeforeMM':float(before.min()*1000),'minimumClearanceAfterMM':float(after.min()*1000),'calibration':corrections[-1],'scope':'vertices + triangle centroids against sampled horizontal scalp envelope, default pose only; not exact triangle collision or pressure certification'})
 h['fitCorrection']=corrections;return reports

def assets():
 d,html=read_base();notes={}
 notes['cable']=repaired_uv(next(h for h in d['hats'] if h['id']=='cable'))
 notes['visor']=calibrate_visor(next(h for h in d['hats'] if h['id']=='visor'),d['native']['heads'])
 dest=ROOT/'assets';dest.mkdir(exist_ok=True);meta=[]
 for h in d['hats']:
  h.pop('cage',None);b=pack(h);name=h['id']+'.bin';(dest/name).write_bytes(b);m={k:v for k,v in h.items() if k not in ['geometry','textures','originalUV','cage']};m.update(packageFile=name,packageSHA256=sha(b),packageBytes=len(b));meta.append(m)
 hs=[]
 for h in d['native']['heads']:
  h={k:v for k,v in h.items() if k not in ['sourceVertexIds','archive']};b=pack(h);name='head-'+h['id']+'.bin';(dest/name).write_bytes(b);m={k:v for k,v in h.items() if k not in ['p','i','n']};m.update(packageFile=name,packageSHA256=sha(b),packageBytes=len(b));hs.append(m)
 metadata={'version':VERSION,'baseline':BASE_SHA,'hats':meta,'native':{**{k:v for k,v in d['native'].items() if k!='heads'},'heads':hs}}
 (ROOT/'ASSET_MANIFEST.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2));(ROOT/'CORRECTION_REPORT.json').write_text(json.dumps(notes,ensure_ascii=False,indent=2));print('ASSETS',json.dumps(notes,ensure_ascii=False),flush=True)

def pages(data_sha,source_sha):
 d,oldhtml=read_base();m=json.loads((ROOT/'ASSET_MANIFEST.json').read_text());m['sourceCommit']=source_sha;m['dataCommit']=data_sha;th=ROOT/'thumbnails.json';thumbs=json.loads(th.read_text()) if th.exists() else {}
 base=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{data_sha}/hat-workshop/r02/assets/'
 for h in [*m['hats'],*m['native']['heads']]:h['packageURL']=base+h['packageFile']
 for h in m['hats']:
  if h['id'] in thumbs:h['renderedThumbnail']=thumbs[h['id']]
 full=copy.deepcopy(m)
 for coll in [full['hats'],full['native']['heads']]:
  for h in coll:h.update(json.loads(gzip.decompress((ROOT/'assets'/h['packageFile']).read_bytes())))
 subprocess.run(['node_modules/.bin/esbuild',str(ROOT/'app.js'),'--bundle','--format=iife','--minify','--outfile='+str(ROOT/'app.bundle.js')],check=True)
 script=(ROOT/'app.bundle.js').read_text().replace('</script','<\\/script');shell=(ROOT/'shell.html').read_text()
 for name,data in [('index.html',m),('standalone.html',full)]:
  payload=base64.b64encode(pack(data)).decode();text=shell.replace('<!--PAYLOAD-->',payload).replace('/*APP*/',script);(ROOT/name).write_text(text)
 info={'version':VERSION,'sourceSha':source_sha,'baselineSha':BASE_SHA,'baselineHTMLSHA256':BASE_HASH,'dataSha':data_sha,'htmlSHA256':sha((ROOT/'index.html').read_bytes()),'publicBytes':(ROOT/'index.html').stat().st_size,'standaloneSHA256':sha((ROOT/'standalone.html').read_bytes()),'standaloneBytes':(ROOT/'standalone.html').stat().st_size,'engine':'esbuild-0.25.9 / three-0.179.1','hats':len(m['hats']),'textureQuality':'all original R01 texture bytes retained; no downsampling or lossy recompression in R02','runtimeRemoved':['unused control cage','unused native source index list / rebuild archive (retained in frozen R01)'],'userAccepted':False,'physicsValidated':False,'phonePhysicalDevice':False}
 (ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(info,ensure_ascii=False,indent=2));print('BUILD',json.dumps(info,ensure_ascii=False),flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--assets',action='store_true');p.add_argument('--pages',action='store_true');p.add_argument('--data-sha',default='LOCAL_NOT_RELEASED');p.add_argument('--source-sha',default='LOCAL_NOT_RELEASED');a=p.parse_args()
 if a.assets:assets()
 if a.pages:pages(a.data_sha,a.source_sha)
