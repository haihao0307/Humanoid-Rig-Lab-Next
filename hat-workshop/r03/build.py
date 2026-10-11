"""Source-control-net build. Frozen R02 remains the accepted appearance reference.
External source packs are byte-checked against the already reviewed R01 records.
"""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,subprocess,copy,importlib.util,zipfile,io
import numpy as np
ROOT=Path(__file__).resolve().parent
R02=ROOT.parent/'r02';R01=ROOT.parent/'r01'
BASE='d56bc8498a152ff501ffaf80ec80a109b2ec4865'
BASE_HASH='9e11dfc07e8296ffe80afd7e78b710c074ae9cce285cb4d373f449d83e2b112b'
VERSION='HAT-R03.0'
def sha(b):return hashlib.sha256(b).hexdigest()
def pack(v):return gzip.compress(json.dumps(v,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
def old_module():
 s=importlib.util.spec_from_file_location('r01_source',R01/'prepare.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def assets():
 assert sha((R02/'index.html').read_bytes())==BASE_HASH,'Accepted R02 HTML must not change'
 m=old_module();cache=ROOT/'cache';cache.mkdir(exist_ok=True);zs={}
 for name,(kind,digest) in m.PACKS.items():
  p=cache/(name+'.zip')
  if not p.exists():p.write_bytes(m.readurl(f'https://files.makehumancommunity.org/asset_packs/{name}/{name}_{kind}.zip'))
  assert sha(p.read_bytes())==digest,'Source pack hash mismatch';zs[name]=zipfile.ZipFile(p)
 old=json.loads((R02/'ASSET_MANIFEST.json').read_text());thumbs=json.loads((R02/'thumbnails.json').read_text());out=ROOT/'assets';out.mkdir(exist_ok=True);hats=[];report=[]
 for id,folder,obj,title,cat,family,levels,author in m.ITEMS:
  baseline=json.loads(gzip.decompress((R02/'assets'/(id+'.bin')).read_bytes()));z=zs['hats01' if id=='cloche' else 'hats03'];path='clothes/'+folder+'/'+obj+'.obj';raw=z.read(path);v,faces,uv=m.objread(raw.decode('utf-8-sig'));v=v*.1
  if id=='cable':uv=[u.astype('<f4').astype(float) for u in uv]
  recipe={'schema':'kaopu.hat.mother/3','id':id,'family':family,'controls':v.tolist(),'faces':faces,'cornerUV':[u.tolist() for u in uv],'subdivision':levels,'smoothUV':id=='cable','attribution':{'author':author,'licence':baseline['licence'],'sourceOBJ':path,'sourceOBJ_SHA256':sha(raw),'referenceURL':baseline['referenceURL']},'representation':'source-authored control net and topology, evaluated by Catmull-Clark and category fields; not source-independent analytic reconstruction','containsBakedFittedMesh':False}
  data={k:v for k,v in baseline.items() if k not in ['geometry','cage','originalUV','packageURL','packageFile','packageSHA256','packageBytes','renderedThumbnail']};data['mother']=recipe
  b=pack(data);name=id+'.bin';(out/name).write_bytes(b)
  meta={k:v for k,v in data.items() if k not in ['mother','textures']};meta.update(packageFile=name,packageSHA256=sha(b),packageBytes=len(b),renderedThumbnail=thumbs[id],thumbnailScope='accepted R02 source-form 3D index, not a claimed new fitted screenshot');hats.append(meta)
  report.append({'id':id,'controlPoints':len(v),'controlFaces':len(faces),'subdivision':levels,'sourceOBJ_SHA256':sha(raw),'bakedRenderGeometryInPackage':False,'sourceTexturesRetained':True,'representation':recipe['representation']})
 heads=[]
 for h in old['native']['heads']:
  b=(R02/'assets'/h['packageFile']).read_bytes();(out/h['packageFile']).write_bytes(b);meta={k:v for k,v in h.items() if k not in ['packageURL']};heads.append(meta)
 metadata={'version':VERSION,'baseline':BASE,'hats':hats,'native':{**{k:v for k,v in old['native'].items() if k!='heads'},'heads':heads},'baselineAcceptance':{'scope':'user says replicated R02 appearance is acceptable as starting point; fit and procedural completeness are new requirements','allFitAccepted':False}}
 (ROOT/'ASSET_MANIFEST.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2));(ROOT/'MOTHER_REPRESENTATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('MOTHERS',json.dumps(report,ensure_ascii=False),flush=True)

def pages(data_sha,source_sha):
 app=(ROOT/'app.js').read_text()
 assert 'const fitStamp=JSON.stringify([isReference' in app,'Missing independent fit cache key'
 assert 'const key=JSON.stringify([isReference' not in app,'Fit cache must not shadow key light'
 assert 'key.position.set' in app and 'asset.fitKey=fitStamp' in app
 m=json.loads((ROOT/'ASSET_MANIFEST.json').read_text());m['sourceCommit']=source_sha;m['dataCommit']=data_sha
 base=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{data_sha}/hat-workshop/r03/assets/'
 for h in [*m['hats'],*m['native']['heads']]:h['packageURL']=base+h['packageFile']
 full=copy.deepcopy(m)
 for h in [*full['hats'],*full['native']['heads']]:h.update(json.loads(gzip.decompress((ROOT/'assets'/h['packageFile']).read_bytes())))
 subprocess.run(['node_modules/.bin/esbuild',str(ROOT/'app.js'),'--bundle','--format=iife','--minify','--outfile='+str(ROOT/'app.bundle.js')],check=True)
 script=(ROOT/'app.bundle.js').read_text().replace('</script','<\\/script');shell=(ROOT/'shell.html').read_text()
 for name,data in [('index.html',m),('standalone.html',full)]:
  html=shell.replace('<!--PAYLOAD-->',base64.b64encode(pack(data)).decode()).replace('/*APP*/',script);(ROOT/name).write_text(html)
 report={'version':VERSION,'baselineSha':BASE,'baselineHTMLSHA256':BASE_HASH,'sourceSha':source_sha,'dataSha':data_sha,'htmlSHA256':sha((ROOT/'index.html').read_bytes()),'publicBytes':(ROOT/'index.html').stat().st_size,'standaloneSHA256':sha((ROOT/'standalone.html').read_bytes()),'standaloneBytes':(ROOT/'standalone.html').stat().st_size,'hatCount':len(m['hats']),'generation':'All display hats regenerated in-browser from attributed controls; no baked hat render mesh in packages','texturePolicy':'R02 source textures unchanged; optional procedural shader surfaces are not geometric yarns','acceptance':{'R02AppearanceAsBaseline':True,'R03UserVisualAccepted':False,'physicalMaterialCalibrated':False,'dynamicCollisionValidated':False,'physicalPhoneTested':False}}
 (ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('BUILD',json.dumps(report,ensure_ascii=False),flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--assets',action='store_true');p.add_argument('--pages',action='store_true');p.add_argument('--data-sha',default='LOCAL_NOT_RELEASED');p.add_argument('--source-sha',default='LOCAL_NOT_RELEASED');a=p.parse_args()
 if a.assets:assets()
 if a.pages:pages(a.data_sha,a.source_sha)
