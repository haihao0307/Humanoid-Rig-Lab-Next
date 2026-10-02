// Opt-in real-browser motion smoke. No desktop input; artifacts stay outside
// the source tree. This is execution/contact evidence, not visual acceptance.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=process.env.MOTION_QA_DIR||join(tmpdir(),'human-motion-qa');await mkdir(out,{recursive:true});
const args=['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist'];
if(process.env.HUMANLAB_SOFTWARE_GL==='1')args.push('--use-angle=swiftshader','--enable-unsafe-swiftshader');
const browser=await chromium.launch({headless:true,args,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1100,height:760}}),pageErrors=[],results=[];
page.on('pageerror',error=>pageErrors.push(String(error)));
let startup=null,crowd=null,failure=null,benchmark=null,floorCrowd=null;
try{
 await page.goto(process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html?qa=1',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow;return w?.HumanLab?.population?.list().length>=2||w?.__startupError;},null,{timeout:480000});
 startup=await page.evaluate(()=>{
  const w=document.querySelector('#bodyFrame').contentWindow,lab=w.HumanLab;
  if(w.__startupError)throw Error(w.__startupError);lab.setAuto(false);lab.inspectBody('front');
  const gl=w.document.querySelector('#view').getContext('webgl2');
  const pose=lab.agent.locomotion.pose,apply=pose.apply;
  lab.motionQA={adoptedSamples:0,maxAdoptedAngleRad:0,floorSamples:0,loweredFloorSamples:0,maxLoweringM:0,maxFloorGapM:0,maxUnconstrainedFloorGapM:0,maxFloorPenetrationM:0,plantedPalmSamples:0,maxPlantedPalmDriftM:0,maxPlantedSurfaceGapM:0,seatedSupportSamples:0,maxSeatGapM:0,plantedLeadFootSamples:0,maxLeadFootDriftM:0,maxLeadFootSurfaceGapM:0};
  pose.apply=function(...args){const result=apply.apply(this,args),s=this.engine.state;
   if(args[0]?.groundSupport==='continuous-floor'){
    const report=this.report(),qa=lab.motionQA;qa.floorSamples++;
    qa.maxFloorGapM=Math.max(qa.maxFloorGapM,Math.abs(report.ground.y-.0005));
    qa.maxFloorPenetrationM=Math.max(qa.maxFloorPenetrationM,.0005-report.ground.y);
    if(!report.floorSupport?.active&&!report.floorSeat&&!report.floorFoot?.active)qa.maxUnconstrainedFloorGapM=Math.max(qa.maxUnconstrainedFloorGapM,Math.abs(report.ground.y-.0005));
    if(report.floorSeat?.weight===1){qa.seatedSupportSamples++;qa.maxSeatGapM=Math.max(qa.maxSeatGapM,Math.abs(report.floorSeat.surfaceY-.002*this.h.bodyMetrics.statureScale));}
    if(report.floorFoot?.weight===1){
     qa.plantedLeadFootSamples++;const actual=this.h.byId.get('left_foot').world.p,anchor=report.floorFoot.anchor.p;
     qa.maxLeadFootDriftM=Math.max(qa.maxLeadFootDriftM,Math.hypot(...actual.map((v,i)=>v-anchor[i])));qa.maxLeadFootSurfaceGapM=Math.max(qa.maxLeadFootSurfaceGapM,report.floorFoot.surfaceY);
    }
    if(report.floorSupport?.weight===1){
     qa.plantedPalmSamples++;const actual=this.h.palm('right').p,anchor=report.floorSupport.anchor.p;
     qa.maxPlantedPalmDriftM=Math.max(qa.maxPlantedPalmDriftM,Math.hypot(...actual.map((v,i)=>v-anchor[i])));
     qa.maxPlantedSurfaceGapM=Math.max(qa.maxPlantedSurfaceGapM,report.floorSupport.surfaceY);
    }
    qa.maxLoweringM=Math.max(qa.maxLoweringM,-report.groundCorrectionM);
    if(report.groundCorrectionM<-.000001)qa.loweredFloorSamples++;
   }
   for(const side of ['left','right']){const foot=s.feet[side];if(!foot.adoptedOrientation||!foot.contact||s.swing?.side===side)continue;
    const q=this.h.byId.get(side+'_foot').world.q,goal=foot.adoptedOrientation;
    const d=Math.min(1,Math.abs(q.reduce((sum,v,k)=>sum+v*goal[k],0)));
    lab.motionQA.maxAdoptedAngleRad=Math.max(lab.motionQA.maxAdoptedAngleRad,2*Math.acos(d));lab.motionQA.adoptedSamples++;
   }return result;
  };
  return{status:w.__humanStartup,population:lab.population.list().length,webgl:!!gl,contextLost:gl?.isContextLost()};
 });
 assert(startup.webgl&&!startup.contextLost);console.log('STARTUP '+JSON.stringify(startup));
 for(const command of ['坐下','躺下','坐下','起身','向前走1米','向左转90度','挥手']){
  console.log('BEGIN '+command);
  const result=await page.evaluate(command=>{
   const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,a=lab.agent,start=a.stats.completed,phases=new Set();
   lab.command(command);
   for(let i=0;i<240;i++){
    lab.advance(.1);phases.add(a.phase);if(a.error)throw Error(command+': '+a.error);
    if(a.stats.completed>start&&a.activity().readyForTask)break;
   }
   return{command,completed:a.stats.completed-start,ready:a.activity().readyForTask,posture:a.basic.posture,phases:[...phases],
    maxFootM:a.stats.maxFootPositionErrorM,maxBoneM:a.stats.maxBoneLengthErrorM,...lab.motionQA};
  },command);
  assert.equal(result.completed,1,command+' must complete');assert(result.ready);assert(result.maxFootM<.012);
  if(command==='起身'){assert(result.adoptedSamples>0);assert(result.maxAdoptedAngleRad<1e-6);}
  results.push(result);console.log('ACTION '+JSON.stringify(result));
  // The review cast is arranged along X; a side camera is occluded by the
  // neighbouring actor. Keep the whole body framed from a clear front angle.
  await page.evaluate(()=>{const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab;lab.inspectBody('front');lab.renderer.yaw=0;lab.renderer.target=[lab.agent.pos[0],lab.human.bodyMetrics.statureM*.45,lab.agent.pos[2]];lab.render();});
  const png=await page.evaluate(()=>document.querySelector('#bodyFrame').contentWindow.HumanLab.renderer.canvas.toDataURL('image/png'));
  await writeFile(join(out,'motion-'+results.length+'.png'),Buffer.from(png.split(',')[1],'base64'));
 }
 await page.waitForFunction(()=>document.querySelector('#bodyFrame')?.contentWindow?.HumanLab?.population?.list().length>=6,null,{timeout:480000});
 crowd=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,p=lab.population;
  const before=Object.fromEntries([...p.values()].map(a=>[a.id,a.agent.stats.completed]));
  const dispatch=p.dispatch('挥手',{targets:'all',mode:'replace'});
  for(let i=0;i<360;i++){
   lab.advance(.1);const actors=[...p.values()];
   for(const a of actors)if(a.agent.error)throw Error(a.id+': '+a.agent.error);
   if(actors.every(a=>a.agent.stats.completed>before[a.id]&&a.agent.activity().readyForTask))break;
  }
  return{dispatch,actors:[...p.values()].map(a=>({id:a.id,completed:a.agent.stats.completed-before[a.id],ready:a.agent.activity().readyForTask}))};
 });
 assert.equal(crowd.actors.length,6);for(const a of crowd.actors){assert.equal(a.completed,1);assert(a.ready);}
 const finalQA=results.at(-1);assert(finalQA.floorSamples>0);assert(finalQA.loweredFloorSamples>0);
 assert(finalQA.maxUnconstrainedFloorGapM<1e-6);assert(finalQA.maxFloorPenetrationM<1e-6);
 assert(finalQA.plantedPalmSamples>100);assert(finalQA.maxPlantedPalmDriftM<.0001);assert(finalQA.maxPlantedSurfaceGapM<.004);
 assert(finalQA.seatedSupportSamples>100);assert(finalQA.maxSeatGapM<.006);assert(finalQA.plantedLeadFootSamples>100);assert(finalQA.maxLeadFootDriftM<.0001);assert(finalQA.maxLeadFootSurfaceGapM<.004);
 floorCrowd=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,p=lab.population,ids=p.list().map(a=>a.id),runs=[];
  p.control('stop','all');lab.setAuto(false);lab.advance(3);lab.world.applyPreset('empty');
  // Six independent floor-action envelopes need more room than the small
  // default field. Enlarge this isolated test fixture; retain collision and
  // forecast checks, and do not change production world or traffic behavior.
  lab.world.bounds={xMin:-10,xMax:10,zMin:-8,zMax:8};
  ids.forEach((id,i)=>p.place(p.get(id),[-7.5+i*3,0,0],i%2?.7:0));
  for(const command of ['坐下','起身']){
   const before=Object.fromEntries([...p.values()].map(a=>[a.id,a.agent.stats.completed])),dispatch=p.dispatch(command,{targets:ids,mode:'replace'});lab.setAuto(false);
   if(dispatch.some(r=>!r.accepted))throw Error('floor crowd dispatch rejected: '+JSON.stringify(dispatch));
   for(let i=0;i<360;i++){lab.advance(.1);for(const a of p.values())if(a.agent.error)throw Error(a.id+': '+a.agent.error);if([...p.values()].every(a=>a.agent.stats.completed>before[a.id]&&a.agent.activity().readyForTask))break;}
   const actors=[...p.values()].map(a=>({id:a.id,completed:a.agent.stats.completed-before[a.id],ready:a.agent.activity().readyForTask,posture:a.agent.basic.posture}));
   if(actors.some(a=>a.completed!==1||!a.ready))throw Error('floor crowd failed to complete');runs.push({command,actors});
  }return{actors:ids.length,bounds:{...lab.world.bounds},runs,performanceMeasured:false};
 });console.log('FLOOR_CROWD '+JSON.stringify(floorCrowd));
 if(process.env.MOTION_BENCHMARK==='1'){
  console.log('BENCHMARK preparing 8 actor scene');
  await page.evaluate(async()=>{const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,p=lab.population;lab.setAuto(false);
   while(p.list().length<8)await p.spawn(p.definitionFor(p.active));
   // A fresh empty benchmark fixture; no actor inherits a smoke-test route
   // close to a boundary. World geometry and traffic checks stay enabled.
   lab.world.applyPreset('empty');
   p.focus(p.list().map(a=>a.id));lab.setAuto(false);
  });
  benchmark=await page.evaluate(()=>{
   const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,p=lab.population,ids=p.list().map(a=>a.id),gl=lab.renderer.canvas.getContext('webgl2'),runs=[];
   const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
   for(const movers of [1,4,8]){
    p.control('stop','all');lab.setAuto(false);lab.advance(5);
    ids.forEach((id,i)=>p.place(p.get(id),[-3.5+i,0,-1.2],0));p.focus(ids);
    const dispatch=p.dispatch('向前走2米',{targets:ids.slice(0,movers),mode:'replace'});lab.setAuto(false);
    if(dispatch.some(r=>!r.accepted))throw Error('benchmark dispatch rejected: '+JSON.stringify(dispatch));
    let prepared=false;
    for(let i=0;i<240;i++){
     p.tick(1/60);
     for(const actor of p.values())if(actor.agent.error)throw Error(actor.id+': '+actor.agent.error);
     if(ids.slice(0,movers).every(id=>{const a=p.get(id).agent;return a.phase==='walk'&&a.pos[2]>-1.1;})){prepared=true;break;}
    }
    if(!prepared)throw Error('benchmark actors did not start walking');
    const tick=[],render=[],total=[],errors=new Set();
    const distanceBefore=ids.map(id=>[...p.get(id).agent.pos]);let minWalkingActors=movers;
    for(let i=0;i<140;i++){
     const start=performance.now();p.tick(1/60);const simulated=performance.now();lab.render();gl.finish();const completed=performance.now();
     if(i>=20){tick.push(simulated-start);render.push(completed-simulated);total.push(completed-start);}
     minWalkingActors=Math.min(minWalkingActors,ids.slice(0,movers).filter(id=>p.get(id).agent.phase==='walk').length);
     for(const actor of p.values())if(actor.agent.error)errors.add(actor.id+': '+actor.agent.error);
    }
    runs.push({movers,minWalkingActors,renderedActors:ids.length,awakeActors:ids.length,samples:total.length,simulationStepS:1/60,
     horizontalDisplacementM:ids.slice(0,movers).map((id,i)=>{const p1=p.get(id).agent.pos,p0=distanceBefore[i];return Math.hypot(p1[0]-p0[0],p1[2]-p0[2]);}),
     simulationP50Ms:quantile(tick,.5),simulationP95Ms:quantile(tick,.95),renderAndGPUWaitP50Ms:quantile(render,.5),totalP50Ms:quantile(total,.5),totalP95Ms:quantile(total,.95),errors:[...errors]});
   }
   return{scope:'Fixed empty eight-actor scene, all awake, with 1/4/8 confirmed walking actors; headless synchronous simulation and render completion, not display FPS or capacity certification',runs};
  });
  console.log('BENCHMARK '+JSON.stringify(benchmark));
  for(const run of benchmark.runs){assert.deepEqual(run.errors,[]);assert.equal(run.minWalkingActors,run.movers);assert(run.horizontalDisplacementM.every(d=>d>.5));}
 }
 assert.equal(pageErrors.length,0);console.log('PASS '+JSON.stringify({actions:results.length,simultaneousGestures:crowd.actors.length,pageErrors:0,visualAcceptance:false,crowdPerformanceMeasured:!!benchmark}));
}catch(error){failure=String(error);console.error('FAIL '+failure);process.exitCode=1;
 try{console.error('STATE '+JSON.stringify(await page.evaluate(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow,lab=w?.HumanLab;return{startup:w?.__humanStartup,startupError:w?.__startupError,population:lab?.population?.list().length,error:lab?.agent?.error,basic:lab?.agent?.basic?.report(),pose:lab?.agent?.locomotion?.pose.report()};})));}catch{}
}
finally{await writeFile(join(out,'motion-browser-results.json'),JSON.stringify({startup,results,crowd,floorCrowd,benchmark,pageErrors,failure,visualAcceptance:false},null,2));await browser.close();}
