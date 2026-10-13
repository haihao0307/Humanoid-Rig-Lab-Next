"""Bound redundant rendering without changing geometry, original materials or resolution."""
from pathlib import Path
import hashlib
R=Path(__file__).resolve().parent
p=R/'app.js';src=p.read_text()
if 'R09_RENDER_SCHEDULING_1' in src:
 print('Render scheduler already installed')
 raise SystemExit(0)
assert hashlib.sha256(src.encode()).hexdigest()=='99eb85d5da8118a2065bde85a0788b994f6ac00569cfb05751ecd9914d4572f2','Runtime changed since reviewed baseline; reconcile first'
def replace(a,b):
 global src
 assert src.count(a)==1,(a[:80],src.count(a))
 src=src.replace(a,b)
replace('let renderSerial=0;',"// R09_RENDER_SCHEDULING_1\nlet renderSerial=0,frameHandle=0;const renderStats={submissions:0,shadowUpdates:0,coalescedRequests:0,cancelledDuplicates:0,lastSubmitMS:0};")
replace('return {geometryCache:derivedCache.report(),','return {rendering:{...renderStats},geometryCache:derivedCache.report(),')
replace('renderer.shadowMap.enabled=true;','renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;')
replace('function requestRender(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;render();});}',
'''function requestRender(){
 if(framePending){renderStats.coalescedRequests++;return;}
 framePending=true;frameHandle=requestAnimationFrame(()=>{framePending=false;frameHandle=0;render();});
}''')
replace("function render(){if(!asset)return;renderer.render(scene,camera);renderSerial++;if(firstFrameMS===null)firstFrameMS=performance.now();if(rotating&&!document.hidden){stage.rotation.y+=.006;requestRender();}}",
'''function render(){
 // An immediate commit/export satisfies the pending draw; do not submit it twice.
 if(framePending){cancelAnimationFrame(frameHandle);framePending=false;frameHandle=0;renderStats.cancelledDuplicates++;}
 if(!asset)return;
 const started=performance.now(),shadowDirty=renderer.shadowMap.needsUpdate;
 renderer.render(scene,camera);renderStats.lastSubmitMS=performance.now()-started;
 renderStats.submissions++;if(shadowDirty)renderStats.shadowUpdates++;renderSerial++;
 if(firstFrameMS===null)firstFrameMS=performance.now();
 if(rotating&&!document.hidden){stage.rotation.y+=.006;renderer.shadowMap.needsUpdate=true;requestRender();}
}''')
replace('function apply(){\n if(!hat)return;', 'function apply(){\n if(!hat)return;renderer.shadowMap.needsUpdate=true;')
replace("function frame(view='three'){if(!hat)return;cameraMode=view;", "function frame(view='three'){if(!hat)return;const oldPlinth=plinth.visible,oldRotation=stage.rotation.y;cameraMode=view;")
replace("plinth.visible=state.view==='product'&&view!=='inside';stage.rotation.y=0;const b=", "plinth.visible=state.view==='product'&&view!=='inside';stage.rotation.y=0;if(oldRotation!==0||oldPlinth!==plinth.visible)renderer.shadowMap.needsUpdate=true;const b=")
replace(' },80);\n}', ' },500);\n}')
replace('firstFrameMS:preparedMS,workerMS:', "firstFrameMS:preparedMS,timingScope:'CPU preparation and WebGL submission, not physical display latency',workerMS:")
replace("a.generationReused?'原帽型复用':'程序生成'} ${Math.round(preparedMS)} ms", "a.generationReused?'原帽型复用':'程序生成'}准备 ${Math.round(preparedMS)} ms")
p.write_text(src)
print('Render commits coalesced; shadows invalidated by scene changes; HD begins after a stable selection',flush=True)
