/** Differential tests for actual app services with instrumented dependencies.
 * This is not a WebGL/browser claim. Rendering and real pointer tests are separate.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=__dirname,reference=process.env.BASE_APP_DIR;
if(!reference)throw Error('BASE_APP_DIR must point to independently reconstructed R10 app sources');
const T=require('./node-lib.cjs').T;
const names=['view-polish.js','atelier-controls.js','craft-ui.js','lifecycle.js','input-performance.js'];
const prelude=`
var trace=[],clock=1000,VERSION='R10.0',product='wallet',mode='products',view='home',ready=false;
var hero=null,heroMats=null,library=null,material='heritage',grabMode=true,grabPointer=null;
var renderer={shadowMap:{needsUpdate:false}},dirty=false,revision=0,yaw=0,pitch=0,distance=1,target=new T.Vector3();
var craftConfig={craft:'diamond'},elements=new Map(),serial=0;
const V=(...v)=>new T.Vector3(...v);
class Element {
 constructor(){this.value='1';this.textContent='';this.hidden=false;this.disabled=false;this.children=[];this.dataset={};this.style={};this.listeners={};const set=new Set();this.classList={add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k),toggle:(k,on)=>{if(on===undefined)on=!set.has(k);if(on)set.add(k);else set.delete(k);}};this.nextElementSibling={textContent:''};}
 append(x){this.children.push(x);}
 querySelectorAll(){return this.children.filter(q=>q.dataset.craft);}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 dispatchEvent(e){this['on'+e.type]?.(e);for(const fn of this.listeners[e.type]||[])fn(e);}
 getBoundingClientRect(){return{left:10,top:20,width:500,height:400};}
 hasPointerCapture(){return false;}
 releasePointerCapture(){}
}
const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
var document={body:new Element(),hidden:false,listeners:{},createElement:()=>new Element(),querySelector:s=>$(s),addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}};
var window={listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}};
var performance={now:()=>clock};
class PointerEvent {constructor(type,data={}){this.type=type;Object.assign(this,data);}preventDefault(){}}
class ProductShell {release(){}reset(){}}
class AtelierMaterials {
 create(c,res){trace.push(['material',JSON.parse(JSON.stringify(c)),res]);return{material:{normalScale:new T.Vector2(1,1),clearcoat:.3,onBeforeCompile:s=>{s.uniforms.base={value:1};},customProgramCacheKey:()=> 'base'},params:c};}
}
function worldShellMeasurements(){return[{part:'test',minMM:1.1,maxMM:1.2,sampleCount:4}];}
function evaluateBoundVertex(){return V();}
function makeSolver(id){return {id,active:true,failed:null,x:new Float64Array([.01,.02,.03]),report(){return {id,calculationSpeed:.25,integrationThread:'worker',workerSolveMS:4,cursorErrorMM:.2,inputToPoseMS:3,pendingRequests:0};},ask(op){trace.push(['ask',id,op]);return Promise.resolve({id,op});},step(n){trace.push(['step',id,n]);return{id,n};},release(){trace.push(['release',id]);},ready:Promise.resolve()};}
var productSolver=makeSolver(++serial);
function selectMaterial(id,manual){trace.push(['selectMaterial',id,manual]);}
function render(){trace.push('render');}
function boot(){return Promise.resolve();}
function fail(e){throw e;}
function setView(id){trace.push(['view',id]);view=id;target.set(1,2,3);yaw=.2;pitch=.3;distance=100;}
function selectProduct(id){trace.push(['product',id]);product=id;return 'selected:'+id;}
function updateDetails(){trace.push('details');}
function recipe(){return {base:true,version:VERSION};}
function prepareGrab(){trace.push('prepare');productSolver=makeSolver(++serial);}
function updateGrabUI(){trace.push('grab');$('grabStats').textContent='base';}
function destroyGeometry(root){trace.push(['destroy',root?.name]);}
function makeHero(){const labels=['wallet-panel-2','bag-front','leather-hatband'];const parts=labels.map(name=>({name,t:1.4,map:(u,v)=>V(u,2,v),normal:()=>V(.2,.4,.8).normalize(),paths:[{length:10,frame:()=>({uv:{x:3,y:4}})}]}));return{userData:{rig:{parts,bindingShift:2,data:{triangles:[[0,1,2,1,1]]}}}};}
hero=makeHero();
// Primary input handler exists before secondary listeners, as in setupUI.
$('stage').onpointerdown=e=>{grabPointer=e.pointerId;document.body.classList.add('leather-dragging');};
$('stage').onpointercancel=()=>{grabPointer=null;};
`;
function context(candidate){
 const c=vm.createContext({T,console});let source=prelude;
 if(candidate)for(const n of ['setView','selectProduct','updateDetails','recipe','prepareGrab','updateGrabUI','destroyGeometry'])source=source.replace('function '+n+'(', 'function '+n+'Base(');
 vm.runInContext(source,c);
 for(const n of names)vm.runInContext(fs.readFileSync(path.join(candidate?path.join(ROOT,'src/app'):reference,n),'utf8'),c,{filename:n});
 if(candidate){let s=fs.readFileSync(path.join(ROOT,'src/app/composition.js'),'utf8');assert.equal(s.split('boot().catch(fail);').length,2);s=s.replace('boot().catch(fail);','');vm.runInContext(s,c);vm.runInContext('initializeAppControls()',c);}
 return c;
}
const read=(c,s)=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',c));
const run=(c,s)=>vm.runInContext(s,c);
const rows=[];
function compare(name,setup,probe){const a=context(false),b=context(true);run(a,setup);run(b,setup);const x=read(a,probe),y=read(b,probe);assert.deepEqual(y,x,name);rows.push({name,pass:true});}
for(const product of ['wallet','bag','cowboy','swatch'])for(const v of ['home','macro'])compare('camera '+product+' '+v,`product=${JSON.stringify(product)};setView(${JSON.stringify(v)});`,'({trace,yaw,pitch,distance,target:target.toArray(),dirty,revision})');
compare('product selection resets inspection before base call',"isThicknessView=true;$('thicknessView').classList.add('active');var value=selectProduct('bag');", "({trace,value,isThicknessView,active:$('thicknessView').classList.contains('active')})");
for(const p of ['wallet','belt'])compare('details and craft enablement '+p,`product=${JSON.stringify(p)};updateDetails();`,"({trace,shell:$('shellReadout').textContent,note:$('liveThicknessNote').textContent,disabled:ribbon.children.filter(b=>b.dataset.craft).map(b=>[b.dataset.craft,b.disabled])})");
compare('details without a current product',"hero=null;updateDetails();",'trace');
compare('recipe extension order and content','var r=recipe();','r');
compare('throttled diagnostic order',"updateGrabUI();clock+=100;updateGrabUI();clock+=100;updateGrabUI();", "({trace,stats:$('grabStats').textContent,input:$('inputMetrics').textContent})");
compare('failed solver bypasses diagnostic throttle',"updateGrabUI();clock+=1;productSolver.failed='test';updateGrabUI();",'trace');
compare('API delegates follow rebuilt solver',"window.LEATHER_ATELIER={};prepareGrab();var oldFn=window.LEATHER_ATELIER.performance;prepareGrab();var r=oldFn();var step=window.LEATHER_ATELIER.stepProduct(3);",'({trace,r,step,keys:Object.keys(window.LEATHER_ATELIER).sort()})');
compare('inspection API uses current position buffer',"window.LEATHER_ATELIER={};prepareGrab();var r=window.LEATHER_ATELIER.inspectGrip();",'r');
for(const changed of [false,true]){
 const a=context(false),b=context(true),setup=changed?"Object.assign(artistSurface,{relief:1.5,coat:.2,grain:2,roughness:.1,color:'#554433'});":'';
 run(a,setup);run(b,setup);
 const make=cls=>`var result=(new ${cls}()).create({id:'test',color:'#112233'},256);var shader={uniforms:{},vertexShader:'#include <common>\\n#include <uv_vertex>',fragmentShader:'#include <common>\\n#include <roughnessmap_fragment>'};result.material.onBeforeCompile(shader);`;
 run(a,make('AtelierMaterials'));run(b,make('ArtistAtelierMaterials'));
 const query='({trace,normal:result.material.normalScale.toArray(),coat:result.material.clearcoat,key:result.material.customProgramCacheKey(),shader})';assert.deepEqual(read(b,query),read(a,query));rows.push({name:'artist material values and shader '+changed,pass:true});
}
compare('owned GPU resources released before geometry without double depth disposal',`var depth={dispose(){trace.push('depth');}},beauty={dispose(){trace.push('beauty');}},nodes=[{customDepthMaterial:depth,userData:{beautyMaterials:true},material:[beauty]},{customDepthMaterial:depth,userData:{}}];hero={name:'hero',traverse:f=>nodes.forEach(f)};heroMats={thread:{map:{dispose(){trace.push('map');}},normalMap:{dispose(){trace.push('normal');}},dispose(){trace.push('thread');}}};destroyGeometry(hero);`,'trace');
for(const ev of ['blur','keydown','visibilitychange'])compare('input cancellation '+ev,`$('stage').dispatchEvent(new PointerEvent('pointerdown',{pointerId:3,pointerType:'mouse',button:0,clientX:12,clientY:25}));${ev==='visibilitychange'?"document.hidden=true;for(const f of document.listeners.visibilitychange)f({});":`for(const f of window.listeners.${ev})f({key:'Escape'});`}`,"({trace,grabPointer,guard:document.body.classList.contains('leather-dragging'),visibility:cursor.style.visibility,active:productSolver.active})");
const c=context(true);assert.throws(()=>run(c,'initializeAppControls()'));rows.push({name:'duplicate control initialization rejected',pass:true});
run(c,"trace=[];var m=new AtelierMaterials().create({id:'base'},256);");assert.equal(read(c,'m.material.customProgramCacheKey()'),'base');rows.push({name:'shared material catalogue not globally patched',pass:true});
const report={schema:'kaopu/leather-app-interface-differential@1',pass:true,cases:rows.length,checks:rows,scope:'Actual extension source evaluated with instrumented CPU dependencies; separate real-browser gates required',knownAPIChange:'First boot now exposes the same live performance/inspectGrip/manual-step delegates as subsequent rebuilds.'};
const out=path.join(ROOT,'qa/s1b2');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'app-interfaces.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,cases:rows.length}));
