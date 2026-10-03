import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {playwright} from './dependencies.mjs';
const label=process.argv[2]||'before',html=process.argv[3]||'打开动物集成工作台.html';
const {chromium}=playwright();
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width:1680,height:1000}}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
const metrics=async()=>{await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');return heap;};
const report={label,startedAt:new Date().toISOString(),htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),cases:[]};
async function sample(name){
 const perfBefore=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
 const stat=await page.evaluate(async()=>{
  const v=__ATLAS_REHEARSAL__.viewer,geometries=new Set(),buffers=new Set();let geometryOccurrences=0,attributeBytes=0;
  v.scene.traverse(o=>{if(!o.geometry)return;geometryOccurrences++;geometries.add(o.geometry);for(const a of [...Object.values(o.geometry.attributes),o.geometry.index].filter(Boolean)){const data=a.isInterleavedBufferAttribute?a.data:a;if(!buffers.has(data.array.buffer)){buffers.add(data.array.buffer);attributeBytes+=data.array.byteLength;}}});
  const updates=[],originals=new Map();for(const a of v.actors)if(a.live){const fn=a.live.update;originals.set(a.live,fn);a.live.update=()=>{const t=performance.now();fn();updates.push(performance.now()-t);};}const timings=[],render=v.renderer.render.bind(v.renderer);let draws=0;v.renderer.render=(...a)=>{const t=performance.now();render(...a);timings.push(performance.now()-t);draws++;};await new Promise(r=>setTimeout(r,2000));v.renderer.render=render;for(const [live,fn]of originals)live.update=fn;
  const percentile=(q,values=timings)=>{const a=values.toSorted((a,b)=>a-b);return a[Math.floor((a.length-1)*q)]||0;};
  return {geometryOccurrences,uniqueGeometries:geometries.size,attributeBytes,drawsIn2Seconds:draws,bindingUpdateCount:updates.length,bindingCpuP50Ms:percentile(.5,updates),bindingCpuP95Ms:percentile(.95,updates),renderCpuP50Ms:percentile(.5),renderCpuP95Ms:percentile(.95),triangles:v.renderer.info.render.triangles,glError:v.renderer.getContext().getError(),snapshotBytes:[...v.assets.values()].reduce((n,b)=>n+b.meshes.reduce((n,m)=>n+['positions','indices','colors','uv','texture'].reduce((n,k)=>n+(m[k]?.byteLength??(m[k]?.length||0)*8),0),0),0)};
 });const perfAfter=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));report.cases.push({name,...stat,mainThreadTaskSeconds:perfAfter.TaskDuration-perfBefore.TaskDuration,heap:await metrics()});console.log(name,JSON.stringify(report.cases.at(-1)));
}
try{
 const t=Date.now();await page.goto(pathToFileURL(path.resolve(html)).href,{timeout:180000});await page.waitForFunction(()=>window.__ATLAS__?.ready&&__ATLAS__.current==='fish',null,{timeout:180000});report.bootMs=Date.now()-t;report.bootHeap=await metrics();
 await page.evaluate(async()=>{await __ATLAS__.set('playing',false);await __ATLAS__.set('group',false);});await page.locator('#rehearsal-open').click();
 await page.evaluate(()=>__ATLAS_REHEARSAL__.add('fish'));await page.evaluate(()=>{const v=__ATLAS_REHEARSAL__.viewer;if(v.actors.length!==1)throw Error(document.querySelector('#rehearsal-status').textContent);v.pause();v.camera.position.set(9,7,12);v.fit();});await page.waitForTimeout(600);
 // Freeze the exact producer state for a deterministic baseline, not just its elapsed clock.
 await page.evaluate(()=>{const v=__ATLAS_REHEARSAL__.viewer,w=document.querySelector('.rehearsal-worker').contentWindow,r=w.__KAOPU_R13__.renderer,a=r.actors[r.state.selected];window.__PERF_STATE__=structuredClone({field:Array.from(a.state.field),jaw:a.state.jaw,gill:a.state.gill,time:a.state.time,eyes:[w.__KAOPU_R13__.instrument.eyeFrame(a,1,true),w.__KAOPU_R13__.instrument.eyeFrame(a,-1,true)],camera:v.camera.position.toArray(),target:v.orbit.target.toArray(),variant:r.school.fish[r.state.selected].variant,offset:v.actors[0].normalizer.children[0].position.toArray()});});
 if(label==='before')fs.writeFileSync('qa/perf-baseline/fish-state.json',JSON.stringify(await page.evaluate(()=>__PERF_STATE__)));
 else{const state=JSON.parse(fs.readFileSync('qa/perf-baseline/fish-state.json'));await page.evaluate(s=>{const v=__ATLAS_REHEARSAL__.viewer,w=document.querySelector('.rehearsal-worker').contentWindow,r=w.__KAOPU_R13__.renderer,A=w.__KAOPU_R13__.instrument,a=r.actors[r.state.selected];a.state.field.set(s.field);a.state.jaw=s.jaw;a.state.gill=s.gill;a.state.time=s.time;r.school.fish[r.state.selected].variant=s.variant;A.eyeFrame=(_,side)=>s.eyes[side===1?0:1];v.actors[0].normalizer.children[0].position.fromArray(s.offset);v.camera.position.fromArray(s.camera);v.orbit.target.fromArray(s.target);v.actors[0].live.update();v.invalidate?.();},state);}
 await page.waitForTimeout(300);await page.locator('#rehearsal-viewport canvas').screenshot({path:`qa/perf-${label}-fish.png`});await sample('fish-paused');
 await page.evaluate(()=>__ATLAS_REHEARSAL__.viewer.play());await sample('fish-live');await page.evaluate(()=>{const v=__ATLAS_REHEARSAL__.viewer;for(const a of [...v.actors])v.remove(a.id);});
 for(const id of ['bear','cat','dove'])await page.evaluate(id=>__ATLAS_REHEARSAL__.add(id),id);
 await page.evaluate(()=>{const v=__ATLAS_REHEARSAL__.viewer;if(v.actors.length!==3)throw Error('mixed stage did not load');v.pause();v.fit();});await sample('mixed-paused');
 await page.evaluate(()=>__ATLAS_REHEARSAL__.viewer.play());await sample('mixed-live');
 await page.evaluate(()=>{const v=__ATLAS_REHEARSAL__.viewer;v.pause();for(const a of [...v.actors])v.remove(a.id);});await page.waitForTimeout(300);report.releasedHeap=await metrics();report.passed=errors.length===0&&network.length===0&&report.cases.every(c=>c.glError===0);
}catch(e){report.passed=false;report.failure=e.stack;console.error(e);}finally{report.errors=errors;report.network=network;report.completedAt=new Date().toISOString();fs.writeFileSync(`qa/FUNCTION_PROFILE_${label.toUpperCase()}.json`,JSON.stringify(report,null,2));await browser.close();}if(!report.passed)process.exitCode=1;

