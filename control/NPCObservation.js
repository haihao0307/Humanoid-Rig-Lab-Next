/* Bounded observation records. CPU timers measure elapsed main-thread work,
 * not OS CPU utilization; renderer GPU and heap values are scene-wide. */
const NPC_LONG_TASKS={
 patrol:{title:'营区巡逻与交接',command:'走到集合场\n向左转90度\n等待 2 秒\n向右转90度\n走到门岗交接\n打招呼\n等待 3 秒\n走到办公室报到\n挥手\n等待 3 秒'},
 supply:{title:'被装箱循环搬运',command:'把 SUP_A 搬到营房补给\n等待 3 秒\n把 SUP_A 搬到被装器材归位\n等待 3 秒'},
 canteen:{title:'食堂日用品往返搬运',command:'把 SUP_B 搬到食堂接货\n等待 3 秒\n把 SUP_B 搬到日用品箱归位\n等待 3 秒'},
 recycle:{title:'空箱回收与归还',command:'把 EMPTY_A 搬到回收交接\n等待 3 秒\n把 EMPTY_A 搬到食堂空箱归位\n等待 3 秒'},
 documents:{title:'文书多站交接',command:'把 DOC_A 搬到事务交接\n打招呼\n等待 3 秒\n把 DOC_A 搬到门岗交接\n等待 3 秒\n把 DOC_A 搬到文书包归档\n等待 3 秒'},
 farm:{title:'青菜筐分拣与归还',command:'把 AGR_A 搬到 Z11\n等待 3 秒\n把 AGR_A 搬到 Z17\n打招呼\n把 AGR_A 搬到青菜筐归位\n等待 3 秒'},
 rest:{title:'行走、坐卧与起身',command:'走到营区地面休息\n坐在地上\n等待 8 秒\n躺在地上\n等待 8 秒\n站起来\n打招呼\n走到集合场\n等待 3 秒'},
 guard:{title:'原地值守',command:'打招呼\n等待 15 秒\n挥手\n等待 20 秒'}
};
class NPCObservation {
 constructor(population){this.p=population;this.recording=false;this.samples=[];this.events=[];this.metrics=new Map();this.lastPhase=new Map();this.droppedSamples=0;this.droppedEvents=0;this.key='humanlab.npc.observation@1';this.storageError=null;this.previous=null;try{this.previous=JSON.parse(localStorage.getItem(this.key)||'null');}catch{}this.latest=null;}
 start(){if(this.recording)return;this.startedAt=new Date().toISOString();this.startMs=performance.now();this.lastSample=this.startMs;this.lastSave=this.startMs;this.frames=[];this.metrics.clear();this.lastPhase.clear();this.samples=[];this.events=[];this.droppedSamples=0;this.droppedEvents=0;this.recording=true;this.sceneAtStart=this.p.lab.world.exportScene();this.event('recording-start',null);}
 stop(){if(!this.recording)return;this.sample(performance.now(),true);this.event('recording-stop',null);this.recording=false;this.persist();}
 event(type,actor,detail={}){if(!this.recording)return;this.events.push({at:new Date().toISOString(),wallS:(performance.now()-this.startMs)/1000,type,id:actor?.id??null,simulationS:actor?.agent.time??this.p.elapsedS,...detail});if(this.events.length>1200){this.events.shift();this.droppedEvents++;}}
 actorTick(actor,cpuMs){if(!this.recording)return;let m=this.metrics.get(actor.id);if(!m){m={cpuMs:0,ticks:0,maxTickMs:0};this.metrics.set(actor.id,m);}m.cpuMs+=cpuMs;m.ticks++;m.maxTickMs=Math.max(m.maxTickMs,cpuMs);
  const a=actor.agent,b=actor.behavior,key=[a.phase,b.status,b.stepIndex,b.cycles,a.paused,a.error,b.error,a.preflight?.kind,a.preflight?.status].join('|');if(this.lastPhase.get(actor.id)!==key){this.lastPhase.set(actor.id,key);this.event(a.error||b.error?'error':'phase',actor,{phase:a.phase,preflight:a.preflight?{...a.preflight}:null,task:b.title,step:b.stepIndex,cycles:b.cycles,paused:a.paused,error:a.error||b.error||null,position:[...a.pos],held:a.held?.id||null});if(a.error||b.error)this.persist();}}
 frame(dt,cpuMs){if(!this.recording)return;if(dt>0)this.frames.push({ms:dt*1000,cpuMs});if(this.frames.length>240)this.frames.shift();this.sample(performance.now());}
 sample(now,force=false){if(!force&&now-this.lastSample<1000)return;const span=Math.max(.001,(now-this.lastSample)/1000),s=this.p.lab.renderer.compactPerformance?.stats||{},renderFresh=s.lastFrameTime!=null&&now-s.lastFrameTime<=1200,times=this.frames.map(f=>f.ms).sort((a,b)=>a-b),mean=v=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  const actors=[...this.p.values()].map(actor=>{const a=actor.agent,b=actor.behavior,m=this.metrics.get(actor.id),c=actor.compact;return{id:actor.id,label:actor.label,task:b.title,phase:a.phase,preflight:a.preflight?{...a.preflight}:null,status:b.status,step:b.stepIndex,cycles:b.cycles,taskElapsedS:b.elapsedS,simulationS:a.time,paused:a.paused,error:a.error||b.error||null,position:[...a.pos],held:a.held?.id||null,traffic:structuredClone(a.locomotion.traffic),completedActions:a.stats.completed,objectId:a.skill?.o?.id??null,objectPhysics:a.skill?.o?this.p.lab.world.physics?.objectState(a.skill.o.id)??null:null,placementStableS:a.skill?.placementStableS??null,cpuMsPerWallSecond:m?m.cpuMs/span:0,meanTickMs:m?.ticks?m.cpuMs/m.ticks:null,maxTickMs:m?.maxTickMs??null,geometryBytes:(c?.geometryBytes||0)+(c?.hair?.geometryBytes||0),triangles:(c?.report.triangles||0)+(c?.skirt?.report.triangles||0)+(c?.hair?.triangles||0),stats:{...a.stats}};});
  this.latest={at:new Date().toISOString(),wallS:(now-this.startMs)/1000,visibility:document.visibilityState,frames:this.frames.length,renderFresh,fps:renderFresh?s.fps??null:null,meanFrameMs:mean(times),p95FrameMs:times.length?times[Math.ceil(times.length*.95)-1]:null,longFrames:this.frames.filter(f=>f.ms>50).length,meanLoopCpuMs:mean(this.frames.map(f=>f.cpuMs)),renderCpuMs:renderFresh?s.cpuFrameMs??null:null,gpuMs:renderFresh?s.gpuMs??null:null,gpuTimerAvailable:s.gpuTimerAvailable??false,jsHeapBytes:s.jsHeapBytes??null,geometryGPUBytes:s.geometryGPUBytes??null,drawCalls:renderFresh?s.drawCalls??null:null,trianglesPerFrame:s.trianglesPerFrame??null,quality:this.p.lab.renderer.quality,actors};
  this.samples.push(this.latest);if(this.samples.length>1800){this.samples.shift();this.droppedSamples++;}this.metrics.clear();this.frames=[];this.lastSample=now;if(now-this.lastSave>=10000){this.persist();this.lastSave=now;}}
 report(){return{schema:'humanlab/npc-observation@1',startedAt:this.startedAt,recording:this.recording,scope:{cpu:'wall-clock main-thread time; per-actor excludes shared physics and render',gpu:'shared scene GPU timer; null if unavailable',memory:'JS heap is browser-wide; geometry is buffer accounting, not total VRAM',retention:'latest 1800 one-second samples and 1200 events; local recovery keeps latest 120 samples and 240 events'},droppedSamples:this.droppedSamples,droppedEvents:this.droppedEvents,sceneAtStart:this.sceneAtStart,taskRecipes:this.p.exportScene(),samples:this.samples,events:this.events};}
 persist(){try{const report=this.report();localStorage.setItem(this.key,JSON.stringify({...report,samples:this.samples.slice(-120),events:this.events.slice(-240),recoveryWindow:true}));this.storageError=null;}catch(error){this.storageError=error.message;}}
 prepareCarryStation(){const w=this.p.lab.world;if(w.theme!=='camp')throw Error('双人观察示例需要军营场景');this.p.requireWorldIdle();
  const specs=[{id:'OBS_BOX',name:'观察搬运箱',templateId:'supplyCrate',p:[0,0,3],w:.32,d:.20,h:.5,mass:.8,aliases:['观察箱']},{id:'Z26',name:'观察箱起点',p:[0,0,3],r:.65,shape:'square'},{id:'Z27',name:'观察箱终点',p:[2,0,5],r:.65,shape:'square'}],pending=[];
  for(const spec of specs){const existing=w.get(spec.id);if(existing){if(existing.name!==spec.name)throw Error('观察区编号被其他场景内容占用：'+spec.id);continue;}const isZone=spec.id.startsWith('Z'),entity=isZone?w.normalizeZone(spec,spec.id):w.normalizeObject(spec,spec.id);if(!isZone)for(const a of this.p.values()){const check=w.canPlace(entity,null,a.agent.pos);if(!check.ok)throw Error('观察箱无法放置：'+check.reason);}pending.push({entity,isZone});}
  if(w.objects.length+pending.filter(v=>!v.isZone).length>160||w.zones.length+pending.filter(v=>v.isZone).length>32)throw Error('场景没有足够空间添加观察设施');
  for(const {entity,isZone}of pending)(isZone?w.zones:w.objects).push(entity);if(pending.length){w.touch('npc-observation-station');environmentChanged('npc-observation-station');}
 }
 startPair(){const actors=[...this.p.values()].slice(0,2);if(actors.length<2)throw Error('需要两个人物才能开始双人观察');
  for(const a of actors)if(this.p.isReserved(a.agent)||a.agent.characterEditInProgress||a.hairTask||a.behavior.enabled||a.queue.length||a.running||!a.agent.activity().readyForTask)throw Error('请先让两人结束现有任务并等待加载、收脚完成');
  this.prepareCarryStation();
  const recipes=[NPC_LONG_TASKS.patrol,{title:'观察箱短程往返',command:'等待 3 秒\n把 OBS_BOX 搬到 Z27\n等待 2 秒\n把 OBS_BOX 搬到 Z26\n等待 2 秒'}];
  for(let i=0;i<actors.length;i++){const a=actors[i];if(this.p.isReserved(a.agent)||a.agent.characterEditInProgress||a.hairTask||a.behavior.enabled||a.queue.length||a.running||!a.agent.activity().readyForTask)throw Error('请先让两人结束现有任务并等待加载、收脚完成');npcCompileTask(recipes[i].command,this.p.lab.world,a.agent.lastObject);}
  this.start();const results=actors.map((a,i)=>{try{this.p.setBehavior(a.id,{type:'repeat',...recipes[i],intervalS:2,cycleLimit:0,durationS:0});return{id:a.id,accepted:true,reason:'开始 '+recipes[i].title};}catch(error){this.event('task-rejected',a,{error:error.message});this.persist();return{id:a.id,accepted:false,reason:error.message};}});this.p.select(actors.map(a=>a.id));this.p.lab.focus('field');this.p.lab.render();return results;}
}




