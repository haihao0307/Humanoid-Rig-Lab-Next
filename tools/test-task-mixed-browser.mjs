// Real generated actors, NPCPopulation queues and Cannon manipulation.
// Run against a freshly built page; artifacts belong outside the source tree.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const url=process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html';
const requestedPopulation=process.argv.includes('--eight')?8:6;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();page.setDefaultTimeout(720000);
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
await mkdir('artifacts',{recursive:true});
let report={schema:'jarvis/task_mixed_browser_report@1',url,pageErrors};
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow;return w?.__startupError||w?.__humanStartup?.status==='ready'&&w.HumanLab?.population?.pending===0;},null,{timeout:720000,polling:500});
 const setup=await page.evaluate(async requestedPopulation=>{
  const w=document.querySelector('#bodyFrame').contentWindow,lab=w.HumanLab,pop=lab.population,world=lab.world;
  if(w.__startupError)throw Error(w.__startupError);lab.setAuto(false);
  if([...pop.values()].length<6)throw Error('Six generated actors required');
  const definition=pop.definitionFor([...pop.values()][0]);definition.character.task.startOnSpawn=false;
  while(pop.actors.size<requestedPopulation)await pop.spawn(definition);
  const actors=[...pop.values()];
  for(const actor of actors){actor.agent.cancel();actor.queue=[];actor.running=null;actor.behavior.enabled=false;actor.agent.paused=true;}
  const positions=[[-2.4,0,3.1],[8,0,-.5],[10.5,0,-.5],[-4.3,0,5.5],[-.5,0,4],[-4.3,0,3.2],[-1,0,6.5],[1.5,0,7.2]];
  actors.forEach((actor,i)=>{const p=positions[i];if(world.collision(p,actor.human.bodyMetrics.bodyRadiusM+.08))throw Error('Fixture spawn obstructed: '+actor.id);pop.place(actor,p,0);});
  const object=world.normalizeObject({id:'MIX_BOX',name:'混合回归箱',shape:'box',p:[-2.4,0,4],w:.3,h:.6,d:.3,mass:.5,friction:.4,restitution:0,movable:true,collidable:true},'MIX_BOX');
  world.objects.push(object);world.zones.push(world.normalizeZone({id:'Z31',name:'混合回归工位',p:[-2.4,0,5.4],r:.65},'Z31'));world.touch('mixed-test-fixture');world.physics.syncScene();
  // Settle the actual free body before any task forecast or grasp request.
  for(let i=0;i<180;i++)world.physics.step(1/120,[]);
  const commands=['把混合回归箱搬到混合回归工位','向前走1米','挥手','打招呼','敬礼','向前走1米','向左转90度','挥手'].slice(0,actors.length);
  const accepted=actors.map((actor,i)=>pop.dispatch(commands[i],{targets:[actor.id],mode:'replace'})[0]);lab.setAuto(false);
  const baseline=actors.map(a=>a.agent.stats.completed);
  lab.mixedProbe={actors,baseline,frames:0,events:[],phases:[],lastPhase:'',pauseAt:null,stopAt:null,pausedCheck:null,stoppedCheck:null,stage:'start',accepted,commands};
  return{population:actors.length,accepted,commands,object:object.id};
 },requestedPopulation);
 report.setup=setup;console.log('MIXED_READY '+JSON.stringify(setup));
 assert(setup.accepted.every(r=>r.accepted),'mixed queue dispatch rejected');
 const deadline=Date.now()+12*60*1000;
 while(Date.now()<deadline){
  const progress=await page.evaluate(()=>{
   const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,world=lab.world,t=lab.mixedProbe,owner=t.actors[0],a=owner.agent;
   const snapshot=()=>({p:[...a.held.p],q:[...a.held.q],time:a.time,peerTime:t.actors[1].agent.time,peerPosition:[...t.actors[1].agent.pos],physicsSteps:world.physics.stepCount});
   const retained=before=>({positionErrorM:Math.hypot(...a.held.p.map((v,i)=>v-before.p[i])),orientationError:Math.max(...a.held.q.map((v,i)=>Math.abs(v-before.q[i]))),actorTimeDelta:a.time-before.time,peerTimeDelta:t.actors[1].agent.time-before.peerTime,peerTravelM:Math.hypot(...t.actors[1].agent.pos.map((v,i)=>v-before.peerPosition[i])),physicsSteps:world.physics.stepCount-before.physicsSteps,objectOwner:pop.claims.get(a.held.id),stationOwner:pop.stationClaims.get('Z31'),physicsOwner:pop.physicsOwner,heldOwner:a.held.heldOwner});
   for(let k=0;k<60;k++){
    pop.tick(1/120);t.frames++;
    const phase=a.phase+(a.preflightWaiting?':preflight:'+a.preflight?.kind:'');if(phase!==t.lastPhase){t.lastPhase=phase;t.phases.push({frame:t.frames,phase});}
    if(t.stage==='start'&&a.held&&!a.preflightWaiting){t.events.push({action:'pause',result:pop.control('pause',[owner.id]),frame:t.frames});t.events.push({action:'append-while-paused',result:pop.dispatch('挥手',{targets:[owner.id],mode:'append'}),frame:t.frames});t.events.push({action:'peer-walk-during-pause',result:pop.dispatch('向前走0.4米',{targets:[t.actors[1].id],mode:'append'}),frame:t.frames});lab.setAuto(false);t.pauseAt=t.frames;t.before=snapshot();t.stage='paused';}
    if(t.stage==='paused'&&t.frames-t.pauseAt>=120){t.pausedCheck=retained(t.before);t.events.push({action:'resume',result:pop.control('resume',[owner.id]),frame:t.frames});lab.setAuto(false);t.stage='resumed';}
    if(t.stage==='resumed'&&a.held&&a.phase==='travel'){
     pop.dispatch('挥手',{targets:[owner.id],mode:'append'});lab.setAuto(false);
     t.events.push({action:'stop',result:pop.control('stop',[owner.id]),frame:t.frames});t.events.push({action:'peer-walk-during-stop',result:pop.dispatch('向前走0.4米',{targets:[t.actors[1].id],mode:'append'}),frame:t.frames});lab.setAuto(false);t.stopAt=t.frames;t.before=snapshot();t.stage='stopped';
    }
    if(t.stage==='stopped'&&t.frames-t.stopAt>=120){t.stoppedCheck={...retained(t.before),queueLength:owner.queue.length};t.events.push({action:'resume-after-stop',result:pop.control('resume',[owner.id]),frame:t.frames});lab.setAuto(false);t.stage='finishing';}
    if(t.actors.some(row=>row.agent.error||row.behavior.error))break;
    if(t.actors.every((row,i)=>row.agent.stats.completed>t.baseline[i]&&!row.running&&!row.queue.length&&row.agent.activity().readyForTask))break;
   }
   const rows=t.actors.map((row,i)=>({id:row.id,completed:row.agent.stats.completed-t.baseline[i],phase:row.agent.phase,error:row.agent.error||row.behavior.error,held:row.agent.held?.id,queued:row.queue.length,running:row.running?.text,preflight:row.agent.preflight,ready:row.agent.activity().readyForTask}));
   return{frames:t.frames,stage:t.stage,rows,done:rows.every(r=>r.completed>=1&&!r.running&&!r.queued&&r.ready),failed:rows.some(r=>r.error)};
  });
  if(progress.frames%600===0||progress.failed||progress.done)console.log('MIXED_PROGRESS '+JSON.stringify(progress));
  report.progress=progress;if(progress.failed||progress.done||progress.frames>=24000)break;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 report.result=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,t=lab.mixedProbe,pop=lab.population;
  const object=lab.world.get('MIX_BOX');
  return{frames:t.frames,stage:t.stage,events:t.events,phases:t.phases,pausedCheck:t.pausedCheck,stoppedCheck:t.stoppedCheck,claims:[...pop.claims],stationClaims:[...pop.stationClaims],physicsOwner:pop.physicsOwner,object:lab.world.physics.objectState('MIX_BOX'),insideTarget:lab.world.inside(object,lab.world.get('Z31')),heldOwner:object.heldOwner,actors:t.actors.map(row=>({id:row.id,stats:row.agent.stats,evidence:row.agent.evidence,position:row.agent.pos,logs:row.logs.slice(0,12),preflight:row.agent.preflight}))};
 });
 await writeFile('artifacts/task-mixed-browser.json',JSON.stringify(report,null,2));
 assert.equal(report.progress.done,true,'real mixed tasks did not all complete');
 for(const check of [report.result.pausedCheck,report.result.stoppedCheck]){
  assert(check,'held pause/stop was not reached');assert(check.positionErrorM<1e-9&&check.orientationError<1e-9,'held object moved while paused');assert.equal(check.actorTimeDelta,0);assert(check.peerTimeDelta>.9&&check.peerTravelM>.01&&check.physicsSteps>=120,'held owner froze other actors or world');
  for(const key of ['objectOwner','stationOwner','physicsOwner','heldOwner'])assert.equal(check[key],report.progress.rows[0].id,'lost '+key);
 }
 assert.equal(report.result.stoppedCheck.queueLength,0);assert.equal(report.result.physicsOwner,null);assert.equal(report.result.claims.length,0);assert.equal(report.result.stationClaims.length,0);
 assert.equal(report.progress.rows[0].completed,1,'cancelled future actions still ran');
 const stop=report.result.events.find(e=>e.action==='stop').result[0];assert(stop.accepted&&stop.paused&&stop.requiresRelease&&!stop.stopped);
 assert(report.result.insideTarget&&report.result.object.supported&&report.result.object.settled,'placement needs actual stable support inside the target');assert.equal(report.result.heldOwner,null);
 assert(report.result.actors[0].evidence.some(e=>e.type==='carry'&&e.completion==='verified'),'missing verified physical placement');
 assert.equal(pageErrors.length,0);console.log(JSON.stringify({passed:true,population:setup.population,frames:report.result.frames,heldPause:true,heldStopResume:true,report:'artifacts/task-mixed-browser.json'}));
}catch(error){report.error=String(error.stack||error);try{report.startup=await page.evaluate(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow;return{startup:w?.__humanStartup,error:w?.__startupError};});}catch{}await writeFile('artifacts/task-mixed-browser.json',JSON.stringify(report,null,2));throw error;}finally{await browser.close();}
