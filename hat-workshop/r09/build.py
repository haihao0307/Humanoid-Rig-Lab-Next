from pathlib import Path
from bs4 import BeautifulSoup
import re,base64,gzip,json,hashlib,argparse
R=Path(__file__).resolve().parent
hash256=lambda b:hashlib.sha256(b).hexdigest()
def bundle_module(entry):
 modules={};order=[]
 rx=re.compile(r"import\s*(.*?)\s*from\s*['\"]([^'\"]+)['\"];",re.S)
 def module(path):
  path=path.resolve();name=str(path.relative_to(R))
  if name in modules:return name
  src=path.read_text();imports=list(rx.finditer(src));pre=[];modules[name]=None
  for im in imports:
   clause,url=im.groups()
   if url=='three':pre.append('const T=globalThis.__hatEngine.THREE;')
   elif url.endswith('OrbitControls.js'):pre.append('const {OrbitControls}=globalThis.__hatEngine;')
   elif url.endswith('RoomEnvironment.js'):pre.append('const {RoomEnvironment}=globalThis.__hatEngine;')
   else:
    child=module(path.parent/url);pre.append('const '+clause.strip().replace(' as ',':')+'=__modules['+json.dumps(child)+'];')
  src=rx.sub('',src);reexports=[]
  def rex(m):
   ids,url=m.groups();child=module(path.parent/url);reexports.append('Object.assign(out,__modules['+json.dumps(child)+']);');return ''
  src=re.sub(r"export\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"];",rex,src)
  names=re.findall(r'export\s+(?:async\s+)?(?:function|const|class|let)\s+(\w+)',src)
  src=re.sub(r'\bexport\s+(?=(?:async\s+)?(?:function|const|class|let))','',src)
  modules[name]='__modules['+json.dumps(name)+']=(()=>{'+''.join(pre)+'\n'+src+'\nconst out={'+','.join(names)+'};'+''.join(reexports)+'return out;})();'
  order.append(name);return name
 module(entry)
 return '\n(()=>{const __modules={};\n'+'\n'.join(modules[n] for n in order)+'\n})();',order

def build(source=None,assets_only=False):
 base=R.parent/'r04';bundle=(base/'app.bundle.js').read_text()
 assert hash256(bundle.encode())=='a1c37723b2132d94027bcf98d743418b5bdec2270edf1cccaac6e9e8decd9d08'
 assert hash256((base/'standalone.html').read_bytes())=='7d51de829c915425908cd5b513a418b79625142e67046c9b3c2cac720cb50849'
 full=json.loads(gzip.decompress(base64.b64decode(BeautifulSoup((base/'standalone.html').read_text(),'html.parser').find(id='payload').text)))
 preservation=[]
 for h in full['hats']:
  row={'hat':h['id'],'sourceControlHash':hash256(json.dumps(h['mother'],sort_keys=True,separators=(',',':')).encode()),'colorByteSHA256':hash256(base64.b64decode(h['textures']['color'].split(',')[1]))}
  h.pop('packageURL',None)
  normal=h['textures'].pop('normal',None)
  if normal:
   raw=base64.b64decode(normal.split(',')[1]);dest=R/'details'/f'{h["id"]}.webp';dest.parent.mkdir(exist_ok=True);dest.write_bytes(raw)
   rev=source or 'LOCAL';path='hat-workshop/r09/details/'+dest.name
   h['normalSource']={'sha256':hash256(raw),'bytes':len(raw),'urls':[f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{rev}/{path}',f'https://cdn.jsdelivr.net/gh/haihao0307/Humanoid-Rig-Lab-Next@{rev}/{path}']}
   row['normalByteSHA256']=hash256(raw);row['normalBytes']=len(raw)
  preservation.append(row)
 if assets_only:return
 a=bundle.index('var rc={};');b=bundle.index('var it=s=>document.getElementById(s)')
 engine='(()=>{var V0=Object.defineProperty;var H0=(s,t)=>{for(var e in t)V0(s,e,{get:t[e],enumerable:!0})};'+bundle[a:b]+'globalThis.__hatEngine={THREE:rc,OrbitControls:Iu,RoomEnvironment:Pu};})();'
 app,mainFiles=bundle_module(R/'app.js');worker,workerFiles=bundle_module(R/'worker.mjs');app=engine+app
 sourceFiles={n:hash256((R/n).read_bytes()) for n in sorted(set(mainFiles+workerFiles+['shell.html','build.py','runtime-loader.js']))}
 sourceHash=hash256(json.dumps(sourceFiles,sort_keys=True,separators=(',',':')).encode())
 full.update(version='HAT-R09.0',sourceCommit=source or 'LOCAL-'+sourceHash[:16],sourceHash=sourceHash,baseline='0c219f96ddc7de3e594d275f08027cf3b606059c',publication='fixed-candidate' if source else 'local-candidate',loadingArchitecture='embedded-controls-heads-original-color / cancellable-worker / independent-original-normals')
 rawApp=app.encode();packedApp=gzip.compress(rawApp,compresslevel=9,mtime=0)
 loader=(R/'runtime-loader.js').read_text().replace('__RUNTIME_GZIP__',base64.b64encode(packedApp).decode()).replace('__RUNTIME_HASH__',hash256(rawApp)).replace('__PACKED_BYTES__',str(len(packedApp))).replace('__RAW_BYTES__',str(len(rawApp)))
 assert gzip.decompress(packedApp)==rawApp
 data=base64.b64encode(gzip.compress(json.dumps(full,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()
 page=(R/'shell.html').read_text().replace('<!--PAYLOAD-->',data).replace('/*APP*/',loader.replace('</script','<\\/script')).replace('/*WORKER*/',worker.replace('</script','<\\/script'))
 (R/'index.html').write_text(page)
 manifest={'version':full['version'],'sourceSha':full['sourceCommit'],'baselineSha':full['baseline'],'sourceHash':sourceHash,'sourceFiles':sourceFiles,'htmlSHA256':hash256(page.encode()),'publicBytes':len(page.encode()),'runtimeUncompressedBytes':len(rawApp),'runtimeGzipBytes':len(packedApp),'runtimeSHA256':hash256(rawApp),'runtimeRoundTripByteIdentical':True,'geometryCacheBudgetBytes':67108864,'hatCount':len(full['hats']),'headCount':len(full['native']['heads']),'criticalRemoteAssetRequests':0,'originalColorAndControlsEmbedded':True,'normalMapsSeparate':True,'normalPixelsDownsampled':False,'sourcePreservation':preservation,'publicVerified':False,'userAccepted':False}
 (R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in manifest.items() if k not in ['sourceFiles','sourcePreservation']},ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source');p.add_argument('--assets-only',action='store_true');a=p.parse_args();build(a.source,a.assets_only)
