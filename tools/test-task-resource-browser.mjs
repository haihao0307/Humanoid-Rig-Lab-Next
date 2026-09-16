// Two real carriers, a shared station, round trips and failure/retry isolation.
// Keep artifacts outside the repository. No desktop input or pose substitution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const url=process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html';
const long=process.argv.includes('--long');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();page.setDefaultTimeout(720000);
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await mkdir('artifacts',{recursive:true});let report={schema:'jarvis/task_resource_browser_report@1',long,url,errors};
const artifact=`artifacts/task-resource-${long?'long':'shared'}.json`;
try{
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 assert(response?.ok(),'workbench response must succeed');
 report.entrypointSha256=createHash('sha256').update(await response.body()).digest('hex');
 await page.waitForFunction(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow;return w?.__startupError||w?.__humanStartup?.status==='ready'&&w.HumanLab?.population?.pending===0;},null,{timeout:720000,polling:500});
 report.setup=await page.evaluate(long=>{
  const w=document.querySelector('#bodyFrame').contentWindow,lab=w.HumanLab,pop=lab.population,world=lab.world;
  if(w.__startupError)throw Error(w.__startupError);lab.setAuto(false);
  const actors=[...pop.values()];if(actors.length!==6)throw Error('Expected six generated actors');
  for(const row of actors){row.agent.cancel();row.queue=[];row.running=null;row.behavior.enabled=false;row.agent.paused=true;}
  const positions=[[-3.5,0,3.1],[-1,0,3.1],[8,0,2],[10.5,0,4],[7,0,-3],[12,0,4]];
  actors.forEach((row,i)=>{if(world.collision(positions[i],row.human.bodyMetrics.bodyRadiusM+.08))throw Error('Fixture spawn blocked '+row.id);pop.place(row,positions[i],0);});
  const specs=[['PAIR_A',[-3.5,0,4]],['PAIR_B',[-1,0,4]]];
  for(const [id,p]of specs)world.objects.push(world.normalizeObject({id,name:id,shape:'box',p,w:.3,h:.6,d:.3,mass:.5,friction:.4,restitution:0,movable:true,collidable:true},id));
  const zones=[['Z28',specs[0][1]],['Z29',specs[1][1]],['Z30',long?[9,0,0]:[-2.4,0,6.7]]];
  for(const [id,p]of zones)world.zones.push(world.normalizeZone({id,name:id,p,r:.8,shape:'square'},id));
  world.touch('resource-browser-fixture');world.physics.syncScene();for(let i=0;i<180;i++)world.physics.step(1/120,[]);
  const tasks=actors.slice(0,2).map((row,i)=>({id:row.id,object:specs[i][0],home:zones[i][0],commands:[`把 ${specs[i][0]} 搬到 Z30`,`把 ${specs[i][0]} 搬到 ${zones[i][0]}`]}));
  const accepted=[];for(const task of tasks)for(const command of task.commands)accepted.push(pop.dispatch(command,{targets:[task.id],mode:'append'})[0]);lab.setAuto(false);
  lab.resourceProbe={actors,tasks,frames:0,maxHeld:0,owners:[],lastOwner:undefined,violations:[],phases:[],lastPhases:{},paths:Object.fromEntries(tasks.map(t=>[t.id,0])),lastPositions:Object.fromEntries(actors.slice(0,2).map(r=>[r.id,[...r.agent.pos]]))};
  return{population:actors.length,tasks,accepted,target:zones[2][1]};
 },long);
 console.log('RESOURCE_READY '+JSON.stringify(report.setup));assert(report.setup.accepted.every(r=>r.accepted));
 const deadline=Date.now()+15*60*1000;
 while(Date.now()<deadline){
  const progress=await page.evaluate(()=>{
   const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,t=lab.resourceProbe;
   for(let k=0;k<60;k++){
    pop.tick(1/120);t.frames++;
    const held=t.actors.filter(r=>r.agent.held);t.maxHeld=Math.max(t.maxHeld,held.length);
    for(const row of held)if(pop.claims.get(row.agent.held.id)!==row.id||pop.physicsOwner!==row.id||row.agent.held.heldOwner!==row.id)t.violations.push({frame:t.frames,id:row.id,kind:'held-ownership'});
    if(pop.physicsOwner!==t.lastOwner){t.lastOwner=pop.physicsOwner;t.owners.push({frame:t.frames,owner:pop.physicsOwner});}
    for(const task of t.tasks){const a=pop.get(task.id).agent,p=t.lastPositions[task.id];t.paths[task.id]+=Math.hypot(a.pos[0]-p[0],a.pos[2]-p[2]);t.lastPositions[task.id]=[...a.pos];const phase=a.phase+(a.preflightWaiting?':'+a.preflight?.kind:'');if(t.lastPhases[task.id]!==phase){t.lastPhases[task.id]=phase;t.phases.push({id:task.id,frame:t.frames,phase});}}
    if(t.actors.some(r=>r.agent.error||r.behavior.error))break;
   }
   const rows=t.tasks.map(task=>{const r=pop.get(task.id),a=r.agent;return{id:r.id,carryCompleted:a.evidence.filter(e=>e.type==='carry'&&e.completion==='verified').length,error:a.error||r.behavior.error,phase:a.phase,held:a.held?.id,position:a.pos,queued:r.queue.length,running:r.running?.text,ready:a.activity().readyForTask,resource:r.resource,preflight:a.preflight,logs:r.logs.slice(0,3)};});
   return{frames:t.frames,rows,done:rows.every(r=>r.carryCompleted===2&&r.ready&&!r.running&&!r.queued),failed:rows.some(r=>r.error)};
  });
  report.progress=progress;if(progress.frames%1200===0||progress.done||progress.failed)console.log('RESOURCE_PROGRESS '+JSON.stringify(progress));
  if(progress.done||progress.failed||progress.frames>=36000)break;await new Promise(r=>setTimeout(r,10));
 }
 report.result=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,t=lab.resourceProbe;
  return{frames:t.frames,maxHeld:t.maxHeld,owners:t.owners,violations:t.violations,phases:t.phases,paths:t.paths,claims:[...pop.claims],stationClaims:[...pop.stationClaims],physicsOwner:pop.physicsOwner,actors:t.tasks.map(task=>{const r=pop.get(task.id),o=lab.world.get(task.object);return{id:r.id,object:task.object,insideHome:lab.world.inside(o,lab.world.get(task.home)),objectPhysics:lab.world.physics.objectState(o.id),evidence:r.agent.evidence,stats:r.agent.stats,resource:r.resource,logs:r.logs.slice(0,16),route:r.agent.route,traffic:r.agent.locomotion.traffic};})};
 });
 await writeFile(artifact,JSON.stringify(report,null,2));
 assert.equal(report.progress.done,true,'both carriers must complete both trips');assert.equal(report.result.maxHeld,1);assert.equal(report.result.violations.length,0);
 assert(report.result.actors.every(r=>r.insideHome&&r.objectPhysics.supported&&r.objectPhysics.settled));assert.equal(report.result.physicsOwner,null);assert.equal(report.result.claims.length,0);assert.equal(report.result.stationClaims.length,0);assert.equal(errors.length,0);
 assert(report.result.actors.some(r=>r.resource.diversions>0),'no resource contention exercised');
 if(!long){
  // Controlled fault at the real executor boundary, before any grasp. This
  // proves failure cleanup/retry, not recovery from a synthetic physical grip.
  report.failure=await page.evaluate(()=>{
   const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,t=lab.resourceProbe,a=pop.get(t.tasks[0].id).agent,b=pop.get(t.tasks[1].id).agent,command=t.tasks[0].commands[0];
   const accepted=pop.dispatch(command,{targets:[a.npcId]})[0],claimed=pop.physicsOwner===a.npcId;lab.setAuto(false);
   a.fail('controlled pre-grasp resource abort');const rejected=pop.dispatch('挥手',{targets:[a.npcId]})[0];
   const peerBefore=b.stats.completed;pop.dispatch('挥手',{targets:[b.npcId]});lab.setAuto(false);
   for(let i=0;i<600;i++)pop.tick(1/120);
   return{accepted,claimed,rejected,error:a.error,peerCompleted:b.stats.completed-peerBefore,claims:[...pop.claims],stationClaims:[...pop.stationClaims],physicsOwner:pop.physicsOwner,held:a.held?.id||null};
  });
  await writeFile(artifact,JSON.stringify(report,null,2));
  assert(report.failure.accepted.accepted&&report.failure.claimed);assert.equal(report.failure.rejected.accepted,false);assert.equal(report.failure.error,'controlled pre-grasp resource abort');assert.equal(report.failure.peerCompleted,1);assert.equal(report.failure.held,null);assert.equal(report.failure.physicsOwner,null);assert.equal(report.failure.claims.length,0);assert.equal(report.failure.stationClaims.length,0);
  const retry=await page.evaluate(()=>{const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,t=lab.resourceProbe,task=t.tasks[0];pop.control('stop',[task.id]);const result=pop.dispatch(task.commands[0],{targets:[task.id]})[0];lab.setAuto(false);return result;});assert(retry.accepted);
  const retryDeadline=Date.now()+10*60*1000;
  for(let frames=0;frames<18000&&Date.now()<retryDeadline;frames+=60){
   report.retry=await page.evaluate(()=>{
    const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,t=lab.resourceProbe,task=t.tasks[0],row=pop.get(task.id),a=row.agent;
    for(let i=0;i<60;i++){pop.tick(1/120);if(a.error)break;}
    const object=lab.world.get(task.object),carryCompleted=a.evidence.filter(e=>e.type==='carry'&&e.completion==='verified').length;
    return{carryCompleted,error:a.error||row.behavior.error,done:carryCompleted===3&&a.activity().readyForTask&&!row.running,insideTarget:lab.world.inside(object,lab.world.get('Z30')),objectPhysics:lab.world.physics.objectState(object.id),claims:[...pop.claims],stationClaims:[...pop.stationClaims],physicsOwner:pop.physicsOwner};
   });
   if(frames%1200===0||report.retry.done||report.retry.error)console.log('RESOURCE_RETRY '+JSON.stringify({frames,done:report.retry.done,error:report.retry.error}));
   if(report.retry.done||report.retry.error)break;await new Promise(r=>setTimeout(r,10));
  }
  await writeFile(artifact,JSON.stringify(report,null,2));
  assert(report.retry.done&&report.retry.insideTarget&&report.retry.objectPhysics.supported&&report.retry.objectPhysics.settled,'same failed carry did not complete after explicit recovery');assert.equal(report.retry.claims.length,0);assert.equal(report.retry.stationClaims.length,0);assert.equal(report.retry.physicsOwner,null);assert.equal(errors.length,0);
 }
 console.log(JSON.stringify({passed:true,long,frames:report.result.frames,carriers:2,roundTripCarries:4,retryCarryVerified:report.retry?.done===true,maxHeld:1,paths:report.result.paths,artifact}));
}catch(error){report.error=String(error.stack||error);await writeFile(artifact,JSON.stringify(report,null,2));throw error;}finally{await browser.close();}
