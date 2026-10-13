"""One-time source registration. Normal R16 build executes none of these adapters."""
from pathlib import Path
import hashlib,json,shutil
H=Path(__file__).resolve().parent;W=H.parent;B=W/'r15';R=W/'r16'
def sha(b):return hashlib.sha256(b).hexdigest()
def exact(s,a,b):
 if s.count(a)!=1:raise ValueError('Source anchor drift: '+a[:100])
 return s.replace(a,b,1)
assert sha((B/'public-lite.html').read_bytes())=='8d885617f72403d67adcd678a53425c3033a8f76abe8a1a06c86c3f45536597a'
if R.exists():raise RuntimeError('R16 already registered; never overwrite reviewed source')
shutil.copytree(B,R,ignore=shutil.ignore_patterns('qa','out','node-lib.cjs','__pycache__','public-lite.html','DELIVERY.json','BUILD_RESULT.json'))
p=R/'src/geometry/panels.js';s=p.read_text()
s=exact(s,'texture2D(uProductNodes,vec2(1./6.,(id+.5)/uProductNodeCount)).xyz','texelFetch(uProductNodes,ivec2(0,int(id)),0).xyz')
s=exact(s,'texture2D(uProductNodes,vec2(x,(id+.5)/uProductNodeCount)).xyz','texelFetch(uProductNodes,ivec2(int(x*3.),int(id)),0).xyz')
s=exact(s,"'-R07-product-skin-'","'-R16-integer-node-fetch-'");p.write_text(s)
for name in ['runtime.js','view-polish.js','atelier-controls.js']:
 p=R/'src/app'/name;s=p.read_text()
 if name=='runtime.js':
  s=s.replace('R15.0-S2B','R16.0-RENDER')
  s=exact(s,"b.onpointerenter=()=>{hover=entry;};b.onpointerleave=()=>{hover=null;allDirty=true;};","b.onpointerenter=()=>{hover=entry;invalidateThumbnail(entry);};b.onpointerleave=()=>{hover=null;invalidateThumbnail(entry);};")
  s=exact(s,"b.onpointerenter=()=>{hover=e;};b.onpointerleave=()=>{hover=null;allDirty=true;};","b.onpointerenter=()=>{hover=e;invalidateThumbnail(e);};b.onpointerleave=()=>{hover=null;invalidateThumbnail(e);};")
 s=s.replace('allDirty=dirty=true;','invalidateView(true);').replace('dirty=true;allDirty=true;','invalidateView(true);').replace('dirty=true;','invalidateView();')
 if name=='runtime.js':
  s=exact(s,"setView('home');allDirty=true;revision++;","setView('home');invalidateView(true);revision++;")
  s=exact(s,'function render(t=0){','function render(t=0,partial=false){')
  s=exact(s,'if(allDirty){renderer.setScissorTest(false);','if(allDirty){presentationStats.fullDraws++;renderer.setScissorTest(false);')
  s=exact(s,"const r=visibleViewport($('stage'));if(r){","const r=visibleViewport($('stage'));if(r&&(!partial||dirty||allDirty)){presentationStats.sceneDraws++;")
  s=exact(s,"if(allDirty){for(const e of [...materialCards,...productCards])renderThumb(e,t);}else if(hover&&t-lastHover>50){renderThumb(hover,t);lastHover=t;}","const hoverRedrawn=hover&&(allDirty||thumbnailDirty.has(hover));if(allDirty){for(const e of [...materialCards,...productCards])renderThumb(e,t);}else{for(const e of thumbnailDirty)renderThumb(e,t);}\n thumbnailDirty.clear();if(hoverRedrawn)lastHover=t;")
  s=exact(s,'function renderThumb(entry,time=0){const r=visibleViewport(entry.element);if(!r)return;','function renderThumb(entry,time=0){const r=visibleViewport(entry.element);if(!r)return;presentationStats.thumbnailDraws++;')
  start=s.index('function loop(t){');end=s.index('async function switchMode',start)
  s=s[:start]+'''function loop(t){
 viewFrame=null;presentationStats.callbacks++;
 if(!ready||document.hidden||mode==='baseline')return;
 inViewFrame=true;
 try{
  const dt=last?Math.min(.08,(t-last)/1000):0;last=t;
  if(turning){yaw+=dt*.18;dirty=true;}
  if(hover&&t-lastHover>50)thumbnailDirty.add(hover);
  if(mode==='physics'&&physicsPlaying&&!physicsBusy&&physState&&!physState.report.failed){physicsBusy=true;const start=performance.now();askWorker('step',{count:4}).then(()=>{actualSpeed=(4/240)/Math.max(.001,(performance.now()-start)/1000);physicsBusy=false;requestViewFrame();}).catch(e=>{physicsBusy=false;fail(e);});}
  if(mode==='products'&&productSolver?.pendingPose)productSolver.flushPose();
  if(dirty||allDirty||thumbnailDirty.size)render(t,true);
 }finally{inViewFrame=false;}
 if(turning||hover||(mode==='physics'&&physicsPlaying)||dirty||allDirty||thumbnailDirty.size)requestViewFrame();
}
'''+s[end:]
  s=exact(s,'productSolver.onError=fail;productSolver.onUpdate=','productSolver.onError=fail;productSolver.onPoseAvailable=requestViewFrame;productSolver.onUpdate=')
  s=exact(s,'render();requestAnimationFrame(loop);','render();requestViewFrame();')
  s=exact(s,'window.LEATHER_ATELIER={inspectCut,','window.LEATHER_ATELIER={presentation:presentationDiagnostics,inspectCut,')
  s=exact(s,"$('autoRotate').classList.remove('active');\n $('tabProducts')","$('autoRotate').classList.remove('active');\n requestViewFrame();\n $('tabProducts')")
 p.write_text(s)
p=R/'src/workers/client.js';s=exact(p.read_text(),'this.pendingPose=true;this.receivedPoses++;','this.pendingPose=true;this.receivedPoses++;this.onPoseAvailable?.();');p.write_text(s)
p=R/'src/app/composition.js';s=exact(p.read_text(),'initRestoredControls();initEdgeInspection();initCraftControls();initInputPerformance();','initRestoredControls();initEdgeInspection();initCraftControls();initInputPerformance();initFrameLifecycle();');p.write_text(s)
shutil.copy2(H/'frame-flow.js',R/'src/app/frame-flow.js')
p=R/'build.py';s=p.read_text().replace('R15-S2B','R16-RENDER').replace('R15.0-S2B','R16.0-RENDER').replace('candidate-r15.html','candidate-r16.html');p.write_text(s)
p=R/'assembly.json';m=json.loads(p.read_text());m.update(phase='S2C',runtimeIdentity='R16.0-RENDER',buildArchitecture='R16-RENDER');m['modules']['frame-flow']={'file':'src/app/frame-flow.js','format':'text','ensureFinalLF':True};j=m['main']['join'];i=j.index({'module':'app-runtime'});j.insert(i,{'module':'frame-flow'});p.write_text(json.dumps(m,indent=2)+'\n')
p=R/'qa-app-interfaces.cjs';s=exact(p.read_text(),"function render(){trace.push('render');}","function render(){trace.push('render');}\nfunction invalidateView(){dirty=true;}function initFrameLifecycle(){}");p.write_text(s)
p=R/'qa-browser-s2b.py';s=p.read_text().replace('R15.0-S2B','R16.0-RENDER').replace('candidate-r15.html','candidate-r16.html').replace("'s2b'","'render-batch'");p.write_text(s)
for name in ['verify-render.py','qa-frame-flow.cjs','qa-render-batch.py']:shutil.copy2(H/name,R/name)
lock=json.loads((R/'canonical.lock.json').read_text())
for name,q in lock['files'].items():
 if (R/name).exists():q['sha256']=sha((R/name).read_bytes());q['bytes']=(R/name).stat().st_size;q.pop('gitBlob',None)
lock['files']['src/app/frame-flow.js']={'sha256':sha((R/'src/app/frame-flow.js').read_bytes()),'bytes':(R/'src/app/frame-flow.js').stat().st_size}
(R/'canonical.lock.json').write_text(json.dumps(lock,indent=2)+'\n')
(R/'RENDER_BATCH_ANCHOR.json').write_text(json.dumps({'task':'LEATHER-S2C-RENDER-BATCH','baseCommit':'57865c3a033a7aee7f3dc02834ee7d896425a877','baselineBuild':'70883deb4659b601faacf5eb49277eee4774b824','primaryDefect':'Unnecessary GPU/display work and idle polling','scope':['integer texel fetch with same node values','independent scene/thumbnail invalidation','single demand-driven frame clock','visibility restore and latest-pose wakeup','continuous interaction regression'],'protected':['native C/WASM','physical timestep/iterations/contact/friction','material grain/wear','geometry/gauge','R15 pose credits and explicit command semantics','old versions/root license/main'],'referenceMeasurementRun':38360802190,'noImageSubstitution':True,'publicDelivery':'PENDING','visualAcceptance':'PENDING'},indent=2)+'\n')
print('Registered independent R16 source; production changes await verification')
