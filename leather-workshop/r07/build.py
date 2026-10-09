from pathlib import Path
import base64,gzip,hashlib,json,re,subprocess,os
R=Path(__file__).resolve().parent;L=R.parent
BASE='e86c36c8c34b1f2b57cc5462459ee2f490e556af';PARENT='1b85084f13a67773dd3b9c1b1b7c73b56f3bb6dc'
def src(p):
 s=p.read_text();s=re.sub(r'^import[^\n]*\n','',s,flags=re.M)
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
shared=mod(L/'r03/site/physics.mjs','PROFILES,LeatherMaterial,makeSpecimen,MembraneSolver')+mod(L/'r04/site/dynamics.mjs','SurfaceLaw,hinge,LeatherDynamics')
worker='(()=>{'+shared+mod(L/'r04/site/clamp.mjs','ClampedLeather')+src(L/'r04/site/worker.js')+'})();'
try:commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True,stderr=subprocess.DEVNULL).strip()
except:commit=os.environ.get('SOURCE_SHA','LOCAL-R07')
inputs=[L/'r02/site/leather.js',L/'r04/site/dynamics.mjs',L/'r05/site/seam.mjs',L/'r05/site/contact-surface.mjs',L/'r05/site/geometry.js',L/'r05/site/appearance.js']
info={'version':'R07.1','sourceCommit':commit,'baseline':BASE,'parent':PARENT,'frozenInputHashes':{str(p.relative_to(L)):sha(p) for p in inputs},'sourceHashes':{p.name:sha(p) for p in (R/'site').iterdir() if p.is_file()},'R05ValidationExtensionOnly':{'count':[5,1600],'layerThicknessMM':[.2,8]},'materialCalibration':False,'collisionScope':'particle self-contact; not triangle CCD'}
code='\n'.join([three,shared,
 'const R05_SEW='+rawmod(L/'r05/site/seam.mjs','buildSeam,continuousRoutes,auditSeam,insideHole',[("['count',5,25]","['count',5,1600]"),("['layerThickness',.8,2.5]","['layerThickness',.2,8]")])+';',
 'const R05_CONTACT='+rawmod(L/'r05/site/contact-surface.mjs','buildContactField,mapSurfacePoint')+';',
 'const {insideHole}=R05_SEW;const {mapSurfacePoint}=R05_CONTACT;',
 'const R05_GEOMETRY='+rawmod(L/'r05/site/geometry.js','fibreNormalTexture')+';',
 mod(L/'r02/site/leather.js','LeatherKernel,PRESETS,DEFAULT,FINISHES'),mod(L/'r05/site/appearance.js','SewingAppearance'),
 mod(R/'site/sewing.js','SeamPath,SeamIndex,seamRelief,makeSewnYarn'),
 mod(R/'site/panels.js','PanelAssembly,rectangle,borderPoints,skinMaterial,installSkin,updateSkin,reskinMaterial'),
 mod(R/'site/products.js','PRODUCT_SPECS,productMaterials,makeProduct,setProductMaterial,productAudit,patternSVG'),
 mod(R/'site/grip.mjs','ProductShell'),mod(L/'r06/site/catalogue.js','CATALOGUE,AtelierMaterials'),
 'const WORKER_CODE='+json.dumps(worker)+';const BUILD_INFO='+json.dumps(info)+';const BASELINE_GZIP='+json.dumps(base64.b64encode(gzip.compress((L/'r05/public-lite.html').read_bytes(),mtime=0)).decode())+';',src(R/'site/runtime.js'),src(R/'site/runtime-polish.js')])
code='(()=>{'+code+'})();';code=re.sub(r'</script',r'<\\/script',code,flags=re.I)
(R/'bundle-check.js').write_text(code);subprocess.run(['node','--check',str(R/'bundle-check.js')],check=True);(R/'bundle-check.js').unlink()
old=(L/'r06/public-lite.html').read_text();data=re.search(r'<div id="scanData" hidden>(.*?)</div>',old,re.S);assert data
html=(R/'site/template.html').read_text().replace('<!--DATA-->','<div id="scanData" hidden>'+data[1]+'</div>').replace('<!--APP-->','<script>'+code+'</script>')
(R/'public-lite.html').write_text(html)
info.update(htmlSHA256=hashlib.sha256(html.encode()).hexdigest(),htmlBytes=len(html.encode()),standalone=True,visualAcceptance='PENDING_USER')
(R/'BUILD_MANIFEST.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n');print(json.dumps(info,indent=2))
node='\n'.join([three,shared,'const R05_SEW='+rawmod(L/'r05/site/seam.mjs','buildSeam,continuousRoutes,auditSeam,insideHole',[("['count',5,25]","['count',5,1600]"),("['layerThickness',.8,2.5]","['layerThickness',.2,8]")])+';', 'const R05_CONTACT='+rawmod(L/'r05/site/contact-surface.mjs','buildContactField,mapSurfacePoint')+';', 'const {insideHole}=R05_SEW;const {mapSurfacePoint}=R05_CONTACT;', 'const R05_GEOMETRY='+rawmod(L/'r05/site/geometry.js','fibreNormalTexture')+';',mod(R/'site/sewing.js','SeamPath,SeamIndex,seamRelief,makeSewnYarn'),mod(R/'site/panels.js','PanelAssembly,rectangle,borderPoints,skinMaterial,installSkin,updateSkin,reskinMaterial'),mod(R/'site/products.js','PRODUCT_SPECS,productMaterials,makeProduct,setProductMaterial,productAudit,patternSVG'),mod(R/'site/grip.mjs','ProductShell')])
(R/'node-lib.cjs').write_text(node+'\nmodule.exports={T,PRODUCT_SPECS,productMaterials,makeProduct,productAudit,ProductShell,PanelAssembly,SeamPath,SeamIndex,R05_SEW,R05_CONTACT};')
