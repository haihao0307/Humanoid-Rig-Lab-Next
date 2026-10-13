"""EB1 additive release assembler. All native changes are explicit lighting-only patches.
Never run historic geometry migrations. Freeze native physics and asset bytes.
"""
from pathlib import Path
import json,hashlib,re,shutil,subprocess,sys,os,urllib.request,importlib.util
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'v1';NATIVE=ROOT/'implementations'
INPUT=Path(os.environ.get('EB1_INPUTS','/mnt/data/eb1-inputs'))
AUDIT=Path(os.environ.get('EB1_AUDIT','/mnt/data/eb1-audit'))
sha=lambda x:hashlib.sha256(x).hexdigest()
CORE=(ROOT/'eb1.js').read_text();CORE_SHA=sha(CORE.encode());receipts={}
SNAP=json.loads((AUDIT/'SNAPSHOTS.json').read_text())
def replace(s,a,b,count=1):
    if s.count(a)!=count:raise ValueError('Patch anchor mismatch '+a[:110]+' count '+str(s.count(a)))
    return s.replace(a,b)
def inject(s):
    return replace(s,'</head>','<script data-eb1="'+CORE_SHA+'">'+CORE.replace('</script','<\\/script')+'</script></head>')
def put(p,data):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data if isinstance(data,bytes) else data.encode())
def originals(p):return {str(f.relative_to(p)):sha(f.read_bytes()) for f in p.rglob('*') if f.is_file() and '/node_modules/' not in str(f)}
def receipt(name,src,before,allowed):
    after=originals(src);changes=[p for p,h in before.items() if after.get(p)!=h]
    if set(changes)-set(allowed):raise ValueError('Non-lighting source mutation '+name+': '+str(set(changes)-set(allowed)))
    receipts[name]={'baseline':SNAP.get(name,{}),'coreSHA256':CORE_SHA,'changedNativeFiles':changes,'preservedFiles':{p:h for p,h in before.items() if p not in changes},'status':'BUILT_REQUIRES_BROWSER_VERIFICATION','materialAndPhysicsMutation':False}
OUT.mkdir(parents=True,exist_ok=True);NATIVE.mkdir(parents=True,exist_ok=True)
shutil.copytree(ROOT/'licenses',OUT/'licenses',dirs_exist_ok=True)
for name in ['README.md','THIRD_PARTY_NOTICES.md']:shutil.copyfile(ROOT/name,OUT/name)

# Lab is intentionally a calibration scene, not a surrogate workbench.
lab=(ROOT/'lab.html').read_text();three=(INPUT/'tailor/kaopu-tailor-workbench/material-products/r04-4-1/vendor/three.module.js').read_text()
end=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',three)
assert end,'Three export table'
pairs=[re.split(r'\s+as\s+',x.strip()) for x in end[1].split(',')]
engine='const T=(()=>{'+three[:end.start()]+';return {'+','.join(x[-1]+':'+x[0] for x in pairs)+'};})();'
lab=replace(lab,'<script src="eb1.js"></script>','<script>'+CORE+'</script>')
lab=replace(lab,"import * as T from './three.mjs';",engine)
lab=replace(lab,'<script type="module">','<script>')
# Links resolve immutable HTMLPreview inputs as well as a native Pages snapshot.
nav='<div id="eb1-workbenches"><hr><b>原工作台 · EB1 接入候选</b><p>'+' '.join('<a data-bench="'+n+'">'+t+'</a>' for n,t in [('leather','皮革'),('hat','帽子'),('denim','牛仔'),('shoe','鞋子'),('tailor','服装')])+'</p><small>毛衣在原私有库接入，未在这里发布其源码。</small></div>'
lab=replace(lab,'<div id="badge">',nav+'<div id="badge">')
lab=replace(lab,'const errors=[];',"""for(const a of document.querySelectorAll('[data-bench]')){const rel=a.dataset.bench+'/index.html';const raw=decodeURIComponent(location.search.slice(1));a.href=raw.startsWith('https://raw.githubusercontent.com/')?'https://htmlpreview.github.io/?'+new URL(rel,raw).href:new URL(rel,location.href).href;a.target='_blank';a.rel='noopener';}const errors=[];""")
put(OUT/'index.html',lab)

# Leather: replace the reviewed readable runtime inside its frozen deterministic
# output. No WASM/source compiler is invoked for a lighting-only release, and the
# native binary remains exactly the already-delivered R16 binary.
base=INPUT/'leather/leather-workshop/r16';src=NATIVE/'leather';shutil.copytree(base,src,dirs_exist_ok=True);before=originals(src)
p=src/'src/app/runtime.js';old=p.read_text();s=old
s=replace(s,'let renderer,scene,camera,key,fill,rim,environment,thumbScene,thumbCamera,library,hero,heroMats;','let renderer,scene,camera,key,fill,rim,environment,thumbScene,thumbCamera,library,hero,heroMats,eb1;')
s=replace(s,'environment=makeEnvironment();scene=new T.Scene();','environment={texture:null};scene=new T.Scene();')
anchor='thumbCamera=new T.PerspectiveCamera(34,1,.5,4000);'
s=replace(s,anchor,anchor+"\n eb1=KAOPU_EB1.attachThree(T,{renderer,scene,center:[0,100,0],radius:300,secondaryScenes:[thumbScene],requestRender:()=>invalidateView(true)});environment.texture=scene.environment;")
lines=s.splitlines();s='\n'.join(l for l in lines if not l.startswith(" if(id==='studio'){key.") and not l.startswith(" if(id==='neutral'){key.") and not l.startswith(" if(id==='rake'){key."))+'\n'
s=replace(s,'renderer.shadowMap.needsUpdate=true;invalidateView(true);revision++;','if(ready)eb1.store.preset(id===\'studio\'?\'reference\':id);else eb1.apply();renderer.shadowMap.needsUpdate=true;invalidateView(true);revision++;')
p.write_text(s)
html=replace((base/'public-lite.html').read_text(),old,s)
html=inject(html);put(OUT/'leather/index.html',html)
receipt('leather',src,before,['src/app/runtime.js'])
receipts['leather']['nativeKernelRecompiled']=False
receipts['leather']['nativeKernelPolicy']='Reuse byte-identical frozen R16 compiled physics; lighting-only link, no native source claims.'

# Hats: use the current native source linker, not an older geometry generator.
hbase=INPUT/'hat';src=NATIVE/'hat';shutil.copytree(hbase,src,dirs_exist_ok=True);h=src/'hat-workshop/r09';before=originals(h)
p=h/'app.js';s=p.read_text()
a="const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();"
s=replace(s,a,'// EB1 supplies one owned environment; no duplicated legacy PMREM.\nconst env={texture:null};')
a='plinth.castShadow=true;scene.add(plinth);'
s=replace(s,a,a+"\nconst eb1=KAOPU_EB1.attachThree(T,{renderer,scene,center:[0,0,0],radius:.6,requestRender});scene.fog=null;\ndocument.addEventListener('change',e=>{if(e.target.id==='light')eb1.store.preset(({studio:'reference',neutral:'neutral',raking:'rake'})[e.target.value]||'reference');});")
s='\n'.join(l for l in s.splitlines() if not any(l.startswith(" if(s.light==='"+q+"')") for q in ['studio','neutral','raking']))+'\n'
s=replace(s," floor.visible=cameraMode!=='inside';measurementOverlay(profile,state);"," eb1.apply();floor.visible=cameraMode!=='inside';measurementOverlay(profile,state);")
p.write_text(s)
subprocess.run([sys.executable,str(h/'build.py'),'--source','53dfc29039450fb5892aaa0348c0eda63f2dba78'],check=True)
put(OUT/'hat/index.html',inject((h/'index.html').read_text()))
receipt('hat',h,before,['app.js','index.html','BUILD_MANIFEST.json'])

# Native WebGL2 denim keeps all yarn, cotton BRDF/transmission, topology and solver
# kernels. The same owned environment is reduced to eight positive quadrature
# bins; Three.js uses PMREM instead. The approximation is explicit in the receipt.
src=NATIVE/'denim';d=AUDIT/'denim/denim-workshop/r12-1';shutil.copytree(d,src,dirs_exist_ok=True);before=originals(src)
p=src/'app.js';s=p.read_text()
a="const presets={raw:"
s=replace(s,a,"const ebStore=KAOPU_EB1.createStore();let ebValues=KAOPU_EB1.sampleProfile(ebStore.get());KAOPU_EB1.mountUI(ebStore);globalThis.__EB1__={store:ebStore,audit:()=>({...ebStore.audit(),engine:'native WebGL2',environment:'owned-positive-quadrature-8',lights:2,nonLightingMutation:false})};ebStore.subscribe(()=>{ebValues=KAOPU_EB1.sampleProfile(ebStore.get());shadowKey='';macroShadowKey='';viewKey='';request();});\n"+a)
s=replace(s,'uniform vec3 uKeyPos,uKeyColor,uFillColor;','uniform vec3 uKeyPos,uKeyColor,uFillColor,uEB1Key,uEB1Rim,uEB1RimColor;uniform vec3 uEB1Directions[8],uEB1Weights[8];uniform float uEB1Background;')
s=replace(s,'vec3 L=safeUnit(uKeyPos-W);','vec3 L=uEB1Key;')
s=replace(s,'vec3 F=safeUnit(vec3(110,22,120)-W),R=safeUnit(vec3(40,95,-110)-W);','vec3 F=vec3(0,1,0),R=uEB1Rim;')
s=replace(s,'light+=(fiberReflect(c,N,T,V,F)+fiberTransmission(c,N,T,V,F,diameter))*uFillColor;','for(int e=0;e<8;e++){vec3 EL=uEB1Directions[e];light+=(fiberReflect(c,N,T,V,EL)+fiberTransmission(c,N,T,V,EL,diameter))*uEB1Weights[e];}')
s=replace(s,'vec3 rim=uLight==4?vec3(3.2,3.35,3.55):vec3(.50,.55,.65);','vec3 rim=uEB1RimColor;',2)
s=replace(s,'return light+c*(.12+.035*sat(N.y));','return light; // Ambient energy is supplied by the EB1 environment integral.')
s=replace(s,'L=normalize(uKeyPos-vW);','L=uEB1Key;')
s=replace(s,'R=safeUnit(vec3(40,95,-110)-vW);','R=uEB1Rim;')
s=replace(s,'lit+=c*(.32+uScatter*.25);','for(int e=0;e<8;e++){vec3 EL=uEB1Directions[e];lit+=(fiberReflect(c,N,T,V,EL)+fiberTransmission(c,N,T,V,EL,vDiameter))*uEB1Weights[e];}')
start=s.index('function configureLights(){');end=s.index('\nfunction shadowUniforms(',start)
s=s[:start]+'''function configureLights(){
 const p=ebStore.get();state.exposure=p.exposure;keyPos=ebValues.keyDirection.map((v,i)=>v*230+(i===1?-8:0));keyColor=ebValues.keyColor;fillColor=[.12,.12,.12].map(x=>x*p.environment);lightVP=mul(ortho(-130,130,-125,125,1,600),look(keyPos,[0,-8,0]));
}'''+s[end:]
a=" mat(p,'uLightVP',lightVP);"
s=replace(s,a," v3(p,'uEB1Key',ebValues.keyDirection);v3(p,'uEB1Rim',ebValues.rimDirection);v3(p,'uEB1RimColor',ebValues.rimColor);gl.uniform3fv(U(p,'uEB1Directions[0]'),ebValues.environment.flatMap(x=>x.direction));gl.uniform3fv(U(p,'uEB1Weights[0]'),ebValues.environment.flatMap(x=>x.color));uf(p,'uEB1Background',ebStore.get().background);\n"+a)
s=replace(s,'vec3 c=vec3(.21,.217,.224);','vec3 c=vec3(uEB1Background);')
s=replace(s,'c=mix(c,vec3(.30,.315,.332),haze);','c=mix(c,vec3(uEB1Background*1.25),haze);')
s=replace(s,"const presets={raw:","document.addEventListener('input',e=>{if(e.target.id==='exposure')ebStore.patch({exposure:Number(e.target.value)});});document.addEventListener('change',e=>{if(e.target.id==='light')ebStore.preset(['reference','rake','reference','neutral','reference'][Number(e.target.value)]||'reference');});\nconst presets={raw:")
s=s.replace("document.querySelectorAll('[data-preset]')","document.querySelectorAll('[data-preset]:not(#eb1-panel [data-preset])')")
p.write_text(s)
p=src/'sampling.js';s=p.read_text();s=replace(s,"in vec2 uv;out vec4 O;","in vec2 uv;out vec4 O;\n${KAOPU_EB1.neutralGLSL}")
s=replace(s,'c*=exposure;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);c=pow(clamp(c,0.,1.),vec3(1./2.2));','c=eb1Neutral(c*exposure);c=mix(12.92*c,1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,step(vec3(.0031308),c));')
p.write_text(s)
subprocess.run([sys.executable,str(src/'build.py')],check=True)
# The deterministic native packed loader requires EB1 before evaluating any shader.
put(OUT/'denim/index.html',inject((src/'index.html').read_text()))
receipt('denim',src,before,['app.js','sampling.js','index.html','BUILD_MANIFEST.json','public-lite.html'])
receipts['denim']['environmentApproximation']='Eight positive luminance-centroid solid-angle bins, same original analytic radiance field; not pixel-identical to PMREM.'

# Shoe R09 was still an incomplete active source at audit. Integrate the latest
# fully delivered R08 rather than silently execute another window's migration.
src=NATIVE/'shoe';shutil.copytree(INPUT/'shoe',src,dirs_exist_ok=True)
REPO='haihao0307/Humanoid-Rig-Lab-Next';REF='661fb28a57c3fc1c327418c1774f3b2f3b1f3e03';seen=set()
def get_dependency(p):
 p=p.resolve();rel=p.relative_to(src.resolve()).as_posix()
 if not rel.startswith(('shoe-workshop/','leather-workshop/')):raise ValueError('Unexpected native dependency '+rel)
 if not p.exists():
  u=f'https://raw.githubusercontent.com/{REPO}/{REF}/{rel}'
  with urllib.request.urlopen(u,timeout=60) as r:put(p,r.read())
 if rel in seen:return
 seen.add(rel)
 if p.suffix in ['.mjs','.js']:
  for q in re.findall(r'(?:from\s*|import\s*)[\'\"]([^\'\"]+)[\'\"]',p.read_text()):
   if q.startswith('.'):get_dependency(p.parent/q)
shoe=src/'shoe-workshop/r08'
get_dependency(shoe/'src/main.mjs');get_dependency(shoe.parent/'r03/style.css');before=originals(src)
p=shoe/'src/main.mjs';s=p.read_text();a=' const presenter=installRenderGate(A,info=>'
# Insert after the complete native renderer gate is installed.
line=next(l for l in s.splitlines() if l.startswith(a))
s=replace(s,line,line+"\n const eb1=KAOPU_EB1.attachThree(T,{renderer:A.renderer,scene:A.scene,center:[0,75,0],radius:245,requestRender:()=>A.render()});const ebDraw=A.renderer.render.bind(A.renderer);A.renderer.render=function(sc,cam){if(sc===A.scene)eb1.ensure();return ebDraw(sc,cam);};")
p.write_text(s)
# Resolve pinned native npm dependencies without committing dependency folders.
modules=Path(os.environ.get('EB1_NODE_MODULES','/tmp/eb1-tools/node_modules'))
if not (src/'node_modules').exists():(src/'node_modules').symlink_to(modules,target_is_directory=True)
subprocess.run(['node',str(shoe/'tools/build.mjs')],check=True)
put(OUT/'shoe/index.html',inject((shoe/'public-lite.html').read_text()))
receipt('shoe',src,before,['shoe-workshop/r08/src/main.mjs','shoe-workshop/r08/public-lite.html','shoe-workshop/r08/BUILD_MANIFEST.json'])
receipts['shoe']['baseline']={'repo':REPO,'sha':REF,'runtime':'R08 verified baseline; active R09 excluded'}

# The garment app retains its entire native data/physics pipeline and filesystem.
src=NATIVE/'tailor';shutil.copytree(INPUT/'tailor/kaopu-tailor-workbench/material-products/r04-4-1',src,dirs_exist_ok=True);before=originals(src)
p=src/'lighting.mjs';s=p.read_text()
a='this.scene.add(this.floor);this.dirty();'
s=replace(s,a,"this.scene.add(this.floor);this.lamp.userData.eb1Diagnostic=true;this.eb1=KAOPU_EB1.attachThree(THREE,{renderer:this.renderer,scene:this.scene,center:[0,.9,0],radius:1.2,requestRender:()=>viewer.render()});this.savedEnvironment=this.scene.environment;this.eb1.store.subscribe(()=>{if(this.mode==='single')this.applySingleProfile();});this.dirty();")
s=replace(s,' dirty(){',' applySingleProfile(){const p=this.eb1.store.get();this.eb1.group.visible=false;this.scene.environment=null;this.lamp.visible=true;this.lamp.color.set(p.keyColor);this.lamp.intensity=p.key*1.4;this.renderer.toneMappingExposure=p.exposure;this.dirty();}\n dirty(){')
s=replace(s,"this.lamp.visible=true;this.floor.visible=false;this.aim();", "this.lamp.visible=true;this.floor.visible=false;this.applySingleProfile();this.aim();")
s=replace(s,'this.originalLights.forEach(l=>l.visible=true);this.lamp.visible=false;','this.originalLights.forEach(l=>l.visible=false);this.lamp.visible=false;this.eb1.group.visible=true;')
s=replace(s,"this.renderer.setClearColor('#c9ccc8');this.floor.visible=true;this.dirty();", "this.floor.visible=true;this.eb1.apply();this.dirty();")
s=replace(s,'return{mode:this.mode,','return{eb1:this.eb1.audit(),mode:this.mode,')
p.write_text(s)
p=src/'app.mjs';s=p.read_text()
# Existing exposure slider edits the same profile, not a competing renderer value.
a="$('exposure').oninput="
idx=s.index(a);end=s.index(';',idx)
print('native exposure handler',s[idx:end+1])
s=replace(s,"$('exposure').oninput=()=>{viewer.renderer.toneMappingExposure=Number($('exposure').value);viewer.render();}","$('exposure').oninput=()=>{lighting.eb1.store.patch({exposure:Number($('exposure').value)});viewer.render();}")
# A restoration gate re-applies EB1 after the native viewer restores its context.
s=replace(s,"env?.dispose();studio();viewer.renderer.setClearColor('#d0d3d0');","env?.dispose();env=null;lighting.eb1.apply();if(lighting.mode==='single')lighting.applySingleProfile();")
p.write_text(s)
p=src/'index.html';p.write_text(inject(p.read_text()))
# Full runtime copy; old research screenshots/build scripts are not part of page load.
shutil.copytree(src,OUT/'tailor',dirs_exist_ok=True)
receipt('tailor',src,before,['lighting.mjs','app.mjs','index.html'])
for name,q in receipts.items():
 q['publicFiles']={str(p.relative_to(OUT/name)):sha(p.read_bytes()) for p in (OUT/name).rglob('*') if p.is_file()}
put(OUT/'EB1_MANIFEST.json',json.dumps({'version':'EB1-1.0.0','coreSHA256':CORE_SHA,'sourceCommit':os.environ.get('GITHUB_SHA','LOCAL'),'reference':SNAP['reference'],'workbenches':receipts,'privateKnit':'Kept in original private repository; not published here.','publicBrowserVerified':False,'userAccepted':False},ensure_ascii=False,indent=2))
put(ROOT/'SOURCE_PATCH_RECEIPT.json',json.dumps(receipts,ensure_ascii=False,indent=2))
print('EB1 source build complete; runtime/browser/public verification is still required.')

put(OUT/'FILES.json',json.dumps({str(p.relative_to(OUT)):sha(p.read_bytes()) for p in OUT.rglob('*') if p.is_file() and p.name!='FILES.json'},indent=2))
