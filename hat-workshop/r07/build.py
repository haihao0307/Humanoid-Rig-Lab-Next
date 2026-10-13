"""Deterministic build without fetching dependencies. Extract exact MIT Three r179.1
runtime from the frozen R04 bundle; bundle inspectable R06 modules independently.
This does not edit or execute R04's application or fit code from its bundle.
"""
from pathlib import Path
from bs4 import BeautifulSoup
import re,base64,gzip,json,hashlib,argparse
R=Path(__file__).resolve().parent
hash256=lambda b:hashlib.sha256(b).hexdigest()

def build(source=None):
 base=R.parent/'r04'; bundle=(base/'app.bundle.js').read_text()
 assert hash256(bundle.encode())=='a1c37723b2132d94027bcf98d743418b5bdec2270edf1cccaac6e9e8decd9d08', 'R04 engine baseline changed'
 assert hash256((base/'standalone.html').read_bytes())=='7d51de829c915425908cd5b513a418b79625142e67046c9b3c2cac720cb50849', 'R04 asset baseline changed'
 # Full THREE namespace and unchanged controls/environment, no R04 app initialization.
 a=bundle.index('var rc={};');b=bundle.index('var it=s=>document.getElementById(s)')
 engine='(()=>{var V0=Object.defineProperty;var H0=(s,t)=>{for(var e in t)V0(s,e,{get:t[e],enumerable:!0})};'+bundle[a:b]+'globalThis.__hatEngine={THREE:rc,OrbitControls:Iu,RoomEnvironment:Pu};})();'
 modules={};order=[]
 import_re=re.compile(r"import\s*(.*?)\s*from\s*['\"]([^'\"]+)['\"];",re.S)
 def module(path):
  path=path.resolve(); name=str(path.relative_to(R));
  if name in modules:return name
  src=path.read_text();imports=list(import_re.finditer(src));pre=[];modules[name]=None
  for im in imports:
   clause,url=im.groups()
   if url=='three':pre.append('const T=globalThis.__hatEngine.THREE;')
   elif url.endswith('OrbitControls.js'):pre.append('const {OrbitControls}=globalThis.__hatEngine;')
   elif url.endswith('RoomEnvironment.js'):pre.append('const {RoomEnvironment}=globalThis.__hatEngine;')
   else:
    child=module(path.parent/url)
    pre.append('const '+clause.strip().replace(' as ',':')+'=__modules['+json.dumps(child)+'];')
  src=import_re.sub('',src)
  # explicit named re-export
  reexports=[]
  def rex(m):
   ids,url=m.groups();child=module(path.parent/url);reexports.append('Object.assign(out,__modules['+json.dumps(child)+']);');return ''
  src=re.sub(r"export\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"];",rex,src)
  names=re.findall(r'export\s+(?:async\s+)?(?:function|const|class|let)\s+(\w+)',src)
  src=re.sub(r'\bexport\s+(?=(?:async\s+)?(?:function|const|class|let))','',src)
  modules[name]='__modules['+json.dumps(name)+']=(()=>{'+''.join(pre)+'\n'+src+'\nconst out={'+','.join(names)+'};'+''.join(reexports)+'return out;})();'
  order.append(name);return name
 module(R/'app.js')
 app=engine+'\n(()=>{const __modules={};\n'+'\n'.join(modules[n] for n in order)+'\n})();'
 full=json.loads(gzip.decompress(base64.b64decode(BeautifulSoup((base/'standalone.html').read_text(),'html.parser').find(id='payload').text)))
 sourceFiles={n:hash256((R/n).read_bytes()) for n in sorted(set(order+['shell.html','build.py']))}
 sourceHash=hash256(json.dumps(sourceFiles,sort_keys=True,separators=(',',':')).encode())
 full.update(version='HAT-R07.0',sourceCommit=source or 'LOCAL-'+sourceHash[:16],sourceHash=sourceHash,baseline='721e955687949c6b6e4126ebb31d45551149b495',publication='fixed-candidate' if source else 'local-candidate')
 data=base64.b64encode(gzip.compress(json.dumps(full,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()
 shell=(R/'shell.html').read_text().replace('<!--PAYLOAD-->',data).replace('/*APP*/',app.replace('</script','<\\/script'))
 (R/'standalone.html').write_text(shell);(R/'app.offline.js').write_text(app)
 import copy
 public=copy.deepcopy(full)
 dataSha='fa6e3842b0add398a52b775a1577fc50e31ce31b'
 for h in public['hats']:
  for k in ['mother','textures','geometry','cage','originalUV']:h.pop(k,None)
  h['packageURL']=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{dataSha}/hat-workshop/r03/assets/{h["id"]}.bin'
 for h in public['native']['heads']:
  for k in ['p','i','n','rawPositions','rawIndex']:h.pop(k,None)
  h['packageURL']=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{dataSha}/hat-workshop/r03/assets/head-{h["id"]}.bin'
 publicData=base64.b64encode(gzip.compress(json.dumps(public,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()
 page=(R/'shell.html').read_text().replace('<!--PAYLOAD-->',publicData).replace('/*APP*/',app.replace('</script','<\\/script'))
 (R/'index.html').write_text(page)
 manifest={'version':full['version'],'sourceSha':full['sourceCommit'],'dataSha':dataSha,'htmlSHA256':hash256(page.encode()),'publicBytes':len(page.encode()),'hatCount':11,'stage':'locked static seating; no hair or donning solve','sourceHash':sourceHash,'sourceFiles':sourceFiles,'sourceIdentity':full['sourceCommit'],'baselineSha':full['baseline'],'offlineEngineExtraction':{'source':'R04/app.bundle.js','originalBundleSHA256':hash256(bundle.encode()),'runtime':'three 0.179.1, MIT; original OrbitControls/RoomEnvironment'},'standaloneSHA256':hash256(shell.encode()),'bytes':len(shell.encode()),'githubCommitted':bool(source),'publicVerified':False,'userAccepted':False}
 (R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps(manifest))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source');a=p.parse_args();build(a.source)
