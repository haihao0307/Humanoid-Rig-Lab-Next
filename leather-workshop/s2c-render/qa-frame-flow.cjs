/** Actual frame service and loop under a deterministic display scheduler. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const R=__dirname,checks=[],src=fs.readFileSync(path.join(R,'src/app/runtime.js'),'utf8');
const loop=src.slice(src.indexOf('function loop(t){'),src.indexOf('async function switchMode'));
const setup=`let ready=true,mode='products',dirty=false,allDirty=false,last=0,turning=false,hover=null,lastHover=0,yaw=0,physicsPlaying=false,physicsBusy=false,physState=null,actualSpeed=0;
let serial=0,queue=new Map(),events={},renders=[],productSolver={pendingPose:false,flushed:0,flushPose(){this.pendingPose=false;this.flushed++;invalidateView();}};
const document={hidden:false,addEventListener(n,f){(events[n]||=([])).push(f);}},window={addEventListener(n,f){(events[n]||=([])).push(f);}};
function requestAnimationFrame(f){queue.set(++serial,f);return serial;}function cancelAnimationFrame(id){queue.delete(id);}
function render(t,partial){renders.push({scene:dirty||allDirty||!partial,full:allDirty,thumbs:thumbnailDirty.size});dirty=false;allDirty=false;thumbnailDirty.clear();lastHover=t;}
function tick(t=1000){const [id,fn]=queue.entries().next().value||[];if(fn){queue.delete(id);fn(t);}}
function fire(name){for(const f of events[name]||[])f();}function fail(e){throw e;}function askWorker(){return Promise.resolve();}
`;
const c=vm.createContext({console});vm.runInContext(setup+fs.readFileSync(path.join(R,'src/app/frame-flow.js'),'utf8')+loop,c);
const q=s=>vm.runInContext(s,c),ok=(name,s)=>{assert(q(s),name);checks.push({name,pass:true});};
q('initFrameLifecycle();for(let i=0;i<200;i++)invalidateView()');ok('200 invalidations coalesce into one scheduled frame','queue.size===1');q('tick()');ok('Idle stops requesting frames','queue.size===0&&renders.length===1');
q('invalidateView(true);tick()');ok('Full invalidation retained','renders.at(-1).full');
q('invalidateThumbnail({id:"a"});tick()');ok('Card invalidation does not redraw static main scene','renders.at(-1).scene===false&&renders.at(-1).thumbs===1');
q('productSolver.pendingPose=true;requestViewFrame();tick()');ok('Received true solver pose wakes and applies exactly once','productSolver.flushed===1&&renders.at(-1).scene&&queue.size===0');
q('invalidateView();document.hidden=true;fire("visibilitychange")');ok('Hidden cancels queued frame','queue.size===0');q('invalidateView(true)');ok('Hidden invalidation retained without background drawing','dirty&&allDirty&&queue.size===0');
q('document.hidden=false;fire("visibilitychange");tick()');ok('Visible restores full current image once','renders.at(-1).full&&queue.size===0');
q('mode="baseline";invalidateView()');ok('Read-only archive schedules no main frame','queue.size===0');q('mode="products";invalidateView();tick()');ok('Returning from archive wakes view','queue.size===0&&!dirty');
q('turning=true;requestViewFrame();tick(2000)');ok('Auto-rotation keeps exactly one callback','queue.size===1');q('turning=false;tick(2016)');ok('Stopping auto-rotation stops polling','queue.size===0');
q('hover={id:"a"};requestViewFrame();tick(3000)');ok('Animated card schedules itself without forcing hero render','queue.size===1&&!renders.at(-1).scene');q('hover=null;tick(3016)');ok('Leaving card stops loop','queue.size===0');
q('requestViewFrame();fire("pagehide")');ok('Pagehide cancels callback','queue.size===0');q('fire("pageshow");fire("pageshow");tick(4000)');ok('Repeated restore never duplicates loop','queue.size===0');
const L=require('./node-lib.cjs');
for(const id of ['wallet','belt','bag','cowboy','pirate','swatch']){
 const root=L.makeProduct(id,L.productMaterials(new L.T.MeshStandardMaterial()),{craft:'plain'}),rig=root.userData.rig;assert.equal(rig.texture.image.width,3);assert.equal(rig.texture.image.height,rig.nodeCount);assert.equal(rig.texture.minFilter,L.T.NearestFilter);assert.equal(rig.texture.magFilter,L.T.NearestFilter);let count=0;
 for(const mesh of rig.meshes)for(const key of ['simIDs','simIDsB']){const at=mesh.geometry.attributes[key];if(at)for(const v of at.array){assert(Number.isInteger(v)&&v>=0&&v<rig.nodeCount);count++;}}
 checks.push({name:id+' integer texel lookup equals nearest clamp at all encoded node IDs',pass:true,nodeAddresses:count});
}
const out=path.join(R,'qa/render-batch/frame-flow.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({pass:true,checks},null,2));console.log(JSON.stringify({pass:true,count:checks.length}));
