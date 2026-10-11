from pathlib import Path
import base64,gzip,hashlib,json,re,subprocess,os
R=Path(__file__).resolve().parent;L=R.parent
BASE='e86c36c8c34b1f2b57cc5462459ee2f490e556af';PARENT='f1ab73a7b289461a7d81e65eed935ec62369ed34'
from source_adapters import adapt

def resolve(p):
 if p.exists():return p
 if p.parent==R/'site':return L/'r08/site'/p.name
 if p.parent==R/'vendor':return L/'r08/vendor'/p.name
 raise FileNotFoundError(p)
def src(p):
 s=adapt(p.name,resolve(p).read_text());s=re.sub(r'^import[^\n]*\n','',s,flags=re.M)
 return re.sub(r'\bexport (?=(?:async )?(?:class|const|function))','',s)
def mod(p,n):return 'const {'+n+'}=(()=>{'+src(p)+';return {'+n+'};})();'
def rawmod(p,n,replace=None):
 s=src(p)
 for a,b in replace or []:assert a in s;s=s.replace(a,b)
 return '(()=>{'+s+';return {'+n+'};})()'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(L/'r05/public-lite.html')=='46f44dd298eb33b23d41ec05cfe5b550f343fe5ca37cec424ae92b309012f26a'
assert sha(L/'r06/public-lite.html')=='040838bd5bbfaaccb4ff455c0a111bf54e6e868bea5e6b301d8f9ff2f0a319f9'
t=(L/'r02/site/three.module.js').read_text();e=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',t);assert e
pairs=[re.split(r'\s+as\s+',p.strip()) for p in e[1].split(',')]
three='const T=(()=>{'+t[:e.start()]+';return {'+','.join(p[-1]+':'+p[0] for p in pairs)+'};})();'
vendor='const POLY2TRI=(()=>{const module={exports:{}};const exports=module.exports;'+resolve(R/'vendor/poly2tri.min.js').read_text()+';return module.exports;})();'
shared=mod(L/'r03/site/physics.mjs','PROFILES,LeatherMaterial,makeSpecimen,MembraneSolver')+mod(L/'r04/site/dynamics.mjs','SurfaceLaw,hinge,LeatherDynamics')
worker='(()=>{'+shared+mod(L/'r04/site/clamp.mjs','ClampedLeather')+src(L/'r04/site/worker.js')+'})();'
try:commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True,stderr=subprocess.DEVNULL).strip()
except:commit=os.environ.get('SOURCE_SHA','LOCAL-R09')
inputs=[L/'r02/site/leather.js',L/'r04/site/dynamics.mjs',L/'r05/site/seam.mjs',L/'r05/site/contact-surface.mjs',L/'r05/site/geometry.js',L/'r05/site/appearance.js']
info={'version':'R09.1','sourceCommit':commit,'baseline':BASE,'parent':PARENT,'frozenInputHashes':{str(p.relative_to(L)):sha(p) for p in inputs},'sourceHashes':{p.name:sha(p) for p in (R/'site').iterdir() if p.is_file()},'R05ValidationExtensionOnly':{'count':[5,1600],'layerThicknessMM':[.2,8]},'builderSHA256':sha(Path(__file__)),'adapterSHA256':sha(R/'source_adapters.py'),'materialCalibration':False,'collisionScope':'finite-thickness simulation-mesh point-triangle and edge-edge barriers with swept step filtering; not fine-render-mesh guarantee'}
# Reassemble the already-frozen R02 source without running its mutating upgrade script.
legacySource=src(L/'r02/site/legacy.js')
legacyParts=[three,'const LegacyLeatherKernel=(()=>{'+legacySource+';return LegacyLeatherKernel;})();']
for name in ['leather.js','craft.js','export.js','app.js']:
 legacyParts.append(src(L/'r02/site'/name))
legacyCode='(()=>{'+chr(10).join(legacyParts)+'})();'
legacyCode=re.sub(r'</script',r'<\\/script',legacyCode,flags=re.I)
legacyNotice=(L/'r02/THIRD_PARTY.txt').read_text().replace('--','—')
legacyHTML=(L/'r02/site/template.html').read_text().replace('<!--IMPORTMAP-->','<!--'+chr(10)+legacyNotice+chr(10)+'-->').replace('<!--APP-->','<script>'+legacyCode+'</script>')
legacyGZIP=base64.b64encode(gzip.compress(legacyHTML.encode(),mtime=0)).decode()
# legacy remains embedded; no extra archival build copy
geometryModules=[
 'const R05_SEW='+rawmod(L/'r05/site/seam.mjs','buildSeam,continuousRoutes,auditSeam,insideHole',[("['count',5,25]","['count',5,1600]"),("['layerThickness',.8,2.5]","['layerThickness',.2,8]")])+';',
 'const R05_CONTACT='+rawmod(L/'r05/site/contact-surface.mjs','buildContactField,mapSurfacePoint')+';',
 'const {insideHole}=R05_SEW;const {mapSurfacePoint}=R05_CONTACT;',
 'const R05_GEOMETRY='+rawmod(L/'r05/site/geometry.js','fibreNormalTexture')+';',
 mod(R/'site/sewing.js','SeamPath,SeamIndex,seamRelief,makeSewnYarn'),
 mod(R/'site/panels.js','PanelAssembly,rectangle,borderPoints,skinMaterial,installSkin,updateSkin,reskinMaterial'),
 src(R/'site/surface-integrity.js'),'(()=>{'+src(R/'site/closed-shell.js')+'})();','(()=>{'+src(R/'site/pattern-physics.js')+'})();',
 '(()=>{'+src(R/'site/assembly-contract.js')+'})();',
 '(()=>{'+src(R/'site/yarn-host.js')+'})();',
 mod(R/'site/measurements.js','evaluateBoundVertex,worldShellMeasurements'),
 mod(R/'site/products.js','PRODUCT_SPECS,productMaterials,makeProduct,setProductMaterial,productAudit,patternSVG'),
 mod(R/'site/grip.mjs','ProductShell,fastHinge')]
# Build freestanding 64-bit CPU/WASM kernel into the standalone HTML.
import shutil,tempfile
compiler=shutil.which('clang')
if not compiler:raise RuntimeError('clang is required; no physics fallback')
with tempfile.TemporaryDirectory() as td:
 c=Path(td)/'combined.c';w=Path(td)/'contact.wasm'
 c.write_text((R/'native/contact.c').read_text()+'\n'+adapt('energy.c',(R/'native/energy.c').read_text()))
 subprocess.run([compiler,'--target=wasm32','-O3','-nostdlib','-fno-builtin','-Wl,--no-entry','-Wl,--export-all','-Wl,--allow-undefined','-Wl,--initial-memory=131072','-Wl,--max-memory=134217728',str(c),'-o',str(w)],check=True)
 wasm=base64.b64encode(w.read_bytes()).decode()
physicsStack='const {ImplicitLeatherShell,SurfaceContact,closestPT,closestEE,sweptContact,ContactReference}=(()=>{const CONTACT_NARROW_WASM='+json.dumps(wasm)+';'+mod(L/'r08/site/grip.mjs','ProductShell,fastHinge').replace('const {ProductShell,fastHinge}','const {ProductShell:BaseProductShell,fastHinge}',1)+mod(R/'site/contact.mjs','SurfaceContact,closestPT,closestEE,sweptContact,ContactReference')+mod(R/'site/shell.mjs','ProductShell')+mod(R/'site/native-energy.mjs','NativeEnergy')+mod(R/'site/implicit.mjs','ImplicitLeatherShell')+mod(R/'site/feasible-start.js','ReadyLeatherShell')+';return {ImplicitLeatherShell:ReadyLeatherShell,SurfaceContact,closestPT,closestEE,sweptContact,ContactReference};})();'
productWorker='(()=>{'+shared+physicsStack+src(R/'site/grip-worker-runtime.js')+'})();' 
code='\n'.join([three,vendor,shared,*geometryModules,
 'const PRODUCT_WORKER_CODE='+json.dumps(productWorker)+';',mod(R/'site/grip-worker.js','ProductWorkerShell'),
 mod(L/'r02/site/leather.js','LeatherKernel,PRESETS,DEFAULT,FINISHES'),mod(L/'r05/site/appearance.js','SewingAppearance'),mod(L/'r06/site/catalogue.js','CATALOGUE,AtelierMaterials'),
 'const LEGACY_CRAFT_GZIP='+json.dumps(legacyGZIP)+';const WORKER_CODE='+json.dumps(worker)+';const BUILD_INFO='+json.dumps(info)+';const BASELINE_GZIP='+json.dumps(base64.b64encode(gzip.compress((L/'r05/public-lite.html').read_bytes(),mtime=0)).decode())+';',src(R/'site/runtime.js'),src(R/'site/runtime-polish.js'),src(R/'site/atelier-controls.js'),src(R/'site/takeover-ui.js'),src(R/'site/resource-lifecycle.js')])
code='(()=>{'+code+'})();';code=re.sub(r'</script',r'<\\/script',code,flags=re.I)
(R/'bundle-check.js').write_text(code);subprocess.run(['node','--check',str(R/'bundle-check.js')],check=True);(R/'bundle-check.js').unlink()
old=(L/'r06/public-lite.html').read_text();data=re.search(r'<div id="scanData" hidden>(.*?)</div>',old,re.S);assert data
html=adapt('template.html',resolve(R/'site/template.html').read_text()).replace('<!--DATA-->','<div id="scanData" hidden>'+data[1]+'</div>').replace('<!--APP-->','<script>'+code+'</script>')
(R/'public-lite.html').write_text(html)
info.update(htmlSHA256=hashlib.sha256(html.encode()).hexdigest(),htmlBytes=len(html.encode()),standalone=True,visualAcceptance='PENDING_USER')
(R/'BUILD_MANIFEST.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n');print(json.dumps(info,indent=2))
node='\n'.join([three,vendor,shared,*geometryModules,physicsStack])
(R/'node-lib.cjs').write_text(node+'\nmodule.exports={ImplicitLeatherShell,SurfaceContact,closestPT,closestEE,sweptContact,ContactReference,evaluateBoundVertex,worldShellMeasurements,updateSkin,skinMaterial,T,PRODUCT_SPECS,productMaterials,makeProduct,productAudit,ProductShell,fastHinge,hinge,PanelAssembly,SeamPath,SeamIndex,seamRelief,R05_SEW,R05_CONTACT};')
