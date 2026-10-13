"""One-time B1 source registration. Normal r17 builds never import this tool."""
from pathlib import Path
import json,hashlib,shutil
P=Path(__file__).resolve().parent;B=P.parent/'r16';R=P.parent/'r17'
def sha(b):return hashlib.sha256(b).hexdigest()
def once(s,a,b):
 if s.count(a)!=1:raise ValueError('Source anchor drift: '+a[:100])
 return s.replace(a,b,1)
def edit(p,f):
 p=R/p;p.write_text(f(p.read_text()))
def prepare():
 if R.exists():raise FileExistsError('Never overwrite an existing canonical r17 directory')
 old=json.loads((B/'canonical.lock.json').read_text())
 for n,v in old['files'].items():
  q=B/n;assert sha(q.read_bytes())==v['sha256'],n
  p=R/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(q,p)
 for n in ['.gitignore','requirements-build.txt','qa-geometry-equivalence.cjs','qa-pose-stream.cjs','qa-app-interfaces.cjs','qa-frame-flow.cjs','qa-browser-s2b.py','qa-render-batch.py','qa-capture-s1b2.py']:
  shutil.copy2(B/n,R/n)
 for a,b in [('pose-cache.js','src/render/pose-cache.js'),('diagnostics.js','src/app/diagnostics.js')]:
  p=R/b;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(P/a,p)
 edit('build.py',lambda s:s.replace('R16-RENDER','R17-B1').replace('R16.0-RENDER','R17.0-B1').replace('candidate-r16.html','candidate-r17.html'))
 m=json.loads((R/'assembly.json').read_text());m.update(phase='B1',runtimeIdentity='R17.0-B1',buildArchitecture='R17-B1')
 for k,file in [('b1-cache','src/render/pose-cache.js'),('b1-status','src/app/diagnostics.js')]:m['modules'][k]={'file':file,'format':'text','ensureFinalLF':True}
 j=m['main']['join'];i=j.index({'module':'app-runtime'});j.insert(i,{'module':'b1-cache'});i=j.index({'module':'app-composition'});j.insert(i,{'module':'b1-status'});(R/'assembly.json').write_text(json.dumps(m,indent=2)+'\n')
 def panels(s):
  s=once(s,"s.vertexShader=s.vertexShader.replace('#include <common>'", "if(rig.poseCache){s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\\nattribute vec3 b1Position;attribute vec3 b1Normal;varying vec3 vAgeMask;varying vec3 vRestMM;').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\\nobjectNormal=b1Normal;').replace('#include <begin_vertex>','#include <begin_vertex>\\ntransformed=b1Position;vAgeMask=ageMask;vRestMM=position;');}else s.vertexShader=s.vertexShader.replace('#include <common>'")
  s=s.replace('attribute vec3 b1Position;attribute vec3 b1Normal;varying vec3 vAgeMask;', 'attribute vec3 b1Position;attribute vec3 b1Normal;attribute vec3 ageMask;varying vec3 vAgeMask;')
  s=once(s,"previousKey+'-R16-integer-node-fetch-'+ageEnabled","previousKey+(rig.poseCache?'-R17-cache-':'-R16-integer-node-fetch-')+ageEnabled")
  s=once(s,'const rig=root.userData.rig;if(rig.staticPreview)return;const cache=', 'const rig=root.userData.rig;rig.skinSource=SKIN_HEADER;if(rig.staticPreview)return;const cache=')
  return s
 edit('src/geometry/panels.js',panels)
 def runtime(s):
  s=s.replace("const VERSION='R16.0-RENDER'","const VERSION='R17.0-B1'")
  s=once(s,'hero=makeProduct(id,heroMats,craftConfig);scene.add(hero);','hero=makeProduct(id,heroMats,craftConfig);B1PoseCache.attach(hero,renderer);scene.add(hero);')
  s=once(s,'renderer.clear(true,true,true);renderer.render(scene,camera);','renderer.clear(true,true,true);renderer.render(scene,camera);if(mode===\'products\')productSolver?.markSubmitted?.();')
  s=once(s,' if(allDirty){presentationStats.fullDraws++;', " if(mode==='products'&&(!partial||dirty||allDirty))hero?.userData.rig?.poseCache?.prepare();\n if(allDirty){presentationStats.fullDraws++;")
  s=once(s,'function buildPhysics(f){destroyGeometry(physicsRoot);','function buildPhysics(f){physMid?.dispose();releaseSpecimenMaterials(physicsRoot);destroyGeometry(physicsRoot);')
  s=once(s,'physCloth=new T.Mesh(g,productMaterials(library.hero.material).shell);','const specimenMats=productMaterials(library.hero.material);physicsRoot.userData.ownedMaterials=[specimenMats.back,specimenMats.edge,specimenMats.thread,specimenMats.brass];physCloth=new T.Mesh(g,specimenMats.shell);')
  s=once(s,"const stoneMat=new T.MeshStandardMaterial({color:'#9d9b8a',roughness:.94});", "physicsRoot.userData.ownedMaterials.push(metal,dark);const stoneMat=new T.MeshStandardMaterial({color:'#9d9b8a',roughness:.94});physicsRoot.userData.ownedMaterials.push(stoneMat);")
  s=once(s,"$('resetProduct').onclick=()=>{productSolver.reset();updateSkin(hero,productSolver);syncGripCollider();updateGrabUI();setView('home');$('grabState').textContent=grabMode?'已归位 · 按住皮料抓起':'已归位';};", "$('resetProduct').onclick=async()=>{const current=productSolver;try{await current.reset();if(current!==productSolver||current.disposed)return;updateSkin(hero,current);syncGripCollider();updateGrabUI();setView('home');$('grabState').textContent=grabMode?'已归位 · 按住皮料抓起':'已归位';}catch(e){fail(e);}};")
  s=once(s,"resetGrab:async()=>{await productSolver.reset();updateSkin(hero,productSolver);syncGripCollider();invalidateView();render();},","resetGrab:async()=>{const current=productSolver;await current.reset();if(current!==productSolver||current.disposed)return;updateSkin(hero,current);syncGripCollider();invalidateView();render();},")
  s=once(s,"errors.push(msg);", "errors.push(msg);if(errors.length>100)errors.shift();")
  s=once(s,"worker.onerror=e=>fail(e.message);", "worker.onerror=e=>{const bad=worker;worker=null;bad?.terminate();physicsPlaying=false;physicsBusy=false;const error=Error(e.message);for(const p of workerPending.values())p.reject(error);workerPending.clear();fail(error);};")
  s=once(s,"async function resetPhysics(){physicsPlaying=false;workerEpoch++;", "async function resetPhysics(){physicsPlaying=false;const resetEpoch=++workerEpoch;")
  s=once(s,"stoneMass:.045,dropHeight:.04}});physicsPlaying=mode==='physics';", "stoneMass:.045,dropHeight:.04}});if(resetEpoch!==workerEpoch)return;physicsPlaying=mode==='physics';")
  return s
 edit('src/app/runtime.js',runtime)
 def client(s):
  s=once(s,'this.appliedPoses=0;', 'this.appliedPoses=0;this.inputHistory=new Map();this.presentationSamples=[];this.lastPoseMeta=null;this.appliedPoseMeta=null;')
  s=once(s,"this.worker.onerror=e=>{this.failed=e.message;this._active=false;this.onError?.(Error(e.message));};", "this.worker.onerror=e=>{this.failed=e.message;this._active=false;const error=Error(e.message);for(const p of this.pending.values())p.reject(error);this.pending.clear();this.onError?.(error);};")
  s=once(s,'this.x.set(r.positions);this.pendingPose=true;', 'this.x.set(r.positions);this.lastPoseMeta={sequence:r.inputSequence,receivedAt:performance.now(),step:r.report?.steps};this.pendingPose=true;')
  s=once(s,'this.worker.postMessage({id,op,...data});','try{this.worker.postMessage({id,op,...data});}catch(error){this.pending.delete(id);reject(error);}')
  s=once(s,'this.appliedPoses++;this.onUpdate?.();','this.appliedPoses++;this.appliedPoseMeta=this.lastPoseMeta?{...this.lastPoseMeta,appliedAt:performance.now()}:null;this.onUpdate?.();')
  s=once(s,'inputSequence:++this.inputSequence}).catch', 'inputSequence:this.recordInput()}).catch')
  s=once(s,'this.inputSequence++;if(this.inputQueued)', 'this.recordInput();if(this.inputQueued)')
  s=once(s,'reset(){this._active=false;', 'reset(){this.inputHistory.clear();this.lastPoseMeta=this.appliedPoseMeta=null;this._active=false;')
  s=once(s,' dispose(){', ''' recordInput(){const sequence=++this.inputSequence;this.inputHistory.set(sequence,performance.now());while(this.inputHistory.size>128)this.inputHistory.delete(this.inputHistory.keys().next().value);return sequence;}
 markSubmitted(){const q=this.appliedPoseMeta;if(!q||q.submitted)return;q.submitted=true;const issued=this.inputHistory.get(q.sequence);if(issued===undefined)return;const now=performance.now();this.presentationSamples.push({sequence:q.sequence,step:q.step,receiveMS:q.receivedAt-issued,applyMS:q.appliedAt-issued,submitMS:now-issued});if(this.presentationSamples.length>128)this.presentationSamples.shift();}
 presentationTiming(){const rows=this.presentationSamples;return{sampleCount:rows.length,historyLimit:128,last:rows.at(-1)||null,samples:rows.map(r=>({...r})),scope:'input to main-thread draw submission containing a completed physical pose; NOT display or GPU completion'};}
 dispose(){''')
  s=once(s,'this.worker.terminate();','this.worker.onmessage=null;this.worker.onerror=null;this.worker.terminate();this.onUpdate=this.onPoseAvailable=this.onError=null;this.inputHistory.clear();this.presentationSamples.length=0;')
  return s
 edit('src/workers/client.js',client)
 edit('src/app/composition.js',lambda s:once(once(once(once(s,'releaseProductMaterials(root);destroyGeometryBase(root);','root.userData.releaseProductRegistry?.();B1PoseCache.release(root);releaseProductMaterials(root);destroyGeometryBase(root);'),'updateGrabUIBase();updateSlowPhysicsNote();updateInputMetrics();','updateGrabUIBase();updateSlowPhysicsNote();updateInputMetrics();updateB1Status();'),'initInputPerformance();initFrameLifecycle();','initInputPerformance();initFrameLifecycle();initB1Controls();'),'inspectGrip,measureShell,thicknessView,recipe,','inspectGrip,measureShell,thicknessView,recipe,b1Report,setB1Diagnostics,'))
 edit('src/products/catalogue.js',lambda s:once(s,"activeProducts.set(id,root);","activeProducts.set(id,root);root.userData.releaseProductRegistry=()=>{if(activeProducts.get(id)===root)activeProducts.delete(id);};"))
 edit('src/app/lifecycle.js',lambda s:s+'''\n// Explicitly owned specimen assets: never dispose the shared appearance catalogue.
function releaseSpecimenMaterials(root){if(!root)return;for(const m of new Set(root.userData.ownedMaterials||[])){if(!m)continue;m.map?.dispose();m.normalMap?.dispose();m.dispose();}root.userData.ownedMaterials=[];}
''')
 edit('qa-pose-stream.cjs',lambda s:once(s,"c.dispose();made.onmessage(","const queued=made.onmessage;c.dispose();queued("))
 css='''\n.b1-actions{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.b1-actions button{font-size:10px;padding:6px 8px}#b1Status{display:block;font-size:11px;line-height:1.5;margin:6px 0;color:#596452}#b1Status[data-state=FAILED]{color:#a42b25}#b1Details{white-space:pre-line;font-size:10px;line-height:1.7}body:not(.b1-diagnostics) #b1Details,body:not(.b1-diagnostics) #inputMetrics,body:not(.b1-diagnostics) #grabStats{display:none}'''
 ui='''<div class="b1-actions"><button id="b1Diagnostics" aria-pressed="false">打开诊断</button><button id="b1Export">导出诊断</button><button id="b1Recover" title="重建当前测试并归位；保持外观与工艺设置">重建当前测试</button></div><strong id="b1Status">尚未求解</strong><div id="b1Details"></div>'''
 edit('ui/template.html',lambda s:once(once(s,'</style>',css+'\n</style>'),'<div id="grabStats"></div>',ui+'<div id="grabStats"></div>'))
 for n in ['qa-browser-s2b.py','qa-render-batch.py']:
  edit(n,lambda s:s.replace('R16.0-RENDER','R17.0-B1').replace('candidate-r16.html','candidate-r17.html').replace("R.parent/'r15/public-lite.html'","R.parent/'r16/public-lite.html'"))
 for name in ['qa-b1.cjs','qa-b1-browser.py','qa-b1-performance.py','verify-b1.py','README.md','B1_ANCHOR.json']:
  if (P/name).exists():shutil.copy2(P/name,R/name)
 files={}
 for p in R.rglob('*'):
  if p.is_file() and p.name!='canonical.lock.json':files[str(p.relative_to(R))]={'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
 (R/'canonical.lock.json').write_text(json.dumps({'schema':'kaopu/leather-canonical-lock@1','phase':'B1','files':dict(sorted(files.items()))},indent=2)+'\n')
 print(json.dumps({'registered':len(files),'root':str(R),'version':'R17.0-B1'}))
if __name__=='__main__':prepare()
