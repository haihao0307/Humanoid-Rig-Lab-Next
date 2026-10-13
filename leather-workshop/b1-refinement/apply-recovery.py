"""One-time canonical registration; never executed by the runtime or normal build.
Validate every inherited input before any edit. Performance/visual gates unchanged.
"""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parent;R=ROOT.parent/'r17';marker=R/'RECOVERY_SOURCE.json'
if marker.exists():raise SystemExit('Recovery source already registered; use normal build, do not overwrite it')
lock=json.loads((R/'canonical.lock.json').read_text())
for name,row in lock['files'].items():
 data=(R/name).read_bytes()
 assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],'Source drift: '+name
changed=set()
def edit(name,a,b):
 p=R/name;s=p.read_text();assert s.count(a)==1,'Contract drift '+name+': '+a[:80];p.write_text(s.replace(a,b,1));changed.add(name)
def copy(src,dst):
 p=R/dst;assert not p.exists(),dst;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/src,p);changed.add(dst)
copy('production-exact-shading.js','src/render/exact-shading.js');copy('qa-shading.cjs','qa-shading.cjs')
edit('src/app/runtime.js','renderer.render(scene,camera);','B1ExactShading.prepare(scene);renderer.render(scene,camera);')
edit('src/app/runtime.js','renderer.render(thumbScene,thumbCamera);','B1ExactShading.prepare(thumbScene);renderer.render(thumbScene,thumbCamera);')
p=R/'assembly.json';a=json.loads(p.read_text());assert 'exact-shading' not in a['modules'];a['modules']['exact-shading']={'file':'src/render/exact-shading.js','format':'text','ensureFinalLF':True};j=a['main']['join'];i=next(i for i,q in enumerate(j) if q.get('module')=='app-runtime');j.insert(i,{'module':'exact-shading'});p.write_text(json.dumps(a,indent=2)+'\n');changed.add('assembly.json')
C='src/workers/client.js'
edit(C,'this.lastPoseMeta=null;this.appliedPoseMeta=null;','this.lastPoseMeta=null;this.appliedPoseMeta=null;this.lastSubmittedSequence=-1;this.terminalError=null;')
edit(C,"this.worker.onerror=e=>{this.failed=e.message;this._active=false;const error=Error(e.message);for(const p of this.pending.values())p.reject(error);this.pending.clear();this.onError?.(error);};","this.worker.onerror=e=>this.failWorker(Error(e.message));")
edit(C,"ask(op,data={}){if(this.disposed)return Promise.reject(Error('Disposed product solver'));","ask(op,data={}){if(this.disposed)return Promise.reject(Error('Disposed product solver'));if(this.terminalError)return Promise.reject(this.terminalError);")
edit(C,'markSubmitted(){const q=this.appliedPoseMeta;if(!q||q.submitted)return;q.submitted=true;const issued=this.inputHistory.get(q.sequence);if(issued===undefined)return;const now=performance.now();','markSubmitted(){const q=this.appliedPoseMeta;if(!q||q.submitted)return;q.submitted=true;const issued=this.inputHistory.get(q.sequence);if(issued===undefined||q.sequence<=this.lastSubmittedSequence)return;this.lastSubmittedSequence=q.sequence;const now=performance.now();')
edit(C,' dispose(){',' failWorker(error){if(this.disposed||this.terminalError)return;this.terminalError=error;this.failed=error.message;this._active=false;this.grab=null;this.pendingPose=false;this.lastPoseMeta=this.appliedPoseMeta=null;this.worker.onmessage=this.worker.onerror=null;this.worker.terminate();for(const p of this.pending.values())p.reject(error);this.pending.clear();this.onError?.(error);}\n dispose(){')
edit(C,'if(!this.grab||!point.every(Number.isFinite))return;','if(this.disposed||this.terminalError||!this.grab||!point.every(Number.isFinite))return;')
edit(C,'if(this.disposed||!this.grab)return;this.worker.postMessage','if(this.disposed||this.terminalError||!this.grab)return;this.worker.postMessage')
edit(C,"scope:'input to main-thread draw submission containing a completed physical pose; NOT display or GPU completion'","scope:'first main-thread draw submission per distinct observed input sequence containing a completed physical pose; NOT display or GPU completion'")
Q='qa-b1.cjs'
edit(Q,'for(let i=0;i<300;i++){now++;c.move([1,2,3]);}',"now=45;worker.onmessage({data:{positions:new Float64Array([1,2,3]),inputSequence:1,report:{steps:3,finite:true},poseSerial:40}});c.flushPose();now=50;c.markSubmitted();ok('Later physical steps with the same input are not new response samples',c.presentationTiming().sampleCount===1);\n for(let i=0;i<300;i++){now++;c.move([1,2,3]);}")
edit(Q,"ok('Worker error leaves no pending request',c.pending.size===0);c.dispose();","ok('Worker error leaves no pending request',c.pending.size===0);let afterFailure=false;try{await c.ask('audit');}catch{afterFailure=true;}ok('Fatal worker rejects new requests without leaving them pending',afterFailure&&c.pending.size===0);ok('Fatal worker detaches callbacks and terminates',worker.terminated&&worker.onmessage===null&&worker.onerror===null);c.dispose();")
D='src/app/diagnostics.js'
edit(D,'let b1DiagnosticMode=false,b1ContextLost=false;','let b1DiagnosticMode=false,b1ContextLost=false,b1ReloadRequired=false;')
edit(D,'contextLost:b1ContextLost,claims:', 'contextLost:b1ContextLost,graphicsReloadRequired:b1ReloadRequired,claims:')
edit(D,"$('b1Recover').onclick=()=>{if(mode", "$('b1Recover').onclick=()=>{if(b1ReloadRequired){location.reload();return;}if(mode")
p=R/D;s=p.read_text();start=s.index(" renderer.domElement.addEventListener('webglcontextlost'");end=s.index(' setB1Diagnostics(false);',start)
s=s[:start]+''' function graphicsRecovery(message){fail(message);const button=document.createElement('button');button.id='b1ContextReload';button.textContent='重新载入工作台';button.style.marginLeft='16px';button.onclick=()=>location.reload();$('error').append(button);$('b1Recover').textContent='重新载入工作台';$('b1Recover').title='图形资源已失效，重新载入会清空当前测试状态';}
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();b1ContextLost=true;b1ReloadRequired=true;ready=false;if(window.LEATHER_ATELIER)window.LEATHER_ATELIER.ready=false;if(viewFrame!==null){cancelAnimationFrame(viewFrame);viewFrame=null;}productSolver?.release();if(productSolver)productSolver.active=false;physicsPlaying=false;graphicsRecovery('图形上下文已丢失，测试已暂停。请重新载入以完整重建皮纹、环境贴图与姿势缓存；当前测试状态将清空。');});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{b1ContextLost=false;graphicsRecovery('图形设备已恢复，但旧图形资源不可继续使用。请重新载入工作台；不会把失效贴图当作正常恢复。');});
'''+s[end:];p.write_text(s)
Q='qa-b1-browser.py'
edit(Q,'window.__b1CacheRead=()=>',"window.__b1ContextLoss=()=>{const e=renderer.getContext().getExtension('WEBGL_lose_context');if(!e)return false;e.loseContext();setTimeout(()=>e.restoreContext(),150);return true;};\nwindow.__b1CacheRead=()=>")
edit(Q,'  else:\n   started=time.perf_counter()', '''   check('Actual context-loss extension available',p.evaluate('__b1ContextLoss()'))
   p.wait_for_function('LEATHER_ATELIER.b1Report().graphicsReloadRequired && !LEATHER_ATELIER.b1Report().contextLost')
   check('Context restoration cannot silently reuse invalid baked textures',p.evaluate('!LEATHER_ATELIER.ready && !LEATHER_ATELIER.productPhysics.active') and p.locator('#b1ContextReload').is_visible())
   p.locator('#b1ContextReload').click();p.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000)
   check('Explicit full graphics recovery rebuilds all current resources',p.evaluate('!LEATHER_ATELIER.b1Report().graphicsReloadRequired && LEATHER_ATELIER.b1Report().resources.allPoseCaches.live===1 && LEATHER_ATELIER.b1Report().resources.poseCache.updates>0'))
  else:
   started=time.perf_counter()''')
edit('verify-b1.py',"'qa-frame-flow.cjs','qa-b1.cjs'","'qa-frame-flow.cjs','qa-b1.cjs','qa-shading.cjs'")
edit('verify-b1.py',"'qa/b1/unit.json']:check","'qa/b1/unit.json','qa/b1/shading-unit.json']:check")
edit('verify-b1.py',"'nativeIdenticalToR16':True}","'nativeIdenticalToR16':True,'shadingChecks':json.loads((R/'qa/b1/shading-unit.json').read_text())['count']}")
readme=R/'README.md';readme.write_text(readme.read_text()+'''\n## B1 recovery implementation\n\nInitial B1 cache alone failed its declared performance gates (38372084727); other lanes passed. Do not promote that candidate or change thresholds. New isolation38392683686 found substantial IBL fragment cost. Same-quality38394554701 verified that a checked single-level linear PMREM atlas can use explicit LOD zero, with the same roughness tiles and two bilinear taps. Face/UV preparation is shared; mathematically zero direct-light terms skip only their BRDF evaluation. Other samplers retain the original gradient instruction. The release uses an explicit service at both render entry points; neither the vendor source nor material settings change. Three.js and MDN/Khronos provenance and existing licenses remain.\n\nInput timing now records the first submission per distinct observed input, not every later pose carrying the same input. A fatal Worker closes its pending requests and rejects new ones immediately. Context loss now stops rendering and offers an explicit full page reload: this regenerates GPU-only environment/material resources rather than pretending an invalid render target survived restoration. Reload clears the current test state; no lossless checkpoint is claimed.\n\nNew shading sampler tests, context loss/reload and the full original visual/performance/continuous-operation gates remain required. Original .85/1.10 performance ratios, eight samples and ABBA order are unchanged. First boot still uses the original renderer alpha setting. These source edits do not themselves certify delivery; DELIVERY.json must record actual successful runs.\n''');changed.add('README.md')
receipt={'schema':'kaopu/leather-b1-source-recovery@1','parentRuntime':'33df56875485243bdd1531ef04787325878c26a8','failedPerformanceRun':'38372084727','hotspotRun':'38392683686','singleLevelProbe':'38394554701','productionChanges':sorted(changed),'performanceThresholdsUnchanged':True,'physicsNativeAndMaterialsUnchanged':True,'browserValidationPending':True}
marker.write_text(json.dumps(receipt,indent=2)+'\n');changed.add('RECOVERY_SOURCE.json')
for name in changed:
 data=(R/name).read_bytes();lock['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
lock['files']=dict(sorted(lock['files'].items()));(R/'canonical.lock.json').write_text(json.dumps(lock,indent=2)+'\n')
print(json.dumps({'registeredCanonicalFiles':sorted(changed),'acceptedLegacyFilesNotModified':True},indent=2))
