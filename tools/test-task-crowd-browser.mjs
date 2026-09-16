import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const url=process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html';
const launchOptions={
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']
};
if(process.env.CHROME_BIN)launchOptions.executablePath=process.env.CHROME_BIN;
const browser=await chromium.launch(launchOptions);
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.setDefaultTimeout(720000);
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
await mkdir('artifacts',{recursive:true});

async function bodyState(){
 return page.evaluate(()=>{
  const frame=document.querySelector('#bodyFrame'),w=frame?.contentWindow,lab=w?.HumanLab;
  let rows=[];try{rows=lab?.population?.list?.()||[];}catch{}
  return{startup:w?.__humanStartup||null,startupError:w?.__startupError||null,hasLab:!!lab,population:rows.length,pending:lab?.population?.pending??null,rows:rows.map(row=>({id:row.id,label:row.label,status:row.status,error:row.error}))};
 });
}

try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('#bodyFrame',{state:'attached',timeout:30000});
 await page.waitForFunction(()=>{
  const w=document.querySelector('#bodyFrame')?.contentWindow;
  if(w?.__startupError||w?.__humanStartup?.status==='failed')return true;
  let population=0,pending=1;try{population=w?.HumanLab?.population?.list?.().length||0;pending=w?.HumanLab?.population?.pending??1;}catch{}
  return w?.__humanStartup?.status==='ready'&&population>=6&&pending===0;
 },null,{timeout:720000,polling:500});
 const ready=await bodyState();
 assert.equal(ready.startupError,null,'body runtime reported startup error: '+JSON.stringify(ready));
 assert.equal(ready.startup?.status,'ready','browser crowd startup failed: '+JSON.stringify(ready));
 assert(ready.population>=6,'crowd browser scenario requires all six real NPCs');
 assert.equal(ready.pending,0,'all review actors must finish generation');

 const crossing=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,world=lab.world;
  lab.setAuto(false);
  const actors=[...pop.values()],test=actors.slice(0,4),extras=actors.slice(4),horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
  const radius=Math.max(...test.map(actor=>actor.human.bodyMetrics.bodyRadiusM))+.08,b=world.bounds,span=1.9;
  const reset=actor=>{try{actor.agent.cancel();}catch{}actor.queue=[];actor.running=null;actor.behavior.enabled=false;actor.behavior.status='stopped';actor.behavior.error=null;actor.resource={mode:'clear',requestKey:null,attempts:0,diversions:actor.resource?.diversions||0,conflict:null,anchor:null};actor.agent.error=null;actor.agent.paused=true;};
  actors.forEach(reset);pop.claims.clear();pop.stationClaims.clear();pop.physicsOwner=null;
  const staticClear=(p,r=radius)=>!world.collision([p[0],0,p[2]],r);
  const candidates=[];
  for(let z=b.zMin+span+.6;z<=b.zMax-span-.6;z+=.45)for(let x=b.xMin+span+.6;x<=b.xMax-span-.6;x+=.45){
   let ok=true;for(let d=-span;d<=span+.001;d+=.19)if(!staticClear([x+d,0,z])||!staticClear([x,0,z+d])){ok=false;break;}
   if(ok)candidates.push([x,0,z]);
  }
  candidates.sort((a,c)=>Math.hypot(c[0],c[2])-Math.hypot(a[0],a[2]));
  const center=candidates[0];if(!center)throw Error('没有找到可进行四向交叉测试的连续空地');
  const parking=[];
  for(let z=b.zMin+radius+.2;z<=b.zMax-radius-.2&&parking.length<extras.length;z+=.8)for(let x=b.xMin+radius+.2;x<=b.xMax-radius-.2&&parking.length<extras.length;x+=.8){const p=[x,0,z];if(horizontal(p,center)<span+2.5||!staticClear(p)||parking.some(q=>horizontal(p,q)<1.1))continue;parking.push(p);}
  extras.forEach((actor,index)=>{if(parking[index])pop.place(actor,parking[index],0);actor.agent.paused=true;});
  const specs=[
   [[center[0]-span,0,center[2]],Math.PI/2],
   [[center[0]+span,0,center[2]],-Math.PI/2],
   [[center[0],0,center[2]-span],0],
   [[center[0],0,center[2]+span],Math.PI]
  ];
  const baselines=new Map(),goals=new Map(),last=new Map(),path=new Map(),stationary=new Map(),maxStationary=new Map(),completedAt=new Map(),distanceM=span*2;
  for(let i=0;i<test.length;i++){
   const actor=test[i],a=actor.agent,[position,yaw]=specs[i];pop.place(actor,position,yaw);a.paused=false;baselines.set(actor.id,a.stats.completed);last.set(actor.id,[...a.pos]);path.set(actor.id,0);stationary.set(actor.id,0);maxStationary.set(actor.id,0);
   goals.set(actor.id,[position[0]+Math.sin(yaw)*distanceM,0,position[2]+Math.cos(yaw)*distanceM]);
   a.submitPlan({schema:'knowledge_human/checked_semantic_plan@1.0',steps:[{type:'walk',direction:'forward',distanceM,referenceFrame:'self'}]});
  }
  let minSeparation=Infinity,frames=0,trafficActions=0;
  for(;frames<12000;frames++){
   pop.tick(1/120);
   for(let i=0;i<test.length;i++)for(let j=i+1;j<test.length;j++)minSeparation=Math.min(minSeparation,horizontal(test[i].agent.pos,test[j].agent.pos));
   for(const actor of test){
    const a=actor.agent,prior=last.get(actor.id),travel=horizontal(prior,a.pos);path.set(actor.id,path.get(actor.id)+travel);last.set(actor.id,[...a.pos]);
    const done=a.stats.completed>baselines.get(actor.id);if(done&&!completedAt.has(actor.id))completedAt.set(actor.id,frames);
    if(!done&&travel<1e-5)stationary.set(actor.id,stationary.get(actor.id)+1);else stationary.set(actor.id,0);
    maxStationary.set(actor.id,Math.max(maxStationary.get(actor.id),stationary.get(actor.id)));
   }
   if(completedAt.size===test.length)break;
  }
  for(const actor of test){const t=actor.agent.locomotion.traffic;trafficActions+=['detours','replans','sideSteps','retreats','corridorYields','corridorClaims','slotReservations','intersectionClaims','intersectionYields','intersectionLaps','intersectionRotations'].reduce((sum,key)=>sum+(Number(t?.[key])||0),0);}
  pop.focus(test.map(actor=>actor.id));lab.render();
  return{
   center,frames,minSeparationM:minSeparation,trafficActions,parkingWait:test.some(actor=>Object.hasOwn(actor.agent.locomotion.traffic,'waitS')),
   actors:test.map(actor=>({id:actor.id,label:actor.label,completed:actor.agent.stats.completed-baselines.get(actor.id),error:actor.agent.error,pathLengthM:path.get(actor.id),directDistanceM:distanceM,pathRatio:path.get(actor.id)/distanceM,maxStationaryS:maxStationary.get(actor.id)/120,goalErrorM:horizontal(actor.agent.pos,goals.get(actor.id)),traffic:{...actor.agent.locomotion.traffic}}))
  };
 });
 console.log('CROSSING_METRICS '+JSON.stringify(crossing));
 assert(crossing.actors.every(actor=>actor.completed>=1),'all four browser actors must finish the crossing');
 assert(crossing.actors.every(actor=>!actor.error),'four-way crossing produced an agent error');
 assert(crossing.minSeparationM>.49,'four-way browser crossing lost body clearance');
 assert(crossing.trafficActions>=1,'four-way browser crossing did not exercise traffic recovery');
 assert(crossing.actors.reduce((sum,actor)=>sum+(actor.traffic.intersectionClaims||0),0)>=1,'crossing did not claim an intersection');
 assert(crossing.actors.reduce((sum,actor)=>sum+(actor.traffic.intersectionYields||0),0)>=2,'crossing did not exercise circulation');
 assert(crossing.actors.reduce((sum,actor)=>sum+(actor.traffic.recoveries||0),0)<128,'crossing repeatedly blocked the motion kernel');
 assert(crossing.actors.every(actor=>actor.maxStationaryS<15),'crossing left an actor stationary for too long');
 assert.equal(crossing.parkingWait,false,'parking wait state returned in the browser crossing');
 assert(crossing.actors.every(actor=>actor.pathRatio<3.4),'browser crossing produced an excessive detour');
 // Diagnostic run records total stationary time; arrival settling is separated in the next revision.
 await page.locator('#bodyFrame').screenshot({path:'artifacts/task-crowd-crossing-r26.png'});

 const corridor=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,world=lab.world,actors=[...pop.values()],test=actors.slice(0,2),extras=actors.slice(2),horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
  const radius=Math.max(...test.map(actor=>actor.human.bodyMetrics.bodyRadiusM))+.06,b=world.bounds,half=.68,length=4.2,endpoint=2.75;
  const reset=actor=>{try{actor.agent.cancel();}catch{}actor.queue=[];actor.running=null;actor.behavior.enabled=false;actor.behavior.status='stopped';actor.behavior.error=null;actor.agent.error=null;actor.agent.paused=true;};actors.forEach(reset);pop.claims.clear();pop.stationClaims.clear();pop.physicsOwner=null;
  const open=(p,r=.08)=>!world.collision([p[0],0,p[2]],r),candidates=[];
  for(let z=b.zMin+endpoint+.7;z<=b.zMax-endpoint-.7;z+=.55)for(let x=b.xMin+1.15;x<=b.xMax-1.15;x+=.55){
   let ok=true;for(let dz=-endpoint;dz<=endpoint+.001;dz+=.25)for(const dx of [-.9,-half,0,half,.9])if(!open([x+dx,0,z+dz])){ok=false;break;}if(ok)candidates.push([x,0,z]);
  }
  const center=candidates.sort((a,c)=>Math.hypot(c[0],c[2])-Math.hypot(a[0],a[2]))[0];if(!center)throw Error('没有找到可布置临时窄通道的空地');
  const ids=['TCORRIDORL','TCORRIDORR'];
  const walls=[
   world.normalizeObject({id:ids[0],templateId:'wall',name:'测试窄通道左墙',shape:'box',p:[center[0]-half,0,center[2]],w:.18,h:1,d:length,mass:100,movable:false,collidable:true,color:[.22,.28,.3]},ids[0]),
   world.normalizeObject({id:ids[1],templateId:'wall',name:'测试窄通道右墙',shape:'box',p:[center[0]+half,0,center[2]],w:.18,h:1,d:length,mass:100,movable:false,collidable:true,color:[.22,.28,.3]},ids[1])
  ];
  world.objects.push(...walls);world.touch('task-browser-corridor-add');world.physics?.syncScene?.();
  const park=[];for(let z=b.zMin+radius+.2;z<=b.zMax-radius-.2&&park.length<extras.length;z+=.8)for(let x=b.xMin+radius+.2;x<=b.xMax-radius-.2&&park.length<extras.length;x+=.8){const p=[x,0,z];if(horizontal(p,center)<endpoint+2.5||world.collision(p,radius)||park.some(q=>horizontal(p,q)<1.1))continue;park.push(p);}extras.forEach((actor,index)=>{if(park[index])pop.place(actor,park[index],0);actor.agent.paused=true;});
  const specs=[[[center[0],0,center[2]-endpoint],0],[[center[0],0,center[2]+endpoint],Math.PI]],distanceM=endpoint*2,baselines=new Map(),last=new Map(),path=new Map(),stationary=new Map(),maxStationary=new Map();
  for(let i=0;i<2;i++){const actor=test[i],a=actor.agent,[position,yaw]=specs[i];pop.place(actor,position,yaw);a.paused=false;baselines.set(actor.id,a.stats.completed);last.set(actor.id,[...a.pos]);path.set(actor.id,0);stationary.set(actor.id,0);maxStationary.set(actor.id,0);a.submitPlan({schema:'knowledge_human/checked_semantic_plan@1.0',steps:[{type:'walk',direction:'forward',distanceM,referenceFrame:'self'}]});}
  let frames=0,minSeparation=Infinity,maxConcurrentOwners=0,circulationTravelM=0;
  for(;frames<15000;frames++){
   const before=new Map(test.map(actor=>[actor.id,[...actor.agent.pos]]));pop.tick(1/120);
   minSeparation=Math.min(minSeparation,horizontal(test[0].agent.pos,test[1].agent.pos));
   const owners=test.filter(actor=>actor.agent.locomotion.traffic.mode==='corridor-owner'&&actor.agent.locomotion.traffic.corridorOwner===actor.id);maxConcurrentOwners=Math.max(maxConcurrentOwners,owners.length);
   for(const actor of test){const a=actor.agent,travel=horizontal(before.get(actor.id),a.pos);path.set(actor.id,path.get(actor.id)+travel);if(a.locomotion.traffic.mode==='corridor-circulation')circulationTravelM+=travel;const done=a.stats.completed>baselines.get(actor.id);if(!done&&travel<1e-5)stationary.set(actor.id,stationary.get(actor.id)+1);else stationary.set(actor.id,0);maxStationary.set(actor.id,Math.max(maxStationary.get(actor.id),stationary.get(actor.id)));}
   if(test.every(actor=>actor.agent.stats.completed>baselines.get(actor.id)))break;
  }
  pop.focus(test.map(actor=>actor.id));lab.render();
  const report={center,frames,minSeparationM:minSeparation,maxConcurrentOwners,circulationTravelM,parkingWait:test.some(actor=>Object.hasOwn(actor.agent.locomotion.traffic,'waitS')),actors:test.map(actor=>({id:actor.id,label:actor.label,completed:actor.agent.stats.completed-baselines.get(actor.id),error:actor.agent.error,pathLengthM:path.get(actor.id),pathRatio:path.get(actor.id)/distanceM,maxStationaryS:maxStationary.get(actor.id)/120,traffic:{...actor.agent.locomotion.traffic}}))};
  world.objects.splice(0,world.objects.length,...world.objects.filter(object=>!ids.includes(object.id)));world.touch('task-browser-corridor-remove');world.physics?.syncScene?.();
  return report;
 });
 console.log('CORRIDOR_METRICS '+JSON.stringify(corridor));
 assert(corridor.actors.every(actor=>actor.completed>=1),'both browser corridor actors must finish');
 assert(corridor.actors.every(actor=>!actor.error),'browser corridor produced an agent error');
 assert(corridor.minSeparationM>.49,'browser corridor lost body clearance');
 assert.equal(corridor.maxConcurrentOwners,1,'browser corridor must expose one direction owner at a time');
 assert(corridor.actors.reduce((n,actor)=>n+(Number(actor.traffic.corridorClaims)||0),0)>=1,'browser corridor did not issue a direction claim');
 assert(corridor.actors.reduce((n,actor)=>n+(Number(actor.traffic.corridorYields)||0),0)>=1,'browser corridor did not actively yield');
 assert(corridor.circulationTravelM>.1,'browser corridor non-owner did not keep circulating');
 assert.equal(corridor.parkingWait,false,'parking wait returned in browser corridor');
 // Diagnostic run records total stationary time; conflict-specific stall is checked next.
 await page.locator('#bodyFrame').screenshot({path:'artifacts/task-crowd-corridor-r26.png'});

 const resource=await page.evaluate(()=>{
  const lab=document.querySelector('#bodyFrame').contentWindow.HumanLab,pop=lab.population,world=lab.world,actors=[...pop.values()],owner=actors[0],requester=actors[1],horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
  const reset=actor=>{try{actor.agent.cancel();}catch{}actor.queue=[];actor.running=null;actor.behavior.enabled=false;actor.behavior.status='stopped';actor.behavior.error=null;actor.agent.error=null;actor.agent.paused=true;actor.resource={mode:'clear',requestKey:null,attempts:0,diversions:actor.resource?.diversions||0,conflict:null,anchor:null};};actors.forEach(reset);pop.claims.clear();pop.stationClaims.clear();pop.physicsOwner=null;
  const object=world.objects.filter(o=>o.movable!==false&&!o.held&&Number.isFinite(o.mass)&&o.mass<=8).sort((a,b)=>a.mass-b.mass)[0]||world.objects.find(o=>o.movable!==false&&!o.held);
  if(!object)throw Error('共享资源测试没有找到可移动物体');
  const zone=[...world.zones].sort((a,b)=>horizontal(b.p,object.p)-horizontal(a.p,object.p))[0];if(!zone)throw Error('共享资源测试没有找到目标工位');
  pop.claims.set(object.id,owner.id);pop.stationClaims.set(zone.id,owner.id);pop.physicsOwner=owner.id;
  const commands=[`把${object.name}搬到${zone.name}`,`搬运${object.name}到${zone.name}`,`${object.name}搬到${zone.name}`];let result=null,command=null;
  requester.agent.paused=false;pop.select([requester.id]);
  for(const candidate of commands){result=pop.dispatch(candidate,{targets:'selected',mode:'replace'});if(result[0]?.accepted){command=candidate;break;}}
  if(!result?.[0]?.accepted)throw Error('共享资源测试命令无法解析：'+JSON.stringify(result));
  const start=[...requester.agent.pos];let frames=0,moved=0,maxStationary=0,stationary=0;
  for(;frames<3600;frames++){
   const before=[...requester.agent.pos];pop.tick(1/120);const travel=horizontal(before,requester.agent.pos);moved=horizontal(start,requester.agent.pos);if(travel<1e-5)stationary++;else stationary=0;maxStationary=Math.max(maxStationary,stationary);
   if(requester.resource.diversions>=1&&moved>.12)break;
  }
  const conflict={...requester.resource.conflict},diversions=requester.resource.diversions,attemptsBeforeRelease=requester.resource.attempts,queueBeforeRelease=requester.queue.length,runningBeforeRelease=requester.running?.source||null;
  pop.claims.delete(object.id);pop.stationClaims.delete(zone.id);pop.physicsOwner=null;
  let reacquired=false;
  for(;frames<9000;frames++){pop.tick(1/120);if(pop.claims.get(object.id)===requester.id||requester.resource.mode==='reserved'){reacquired=true;break;}if(requester.agent.error)break;}
  const report={command,object:{id:object.id,name:object.name},zone:{id:zone.id,name:zone.name},accepted:result[0].accepted,ownerId:owner.id,requesterId:requester.id,conflict,diversions,attemptsBeforeRelease,queueBeforeRelease,runningBeforeRelease,movedM:moved,maxStationaryS:maxStationary/120,reacquired,error:requester.agent.error,parkingWait:Object.hasOwn(requester.resource,'waitS')||Object.hasOwn(requester.agent.locomotion.traffic,'waitS'),resource:{...requester.resource},logs:requester.logs.slice(0,8)};
  pop.focus([owner.id,requester.id]);lab.render();
  try{requester.agent.cancel();}catch{}pop.releaseObjects(requester.agent);pop.claims.clear();pop.stationClaims.clear();pop.physicsOwner=null;
  return report;
 });
 console.log('RESOURCE_METRICS '+JSON.stringify(resource));
 assert.equal(resource.accepted,true,'browser resource request was rejected');
 assert(resource.conflict?.kind==='object'||resource.conflict?.kind==='station'||resource.conflict?.kind==='manipulation','browser resource conflict was not classified');
 assert(resource.diversions>=1,'browser resource conflict did not create an active diversion');
 assert.equal(resource.runningBeforeRelease,'resource-circulation','browser resource conflict did not run a movement task');
 assert(resource.movedM>.12,'browser resource requester did not move away from the conflict');
 assert.equal(resource.reacquired,true,'browser resource requester did not continue after release');
 assert.equal(resource.error,null,'browser resource requester ended with an error');
 assert.equal(resource.parkingWait,false,'resource parking wait returned in browser runtime');
 // Diagnostic run records total stationary time before enforcing conflict-specific motion.
 await page.locator('#bodyFrame').screenshot({path:'artifacts/task-crowd-resource-r26.png'});

 const report={schema:'jarvis/task_crowd_browser_report@1',url,ready,crossing,corridor,resource,pageErrors};
 await writeFile('artifacts/task-crowd-browser-r26.json',JSON.stringify(report,null,2));
 assert.equal(pageErrors.length,0,'browser crowd scenarios emitted page errors: '+JSON.stringify(pageErrors));
 console.log(JSON.stringify({passed:true,population:ready.population,crossing:{frames:crossing.frames,minSeparationM:crossing.minSeparationM,trafficActions:crossing.trafficActions,maxPathRatio:Math.max(...crossing.actors.map(actor=>actor.pathRatio))},corridor:{frames:corridor.frames,minSeparationM:corridor.minSeparationM,maxConcurrentOwners:corridor.maxConcurrentOwners,circulationTravelM:corridor.circulationTravelM},resource:{conflict:resource.conflict.kind,diversions:resource.diversions,movedM:resource.movedM,reacquired:resource.reacquired},pageErrors:0,report:'artifacts/task-crowd-browser-r26.json'}));
}catch(error){
 let state=null;try{state=await bodyState();}catch(diagnosticError){state={diagnosticError:String(diagnosticError?.stack||diagnosticError)};}
 try{await page.screenshot({path:'artifacts/task-crowd-browser-r26-failure.png',fullPage:true});}catch{}
 await writeFile('artifacts/task-crowd-browser-r26-failure.json',JSON.stringify({error:String(error?.stack||error),state,pageErrors},null,2));
 console.error('TASK_CROWD_BROWSER_DIAGNOSTICS '+JSON.stringify({state,pageErrors}));
 throw error;
}finally{
 await browser.close();
}
