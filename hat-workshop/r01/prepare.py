"""Deterministic source-hat build; source form, browser adaptation and fitting remain distinct."""
from pathlib import Path
import io,json,hashlib,base64,gzip,zipfile,urllib.request,subprocess
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
PACKS={'hats01':('cc0','97b70d7bd90e74ee87a49faeb7c4a1b2762b311902974db575851daaae05b50e'),'hats03':('cc-by','2702d58fa04e57235881551c45adcda36a6eafde8043c2695375bc0b4b79f550')}
ITEMS=[('cable','mindfront_knitted_hat_01','knitted_hat_01','绞花针织帽','针织','knit',3,'Mindfront'),('fishing','mindfront_fishing_hat_01','fishing_hat_01','宽檐渔夫帽','休闲','cotton',2,'Mindfront'),('flatcap','elvs_male_flat_cap1','elvs_male_flat_cap1','人字纹鸭舌帽','经典','tweed',2,'Elvaerwyn'),('trilby','elvs_male_trilby_hat','m_trilby_hat','窄檐礼帽','经典','felt',0,'Elvaerwyn'),('sherpa','mindfront_sherpa_hat','sherpa_hat','护耳针织帽','针织','knit',2,'Mindfront'),('patrol','mindfront_patrol_cap','patrol_cap','平顶便帽','休闲','cotton',3,'Mindfront'),('bowler','culturalibre_cl_bowler_hat','cl_bowler_hat','卷檐圆顶帽','经典','felt',2,'culturalibre'),('top','elvs_tophat1','tophat1','高顶礼帽','经典','felt',2,'Elvaerwyn'),('visor','punkduck_sun_visor_sports_visor','sunvisor','空顶运动帽','休闲','cotton',3,'punkduck'),('cloche','aethelraed_unraed_cloche_hat','cloche_hat','钟形礼帽','经典','felt',3,'AEthelraed_Unraed'),('chef','elvs_unisex_chef_hat_1','elvs_unisex_chef_hat1','褶裥厨师帽','职业','cotton',1,'Elvaerwyn')]
ORIGINS={'flatcap':[0,.836,.0028],'trilby':[0,.861,.062],'bowler':[0,.830,.056],'visor':[0,.690,.054],'cloche':[0,.681,.054]}
def sha(b):return hashlib.sha256(b).hexdigest()
def readurl(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'KAOPU-HatStudy/1'}),timeout=120) as r:return r.read()
def b64gz(a):return base64.b64encode(gzip.compress(np.asarray(a).tobytes(),mtime=0)).decode()
def objread(text):
 v=[];uv=[];faces=[];fu=[]
 for l in text.splitlines():
  p=l.split()
  if not p:continue
  if p[0]=='v':v.append([float(x) for x in p[1:4]])
  elif p[0]=='vt':uv.append([float(x) for x in p[1:3]])
  elif p[0]=='f':
   f=[];t=[]
   for tok in p[1:]:
    q=tok.split('/');vi=int(q[0]);f.append(vi-1 if vi>0 else len(v)+vi)
    ui=int(q[1]) if len(q)>1 and q[1] else 0;t.append(uv[ui-1] if ui else [0.,0.])
   if len(f)>=3:faces.append(f);fu.append(np.array(t,dtype=float))
 return np.array(v,dtype=float),faces,fu

def subdiv(v,faces,uv):
 fp=np.array([v[f].mean(0) for f in faces]);edges={};vf=[[] for _ in v];ve=[[] for _ in v]
 for fi,f in enumerate(faces):
  for i,a in enumerate(f):
   vf[a].append(fi);b=f[(i+1)%len(f)];key=tuple(sorted((a,b)))
   if key not in edges:edges[key]=[];ve[a].append(key);ve[b].append(key)
   edges[key].append(fi)
 nv=v.copy();ei={};extra=[]
 for i,p in enumerate(v):
  boundary=[e[1] if e[0]==i else e[0] for e in ve[i] if len(edges[e])==1]
  if len(boundary)==2:nv[i]=(6*p+v[boundary].sum(0))/8
  elif not boundary and vf[i]:
   n=len(vf[i]);F=fp[vf[i]].mean(0);R=np.array([(v[a]+v[b])/2 for a,b in ve[i]]).mean(0);nv[i]=(F+2*R+(n-3)*p)/n
 for (a,b),adj in edges.items():
  ei[(a,b)]=len(v)+len(extra);extra.append((v[a]+v[b]+fp[adj].sum(0))/4 if len(adj)==2 else (v[a]+v[b])/2)
 out=np.vstack([nv,np.array(extra),fp]);outf=[];outu=[];off=len(v)+len(extra)
 for fi,(f,u) in enumerate(zip(faces,uv)):
  avg=u.mean(0)
  for j,a in enumerate(f):
   b=f[(j+1)%len(f)];c=f[j-1]
   outf.append([a,ei[tuple(sorted((a,b)))],off+fi,ei[tuple(sorted((a,c)))]] )
   outu.append(np.array([u[j],(u[j]+u[(j+1)%len(f)])/2,avg,(u[j-1]+u[j])/2]))
 return out,outf,outu

def flatten(v,f,fu):
 normals=np.zeros_like(v);tri=[];tu=[]
 for face,uv in zip(f,fu):
  for j in range(1,len(face)-1):
   ids=[face[0],face[j],face[j+1]];pts=v[ids];n=np.cross(pts[1]-pts[0],pts[2]-pts[0]);normals[ids]+=n;tri.extend(ids);tu.extend([uv[0],uv[j],uv[j+1]])
 length=np.linalg.norm(normals,axis=1);normals/=np.maximum(length[:,None],1e-20)
 pairs={};pv=[];pn=[];pu=[];ind=[]
 for i,t in zip(tri,tu):
  key=(i,round(float(t[0]),7),round(float(t[1]),7))
  if key not in pairs:pairs[key]=len(pv);pv.append(v[i]);pn.append(normals[i]);pu.append(t)
  ind.append(pairs[key])
 pos=np.array(pv,dtype='<f4');ix=np.array(ind,dtype='<u4')
 if not np.isfinite(pos).all() or max(ind)>=len(pos):raise ValueError('Invalid geometry')
 return {'p':b64gz(pos),'n':b64gz(np.array(pn,dtype='<f4')),'u':b64gz(np.array(pu,dtype='<f4')),'i':b64gz(ix),'vertexCount':len(pos),'triangles':len(ind)//3,'bounds':[pos.min(0).tolist(),pos.max(0).tolist()]}

def main():
 cache=ROOT/'cache';cache.mkdir(exist_ok=True);zs={};reports=[]
 for pack,(kind,digest) in PACKS.items():
  url=f'https://files.makehumancommunity.org/asset_packs/{pack}/{pack}_{kind}.zip';p=cache/(pack+'.zip')
  if not p.exists():p.write_bytes(readurl(url))
  raw=p.read_bytes()
  if sha(raw)!=digest:raise ValueError('Source ZIP changed: '+pack)
  zs[pack]=zipfile.ZipFile(io.BytesIO(raw));reports.append({'pack':pack,'url':url,'bytes':len(raw),'sha256':digest})
 data=[];records=[]
 for id,folder,obj,title,cat,family,levels,author in ITEMS:
  pack='hats01' if id=='cloche' else 'hats03';z=zs[pack];prefix='clothes/'+folder+'/'
  files={Path(n).name:n for n in z.namelist() if n.startswith(prefix) and not n.endswith('/')}
  clo=next(n for n in files if n.endswith('.mhclo'));clotext=z.read(files[clo]).decode('utf-8-sig')
  licence=next((s.split('license',1)[1].lstrip(': ').strip() for s in clotext.splitlines() if s.startswith('#') and 'license' in s),'UNKNOWN')
  if not licence.lower().startswith('cc'):raise ValueError('Unresolved licence '+id)
  matline=next((l.split(maxsplit=1)[1] for l in clotext.splitlines() if l.startswith('material ')),None)
  mattext=z.read(files[matline]).decode('utf-8-sig');props={};flags={}
  for l in mattext.splitlines():
   p=l.strip().split(maxsplit=1)
   if len(p)==2 and not p[0].startswith(('#','//')):
    if p[0]=='shaderConfig':
     k,value=p[1].split(maxsplit=1);flags[k]=value
    else:props[p[0]]=p[1]
  selected=[obj+'.obj',clo,matline];textures={};textureInfo=[]
  for kind,key in [('color','diffuseTexture'),('normal','normalmapTexture'),('specular','specularTexture')]:
   name=props.get(key)
   if not name:continue
   raw=z.read(files[name]);selected.append(name)
   if kind=='specular':
    textureInfo.append({'role':'source-specular-not-runtime','source':name,'sourceSHA256':sha(raw),'reason':'Original Phong/litsphere mask not used by this GGX adaptation; no unused runtime payload.'});continue
   im=Image.open(io.BytesIO(raw)).convert('RGBA' if kind=='color' else 'RGB');originalSize=im.size;im.thumbnail((2048,2048),Image.Resampling.LANCZOS)
   out=io.BytesIO();im.save(out,format='WEBP',lossless=(kind!='color'),quality=95,method=6)
   encoded=out.getvalue();textures[kind]='data:image/webp;base64,'+base64.b64encode(encoded).decode()
   textureInfo.append({'role':kind,'source':name,'sourceSize':originalSize,'runtimeSize':im.size,'sourceSHA256':sha(raw),'runtimeSHA256':sha(encoded),'runtimeBytes':len(encoded),'lossless':kind!='color'})
  v,f,uv=objread(z.read(files[obj+'.obj']).decode('utf-8-sig'));v=v*.1
  original=flatten(v,f,uv);bounds=[v.min(0).tolist(),v.max(0).tolist()]
  for _ in range(levels):v,f,uv=subdiv(v,f,uv)
  geo=flatten(v,f,uv);thumbname=next((n for n in files if n.endswith('.thumb')),None);thumb=None
  if thumbname:
   out=io.BytesIO();Image.open(io.BytesIO(z.read(files[thumbname]))).convert('RGB').save(out,format='JPEG',quality=85);thumb='data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
  origin=ORIGINS.get(id,[0,.752,.054]);diffuse=[float(x) for x in props.get('diffuseColor','1 1 1').split()]
  if len(diffuse)!=3 or not all(0<=x<=1 for x in diffuse):raise ValueError('Invalid source diffuse color')
  record={'id':id,'author':author,'licence':licence,'folder':folder,'pack':pack,'obj':obj+'.obj','sourceBoundsMeters':bounds,'subdivisionLevels':levels,'runtimeVertices':geo['vertexCount'],'runtimeTriangles':geo['triangles'],'fitOriginCandidate':origin,'fitOriginMeasured':False,'sourceMaterialProperties':props,'sourceShaderFlags':flags,'textures':textureInfo,'files':[{'path':files[n],'sha256':sha(z.read(files[n])),'bytes':len(z.read(files[n]))} for n in selected]};records.append(record)
  data.append({'id':id,'title':title,'category':cat,'family':family,'author':author,'licence':licence,'geometry':geo,'cage':original,'textures':textures,'teacherThumbnail':thumb,'sourceBounds':bounds,'diffuseColor':diffuse,'origin':origin,'referenceURL':f'https://static.makehumancommunity.org/assets/assetpacks/{pack}.html','subdivision':levels})
  print('HAT',id,json.dumps({**record,'files':len(selected)},ensure_ascii=False),flush=True)
 manifest={'schema':'kaopu.hat.sources/1','packs':reports,'hats':records,'excluded':['elvs_slouchy_beanie1: image decoder failed in run 38040596632; no invented replacement','jujube_newsboy_cap: pack/header licence conflict','grinsegold_uncle_joshis_hat: pack/header conflict','maciekg_wizard_hat: pack/header conflict','elvs_witchy_hallows_hat1: pack/header conflict'],'claims':{'exactOriginalRenderer':False,'assetsAreOriginalProceduralWork':False,'manufacturingCertified':False}}
 (ROOT/'SOURCES.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 heads=json.loads((ROOT/'NATIVE_HEADS.json').read_text())
 for head in heads['heads']:head['p']=b64gz(np.array(head.pop('positions'),dtype='<f4'));head['i']=b64gz(np.array(head.pop('faces'),dtype='<u4'))
 bundle={'hats':data,'native':heads,'version':'HAT-R01.0','sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()}
 (cache/'data.json').write_text(json.dumps(bundle,ensure_ascii=False,separators=(',',':')))
 subprocess.run(['node_modules/.bin/esbuild',str(ROOT/'app.js'),'--bundle','--format=iife','--minify',f'--outfile={cache}/app.bundle.js'],check=True)
 script=(cache/'app.bundle.js').read_text().replace('</script','<\\/script');payload=gzip.compress((cache/'data.json').read_bytes(),mtime=0)
 template=(ROOT/'shell.html').read_text().replace('<script id="payload" type="application/octet-stream">','<div id="payload" hidden>').replace('<!--PAYLOAD--></script>','<!--PAYLOAD--></div>').replace('<details><summary>来源参考与当前差异','<details open><summary>来源参考与当前差异')
 html=template.replace('12 款 · 正在生成三维缩略图',str(len(data))+' 款 · 正在生成三维缩略图').replace('<!--PAYLOAD-->',base64.b64encode(payload).decode()).replace('/*APP*/',script)
 if '<script id="payload"' in html or '<div id="payload" hidden>' not in html:raise ValueError('Data payload must not be executable script')
 (ROOT/'index.html').write_text(html)
 build={'version':bundle['version'],'sourceSha':bundle['sourceCommit'],'htmlSHA256':sha(html.encode()),'bytes':len(html.encode()),'hatCount':len(data),'nativeSource':heads['source'],'coreExternalRequests':0,'limitations':['Source-shape/UV plus displayed subdivision and browser GGX adaptation; not original-renderer equivalence.','Static original head samples, not live 36-person rig integration.','Affine fit is not scalp/hair contact, dynamics or manufacture certification.','Selected types are not all hat types.']}
 (ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(build,ensure_ascii=False,indent=2));print('BUILD',json.dumps(build),flush=True)
if __name__=='__main__':main()
