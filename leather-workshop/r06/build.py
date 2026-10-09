"""Build an offline, single-file R06 candidate. All older sources are read-only."""
from pathlib import Path
from PIL import Image
import base64, gzip, hashlib, io, json, re, subprocess
R=Path(__file__).resolve().parent
L=R.parent
BASE='e86c36c8c34b1f2b57cc5462459ee2f490e556af'
HASH='46f44dd298eb33b23d41ec05cfe5b550f343fe5ca37cec424ae92b309012f26a'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(L/'r05/public-lite.html')==HASH,'Frozen R05.1 mismatch: STOP; never update the expected hash.'
source_paths=[L/'r02/site/three.module.js',L/'r02/site/leather.js',L/'r03/site/physics.mjs',L/'r04/site/dynamics.mjs',L/'r04/site/clamp.mjs',L/'r04/site/worker.js',L/'r05/site/appearance.js']
source_hashes={str(p.relative_to(L)):sha(p) for p in source_paths}
def src(p):
 s=p.read_text()
 s=re.sub(r'^import[^\n]*\n','',s,flags=re.M)
 return re.sub(r'\bexport (?=(?:async )?(?:class|const|function))','',s)
def mod(p,n): return 'const {'+n+'}=(()=>{'+src(p)+';return {'+n+'};})();'
t=(L/'r02/site/three.module.js').read_text();e=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',t);assert e
pairs=[re.split(r'\s+as\s+',p.strip()) for p in e[1].split(',')]
three='const T=(()=>{'+t[:e.start()]+';return {'+','.join(p[-1]+':'+p[0] for p in pairs)+'};})();'
worker='(()=>{'+mod(L/'r03/site/physics.mjs','PROFILES,LeatherMaterial,makeSpecimen,MembraneSolver')+mod(L/'r04/site/dynamics.mjs','LeatherDynamics')+mod(L/'r04/site/clamp.mjs','ClampedLeather')+src(L/'r04/site/worker.js')+'})();'
try: commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True,stderr=subprocess.DEVNULL).strip()
except subprocess.CalledProcessError: commit='LOCAL-CANDIDATE'
info={'version':'R06.1','sourceCommit':commit,'baseline':BASE,'frozenDependencySHA256':source_hashes,'r05EntrySHA256':HASH,'physicalCore':'R04 unchanged source','productPhysics':'NOT_SOLVED_FULL_PRODUCTS'}
code='(()=>{\n'+three+'\n'+mod(L/'r02/site/leather.js','LeatherKernel,PRESETS,DEFAULT,FINISHES')+'\n'+mod(L/'r05/site/appearance.js','SewingAppearance')+'\n'+mod(R/'site/products.js','PRODUCT_SPECS,roundShape,panelGeometry,shell,productMaterials,makeProduct,setProductMaterial,productAudit,patternSVG')+'\n'+mod(R/'site/catalogue.js','CATALOGUE,AtelierMaterials')+'\nconst WORKER_CODE='+json.dumps(worker)+';\nconst BUILD_INFO='+json.dumps(info)+';\nconst BASELINE_GZIP='+json.dumps(base64.b64encode(gzip.compress((L/'r05/public-lite.html').read_bytes(),compresslevel=9,mtime=0)).decode())+';\n'+src(R/'site/runtime.js')+'\n})();'
code=re.sub(r'</script',r'<\\/script',code,flags=re.I)
check=R/'bundle-check.js';check.write_text(code);subprocess.run(['node','--check',str(check)],check=True)
check.unlink()
maps={};map_info={}
for name in ['diff','nor_gl','rough']:
 p=L/'r05/assets-grain'/f'{name}.webp';im=Image.open(p).convert('RGB');source_size=im.size;im=im.resize((1536,768),Image.Resampling.LANCZOS)
 if name=='nor_gl':
  # Renormalize filtered tangent normals; data is never treated as sRGB.
  import numpy as np
  a=np.asarray(im).astype(float)/127.5-1; a/=np.maximum(1e-8,np.linalg.norm(a,axis=2,keepdims=True));im=Image.fromarray(np.uint8(np.clip((a+1)*127.5,0,255)))
 out=io.BytesIO();im.save(out,'WEBP',quality=94 if name=='diff' else 92,method=6);b=out.getvalue();maps[name]='data:image/webp;base64,'+base64.b64encode(b).decode();map_info[name]={'sourceSHA256':sha(p),'sourcePixels':source_size,'publicPixels':im.size,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'cropMM':[150,75],'wrap':'mirrored; shader corrects normal parity'}
html=(R/'site/template.html').read_text().replace('<!--DATA-->','<div id="scanData" hidden>'+json.dumps(maps)+'</div>').replace('<!--APP-->','<!-- Three.js MIT; original KAOPU R02/R04 preserved. R05 Brown Leather by Rob Tuytel / Poly Haven CC0-1.0. No Adobe asset data. --><script>'+code+'</script>')
(R/'public-lite.html').write_text(html)
info.update({'htmlSHA256':hashlib.sha256(html.encode()).hexdigest(),'htmlBytes':len(html.encode()),'maps':map_info,'sourceHashes':{p.name:sha(p) for p in (R/'site').iterdir() if p.is_file()},'oldEntryCompressed':True,'baselineIsReadOnly':True,'standaloneCoreRemoteRequests':0,'visualAcceptance':'PENDING_BROWSER_AND_USER'})
(R/'BUILD_MANIFEST.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:info[k] for k in ['version','sourceCommit','htmlBytes','htmlSHA256']},indent=2))
