/* NPC definitions are recipes. Each live actor owns its body, clock, queue,
 * appearance and behavior memory; only the world and renderer are shared. */
const NPC_POPULATION_SCHEMA='jarvis/npc_population_recipe@1';
const NPC_INSTANCE_LIMIT=8; // Conservative authoring limit, not a measured crowd budget.
const NPC_TASK_TEXT_LIMIT=16000,NPC_TASK_STEP_LIMIT=64;
function npcTaskRecipe(input={}){
 if(!input||typeof input!=='object'||!['manual','repeat'].includes(input.type))throw Error('任务类型无效');
 const command=input.command??'',title=input.title??'持续任务',intervalS=input.intervalS??5,cycleLimit=input.cycleLimit??0,durationS=input.durationS??0;
 if(typeof command!=='string'||command.length>NPC_TASK_TEXT_LIMIT||input.type==='repeat'&&!command.trim())throw Error('请填写不超过 16000 字的任务');
 if(typeof title!=='string'||title.length>80)throw Error('任务名称不能超过 80 字');
 if(!Number.isFinite(intervalS)||intervalS<.5||intervalS>3600)throw Error('每轮间隔须在 0.5–3600 秒');
 if(!Number.isInteger(cycleLimit)||cycleLimit<0||cycleLimit>10000)throw Error('执行轮数须在 1–10000 之间，0 表示不限');
 if(!Number.isFinite(durationS)||durationS<0||durationS>86400)throw Error('持续时长不能超过 24 小时，0 表示不限');
 return{type:input.type,title:title.trim()||'持续任务',command:command.trim(),intervalS,cycleLimit,durationS};
}
function npcCompileTask(command,world,last=null){
 const lines=command.split(/\r?\n|然后|接着|最后|[；;。]/).map(line=>line.trim().replace(/^(?:[-*•]\s+|\d+[.、)]\s*)/,'').replace(/^(?:请|先|再)\s*/,'' )).filter(Boolean);
 if(!lines.length||lines.length>NPC_TASK_STEP_LIMIT)throw Error('每份任务需要 1–64 个步骤，可换行编写');
 let previous=last,actions=0;
 return lines.map((text,index)=>{
  try{
   const wait=text.match(/^(?:等待|等候|停留|休息)\s*(\d+(?:\.\d+)?)\s*(秒|分钟|分)$/);
   if(wait){const seconds=Number(wait[1])*(wait[2]==='秒'?1:60);if(seconds<.1||seconds>3600)throw Error('单次等待须在 0.1 秒至 60 分钟之间');return{kind:'wait',text,seconds};}
   if(text.length>4096)throw Error('单个步骤不能超过 4096 字');
   const plan=parse(text,world,previous);previous=plan.lastObject;actions+=plan.steps.length;
   if(actions>256)throw Error('一轮最多包含 256 个基础动作');return{kind:'command',text};
  }catch(error){throw Error('第 '+(index+1)+' 步：'+error.message);}
 });
}
function npcIdleBehavior(recipe=npcTaskRecipe({type:'manual'}),steps=[]){return{...recipe,steps,enabled:false,cycles:0,stepIndex:0,elapsedS:0,nextAt:0,waitUntil:null,status:'idle',finishReason:null,error:null};}
function npcResourceHash(value){let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function npcResourceDirectionOrder(id,attempt=0){const base=['left','forward','right','backward'],offset=(npcResourceHash(id)+Math.max(0,attempt))%base.length;return base.map((_,i)=>base[(i+offset)%base.length]);}
// A second recipe from the same source family; no saved mesh or copied live state.
function npcMotherVariant(definition){
 const mother=npcCopy(definition),base=mother.character;
 return validateNPCDefinition({...mother,behavior:null,character:{...base,id:'r2-mother-variant',label:'母体复制体 · 紧凑壮实',seed:260912,
  statureM:undefined,shape:{...base.shape,statureScale:.95,legProportion:-.35,shoulderWidth:.70,hipWidth:.35,waistWidth:.65,torsoDepth:.55,armFullness:.75,legFullness:.65},
  appearance:{...base.appearance,skin:{...base.appearance.skin,baseColor:'#ad7956',undertone:.20,redness:.12,sunExposure:.30},hair:{preset:'textured',color:'#33251e',seed:260912,lengthScale:.85,density:1}},
  task:{command:'',startOnSpawn:false}}});
}
// Fixed authored comparison recipes. Seeds identify a resident; they do not
// randomly resample faces on load. The NPC definition registry freezes copies.
function npcReviewCast(){return [
 {id:'r2-resident-lin-v1',label:'林川 · 修长窄脸',seed:26091401,role:'patrol',offset:[-1.30,0,0],
  shape:{statureScale:1.06,legProportion:.7,shoulderWidth:-.3,hipWidth:-.25,waistWidth:-.6,torsoDepth:-.35,armFullness:-.45,legFullness:-.3},
  skin:{baseColor:'#c8a081',undertone:.12,redness:.09,sunExposure:.18},hair:{preset:'side-part',color:'#29251f',lengthScale:1.1,density:.9},
  face:{offsetsMm:{cheekLeft:[-3,-1,-1],cheekRight:[3,-1,-1],chin:[0,-4,1],noseLeft:[-1,0,1.5],noseRight:[1,0,1.5],browOuterLeft:[0,1.8,0],browOuterRight:[0,1.8,0],mouthLeft:[-1,0,0],mouthRight:[1,0,0]}}},
 {id:'r2-resident-yue-v1',label:'岳石 · 宽肩宽脸',seed:26091402,role:'porter',offset:[2.45,0,0],
  shape:{statureScale:1.02,legProportion:-.2,shoulderWidth:.85,hipWidth:.3,waistWidth:.3,torsoDepth:.5,armFullness:.7,legFullness:.55},
  skin:{baseColor:'#79513a',undertone:.22,redness:.10,sunExposure:.5},hair:{preset:'crop',color:'#201c18',lengthScale:.8,density:1},
  face:{offsetsMm:{cheekLeft:[4,0,1],cheekRight:[-4,0,1],chin:[0,1,3],noseLeft:[2,0,1],noseRight:[-2,0,1],browInnerLeft:[0,-1,1.5],browInnerRight:[0,-1,1.5],mouthLeft:[2,0,0],mouthRight:[-2,0,0]}}},
 {id:'r2-resident-he-v1',label:'禾安 · 矮壮圆脸',seed:26091403,role:'sorter',offset:[-2.6,0,0],
  shape:{statureScale:.94,legProportion:-.55,shoulderWidth:.1,hipWidth:.6,waistWidth:.8,torsoDepth:.7,armFullness:.3,legFullness:.6},
  skin:{baseColor:'#d2b29c',undertone:-.12,redness:.17,sunExposure:.08},hair:{preset:'fringe',color:'#503328',lengthScale:1,density:.95},
  face:{offsetsMm:{cheekLeft:[2,1,3],cheekRight:[-2,1,3],chin:[0,3,-1.5],noseLeft:[1,0,-1],noseRight:[-1,0,-1],browOuterLeft:[0,1,0],browOuterRight:[0,1,0],mouthLeft:[1,.5,0],mouthRight:[-1,.5,0]}}},
 {id:'r2-resident-qiao-v1',label:'乔柏 · 清瘦银发',seed:26091404,role:'watcher',offset:[-3.9,0,0],
  shape:{statureScale:.99,legProportion:.25,shoulderWidth:-.25,hipWidth:-.15,waistWidth:-.45,torsoDepth:-.35,armFullness:-.55,legFullness:-.45},
  skin:{baseColor:'#b78b69',undertone:.03,redness:.08,sunExposure:.38},hair:{preset:'silver',color:'#aaa79e',lengthScale:1,density:.85},
  face:{offsetsMm:{cheekLeft:[-2.5,-2,-2],cheekRight:[2.5,-2,-2],chin:[0,-2,2.5],noseLeft:[-1.5,0,2.5],noseRight:[1.5,0,2.5],browInnerLeft:[0,-1.5,.5],browInnerRight:[0,-1.5,.5],browOuterLeft:[0,-1,0],browOuterRight:[0,-1,0],mouthLeft:[-.5,-.5,0],mouthRight:[.5,-.5,0]}}}
 ];}
class NPCPopulation {
 constructor(lab){
  this.lab=lab;this.actors=new Map();this.selected=new Set();this.claims=new Map();this.stationClaims=new Map();this.pendingIds=new Set();this.pending=0;this.serial=0;this.closed=false;this.elapsedS=0;this.clock=new MotionLab.FixedClock();this.physicsOwner=null;this.physicsDeferred=new Set();
  const definition=lab.npc.export(),actor=this.context('npc-'+(++this.serial),definition,lab.human,lab.agent,lab.compact);
  this.actors.set(actor.id,actor);this.activeId=actor.id;this.selected.add(actor.id);lab.world.population=this;
  actor.hairStatus=lab.hairStatus;actor.hairTask=lab.hairTask||null;
  for(const key of ['enabled','windEnabled','windSpeed']){
   actor.hair[key]=lab.hair[key];Object.defineProperty(lab.hair,key,{get:()=>this.active.hair[key],set:value=>{this.active.hair[key]=value;},configurable:true});
  }
  for(const key of ['compact','hairTask','hairStatus','compactQualityPending'])Object.defineProperty(lab,key,{get:()=>this.active[key],set:value=>{this.active[key]=value;},configurable:true});
  this.bindSurface(actor);this.syncSurfaces();this.observation=new NPCObservation(this);
 }
 get active(){return this.actors.get(this.activeId);}
 values(){return this.actors.values();}
 get(id){const actor=this.actors.get(id);if(!actor)throw Error('NPC 实例不存在：'+id);return actor;}
 context(id,definition,human,agent,compact=null){
  const actor={id,definitionId:definition.character.id,definition:npcCopy(definition),label:definition.character.label,
   identity:{residentId:definition.behavior?.presetId||id,displayName:definition.behavior?.displayName||definition.character.label.slice(0,24),role:definition.behavior?.role||'general'},
   human,agent,tissue:human.tissue,compact,renderer:this.lab.renderer,world:this.lab.world,hairTask:null,hairStatus:{state:'pending'},compactQualityPending:false,
   hair:{enabled:definition.attachments.hair.enabled,windEnabled:false,windSpeed:0},queue:[],logs:[],behavior:{...npcIdleBehavior()},resource:{mode:'clear',requestKey:null,attempts:0,diversions:0,conflict:null,anchor:null},disposed:false};
  agent.npcId=id;
  agent.log=message=>{actor.logs.unshift(message);actor.logs.length=Math.min(actor.logs.length,16);if(this.activeId===id)logMessage('['+actor.label+'] '+message);};
  let residentFacePose=null,residentFaceUniforms=null;
  actor.face={uniforms:()=>{
   if(this.activeId===id)return this.lab.face.uniforms();
   const pose=actor.human.characterPreset.appearance.face;
   // Face editor commits replace the recipe object. Unchanged residents reuse
   // their resolved arrays across render passes instead of allocating each time.
   if(residentFacePose!==pose){
    const resolved=resolveFaceOffsets(pose),offsets=resolved.values,muscles=resolved.muscles,eyelids=resolved.eyelids;
    residentFaceUniforms={offsets,muscles,eyelids,lipOpen:resolved.lipOpen,jawOpen:resolved.jawOpen,enabled:resolved.lipOpen>0||resolved.jawOpen>0||[offsets,muscles,eyelids].some(values=>values.some(v=>v!==0))?1:0,heatmap:0,selected:0};residentFacePose=pose;
   }
   return residentFaceUniforms;
  },refresh:()=>{if(this.activeId===id)this.lab.face.refresh();}};
  return actor;
 }
 bindSurface(actor){if(actor.compact){actor.compact.lab=actor;if(actor.compact.hair)actor.compact.hair.lab=actor;}}
 syncSurfaces(){this.lab.renderer.compacts=[...this.values()].map(a=>a.compact).filter(Boolean);this.lab.renderer.compact=this.active?.compact||null;needsRedraw=true;}
 changed(){this.syncSurfaces();window.dispatchEvent(new CustomEvent('humanlab:population-change',{detail:{activeId:this.activeId,count:this.actors.size,pending:this.pending}}));}
 list(){return [...this.values()].map(a=>({id:a.id,definitionId:a.definitionId,label:a.label,identity:npcCopy(a.identity),active:a.id===this.activeId,selected:this.selected.has(a.id),position:[...a.agent.pos],status:a.agent.activity().status,phase:a.agent.phase,queued:a.queue.length,error:a.agent.error,preflight:a.agent.preflight?{...a.agent.preflight}:null,resource:npcCopy(a.resource),behavior:{...a.behavior,steps:undefined,stepCount:a.behavior.steps.length,currentStep:a.behavior.steps[a.behavior.stepIndex]?.text||'',waitRemainingS:Math.max(0,a.behavior.waitUntil===null?a.behavior.nextAt-a.agent.time:a.behavior.waitUntil-a.behavior.elapsedS)}}));}
 targets(input='selected'){
  const ids=input==='all'?[...this.actors.keys()]:input==='selected'?[...this.selected]:Array.isArray(input)?input:[input];
  if(!ids.length)throw Error('请先选择 NPC');return [...new Set(ids)].map(id=>this.get(id));
 }
 select(ids){if(!Array.isArray(ids))throw Error('NPC 选择必须是实例 ID 列表');const actors=ids.map(id=>this.get(id));this.selected=new Set(actors.map(a=>a.id));this.changed();return this.list();}
 editorGuard({ignoreBodyRequests=false}={}){
  if(this.lab.character.busy||this.active.agent.characterEditInProgress||this.active.compactQualityPending||this.active.hairTask)throw Error('请等待当前人物外观更新完成');
  const guard=window.parent!==window?window.parent.JarvisEmbodimentLab?.populationCanActivate?.(this.activeId,{ignoreBodyRequests}):null;
  if(guard&&guard.ok===false)throw Error(guard.reason||'请先结束当前任务面板中的任务');
  if(window.__jarvisRoutineReservation||window.__jarvisSemanticReservation)throw Error('请先结束当前任务面板中的任务或持续日常');
 }
 isReserved(agent){if(agent.npcId!==this.activeId)return false;const guard=window.parent!==window?window.parent.JarvisEmbodimentLab?.populationCanActivate?.(this.activeId,{ignoreBodyRequests:true}):null;return !!(window.__jarvisRoutineReservation||window.__jarvisSemanticReservation||guard?.ok===false);}
 activate(id){
  const actor=this.get(id);if(id===this.activeId)return this.list();this.editorGuard();
  this.lab.face.stop();this.lab.face.endSample();this.active.definition=this.definitionFor(this.active);
  this.activeId=id;human=actor.human;agent=actor.agent;
  Object.assign(this.lab,{human,agent,tissue:actor.tissue});this.lab.renderer.setTissue(actor.tissue);
  window.__NPCRoutineIdentity__=actor.definition.behavior;
  refreshCharacterControls(this.lab);this.lab.strength.refresh();this.lab.settings.close();
  this.changed();focus('body');panel();
  this.announceActive();window.dispatchEvent(new CustomEvent('humanlab:character-replaced'));
  return this.list();
 }
 announceActive(){const actor=this.active,detail={instanceId:actor.id,identity:npcCopy(actor.identity)},parentAPI=window.parent!==window?window.parent.JarvisEmbodimentLab:null;
  if(parentAPI?.populationActivateContext)parentAPI.populationActivateContext(detail);
  else window.parent.postMessage({type:'LIFE_AGENT_EVENT',protocol:'life_agent/runtime@1.0',id:'humanoid',event:'population_active_changed',timestamp:Date.now(),detail},'*');
 }
 updateIdentity(id,input){
  const actor=this.get(id),identity={residentId:String(input.residentId||id).slice(0,64),displayName:String(input.displayName||actor.label).trim().slice(0,24),role:String(input.role||'general').slice(0,48)};
  if(!identity.displayName)throw Error('NPC 姓名不能为空');actor.identity=identity;actor.label=identity.displayName;actor.human.characterPreset={...actor.human.characterPreset,label:identity.displayName};this.changed();return npcCopy(identity);
 }
 definitionFor(actor){
  return validateNPCDefinition({...actor.definition,character:{...actor.human.characterPreset,label:actor.label,strength:actor.agent.strength.export(),biology:actor.tissue.ecology.export()},attachments:{...actor.definition.attachments,hair:{assetId:'builtin/r2-hair-v1',enabled:actor.hair.enabled}}});
 }
 refreshDefinition(){const a=this.active;a.definitionId=a.human.characterPreset.id;a.label=a.human.characterPreset.label;a.definition.character=npcCopy(a.human.characterPreset);this.changed();}
 replaceActive(nextHuman,nextAgent,nextSurface){
  const actor=this.active;actor.human=nextHuman;actor.agent=nextAgent;actor.tissue=nextHuman.tissue;actor.compact=nextSurface;nextAgent.npcId=actor.id;
  actor.definition.character=npcCopy(nextHuman.characterPreset);actor.label=nextHuman.characterPreset.label;actor.definitionId=nextHuman.characterPreset.id;this.bindSurface(actor);this.changed();
 }
 positionFor(h,requested,exclude=null,staged=[]){
  const radius=bodyPhysicalProfile(h).bodyRadiusM+.06,b=this.lab.world.bounds;
  const free=p=>!this.lab.world.collision(p,radius)&&![...this.values(),...staged].some(a=>a.id!==exclude&&horizontal(a.agent.pos,p)<radius+bodyPhysicalProfile(a.human).bodyRadiusM+.12);
  if(requested!==undefined){if(!Array.isArray(requested)||requested.length!==3||!requested.every(Number.isFinite)||Math.abs(requested[1])>1e-8)throw Error('出生位置必须是 [x,0,z] 米');if(!free(requested))throw Error('出生位置被物体或其他 NPC 占用');return [...requested];}
  const preferred=this.active?.agent.pos||findHumanSpawn(this.lab.world,h),candidates=[];
  for(let z=b.zMin+radius+.1;z<b.zMax-radius;z+=1.2)for(let x=b.xMin+radius+.1;x<b.xMax-radius;x+=1.2)candidates.push([x,0,z]);
  candidates.sort((a,b)=>horizontal(a,preferred)-horizontal(b,preferred));const result=candidates.find(free);if(!result)throw Error('场景没有可用的 NPC 出生空间');return result;
 }
 place(actor,position,yaw=0){
  if(!Number.isFinite(yaw))throw Error('NPC 朝向无效');const a=actor.agent;a.pos=[position[0],a.locomotion.rig.hipHeight,position[2]];a.yaw=yaw;
  a.locomotion.resetFromPose();actor.human.pose();a.saveSafe();
 }
 async stage(definition,options={},staged=[]){
  let id=options.instanceId;if(id===undefined){do{id='npc-'+(++this.serial);}while(this.actors.has(id)||this.pendingIds.has(id));}
  if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(id)||this.actors.has(id)||this.pendingIds.has(id)||staged.some(a=>a.id===id))throw Error('NPC 实例 ID 无效或重复');
  const slots=definition.attachments;if(slots.outfit.length||slots.accessories.length||slots.hair.assetId&&slots.hair.assetId!=='builtin/r2-hair-v1')throw Error('NPC 引用的服装或附件尚未安装');
  const h=new Human(definition.character);h.tissue=new ReconstructionState(h);
  const position=this.positionFor(h,options.position,null,staged);
  const a=new Agent(h,this.lab.world,()=>{},{staged:true,spawnPosition:position,spawnYaw:options.yaw??0}),actor=this.context(id,definition,h,a),revision=this.lab.world.revision;
  this.place(actor,position,options.yaw??0);this.pendingIds.add(id);
  try{
   const data=await loadCompactSurface('preview',false,compactSourceRig(h),'surface',definition.character.appearance.hair,definition.character.shape);
   if(this.closed||this.lab.world.revision!==revision)throw Error('生成期间场景已变化，请重新生成 NPC');
   this.positionFor(h,position,null,staged);actor.compact=new CompactSurfaceRenderer(actor,data);
   if(options.identity)actor.identity={residentId:String(options.identity.residentId||id).slice(0,64),displayName:String(options.identity.displayName||actor.label).slice(0,24),role:String(options.identity.role||'general').slice(0,48)};
   return actor;
  }catch(error){this.pendingIds.delete(id);actor.compact?.dispose();throw error;}
 }
 async spawn(definitionId,options={}){
  if(this.closed||this.actors.size+this.pending>=NPC_INSTANCE_LIMIT)throw Error('当前最多保留 '+NPC_INSTANCE_LIMIT+' 个 NPC，请先移除空闲人物');
  const definition=typeof definitionId==='string'?this.lab.npc.get(definitionId):validateNPCDefinition(definitionId);
  this.pending++;this.changed();let actor;
  try{
   actor=await this.stage(definition,options);
   if(this.closed)throw Error('NPC 场景已关闭');if(this.actors.has(actor.id))throw Error('NPC 实例 ID 已被使用');this.positionFor(actor.human,[actor.agent.pos[0],0,actor.agent.pos[2]]);
   this.actors.set(actor.id,actor);this.selected.add(actor.id);this.startHair(actor);this.changed();
   if(definition.character.task.startOnSpawn&&definition.character.task.command)this.dispatch(definition.character.task.command,{targets:[actor.id]});
   return actor.id;
  }catch(error){actor?.compact?.dispose();throw error;}finally{if(actor)this.pendingIds.delete(actor.id);this.pending--;this.changed();}
 }
 startHair(actor){
  if(!actor.hair.enabled){actor.hairStatus={state:'disabled'};return;}
  startCompactHair(actor).catch(error=>{actor.logs.unshift('毛发生成失败：'+error.message);}).finally(()=>{if(!actor.disposed)this.changed();});
 }
 async installMotherPair(){
  if(this.motherPairTask)return this.motherPairTask;
  this.motherPairTask=(async()=>{
   const mother=this.active,definition=npcMotherVariant(this.definitionFor(mother));
   this.lab.npc.define(definition,{replace:true});
   // Prefer the mother's right side. Existing clearance checks select a fallback
   // when that spot is occupied; never move the original actor or scene objects.
   const candidate=[mother.agent.pos[0]+1.05,0,mother.agent.pos[2]],probe=new Human(definition.character);
   let position;try{position=this.positionFor(probe,candidate);}catch{position=this.positionFor(probe);}
   const id=await this.spawn(definition,{position,yaw:mother.agent.yaw,identity:{residentId:'r2-mother-variant',displayName:'母体复制体',role:'general'}});
   this.motherPairIds=[mother.id,id];
   const displayPanel=window.parent.document.querySelector('.compact-panel');if(displayPanel)displayPanel.open=false;
   this.focus(this.motherPairIds);return id;
  })();return this.motherPairTask;
 }
 async installReviewCast(){
  if(this.reviewCastTask)return this.reviewCastTask;
  this.reviewCastTask=(async()=>{
   const mother=this.get(this.motherPairIds?.[0]||this.activeId),origin=[...mother.agent.pos],ids=[];
   for(const [index,spec]of npcReviewCast().entries()){
    await startupStage('population','正在生成对照角色 '+(index+1)+'/4：'+spec.label);
    const definition=validateNPCDefinition({character:{id:spec.id,label:spec.label,seed:spec.seed,shape:spec.shape,
     appearance:{skin:spec.skin,hair:{...spec.hair,seed:spec.seed},face:spec.face},task:{command:'',startOnSpawn:false}}});
    this.lab.npc.define(definition,{replace:true});
    const existing=[...this.values()].find(a=>a.definitionId===spec.id);if(existing){ids.push(existing.id);continue;}
    const probe=new Human(definition.character),candidate=[origin[0]+spec.offset[0],0,origin[2]+spec.offset[2]];
    let position;try{position=this.positionFor(probe,candidate);}catch{position=this.positionFor(probe);}
    const id=await this.spawn(definition,{position,yaw:mother.agent.yaw,identity:{residentId:spec.id,displayName:spec.label.split(' · ')[0],role:spec.role}});
    // Standby actors retain collision ownership but need no idle pose updates.
    // Existing dispatch/setBehavior explicitly wake the requested recipient.
    this.get(id).agent.paused=true;ids.push(id);
   }
   this.reviewCastIds=ids;this.focus('all');return ids;
  })();return this.reviewCastTask;
 }
 focus(targets='all'){
  const actors=this.targets(targets),r=this.lab.renderer;
  const xs=actors.map(a=>a.agent.pos[0]),zs=actors.map(a=>a.agent.pos[2]),height=Math.max(...actors.map(a=>a.human.bodyMetrics.statureM));
  const width=Math.max(...xs)-Math.min(...xs)+1.0,depth=Math.max(...zs)-Math.min(...zs),aspect=Math.max(.3,r.canvas.clientWidth/Math.max(1,r.canvas.clientHeight));
  this.lab.focus('body');r.projection='perspective';r.yaw=0;r.pitch=.035;
  r.distance=Math.max(height*1.23,(width+.25)/aspect)/(2*Math.tan(.72/2))+depth*.5;
  r.target=[(Math.min(...xs)+Math.max(...xs))/2,height*.5,(Math.min(...zs)+Math.max(...zs))/2];r.orthoHeight=Math.max(height*1.23,(width+.25)/aspect,depth*.2+height*1.15);
  needsRedraw=true;this.lab.render();
 }
 collisionFor(a,p,radius){return [...this.values()].some(other=>other.id!==a.npcId&&other.agent!==a&&!other.disposed&&horizontal(p,other.agent.pos)<radius+bodyPhysicalProfile(other.human).bodyRadiusM+.06);}
 sweepFor(a,start,end,radius){let fraction=1;for(const other of this.values())if(other.id!==a.npcId&&other.agent!==a&&!other.disposed)fraction=Math.min(fraction,motionCircleSweep(start,end,other.agent.pos,radius+bodyPhysicalProfile(other.human).bodyRadiusM+.06));return fraction;}
 resourceStep(a,request){return parse(request.text,this.lab.world,a.lastObject).steps.find(step=>step&&['carry','push'].includes(step.type))||null;}
 resourceConflict(a,request,step=this.resourceStep(a,request)){
  if(!step)return null;const o=this.lab.world.get(step.objectId),objectOwner=this.claims.get(step.objectId)||(o?.held?(o.heldOwner??'main'):null);
  if(objectOwner&&objectOwner!==a.npcId)return{kind:'object',id:step.objectId,ownerId:objectOwner,step};
  const stationOwner=this.stationClaims.get(step.targetId);if(stationOwner&&stationOwner!==a.npcId)return{kind:'station',id:step.targetId,ownerId:stationOwner,step};
  if(this.physicsOwner&&this.physicsOwner!==a.npcId)return{kind:'manipulation',id:'shared-physics',ownerId:this.physicsOwner,step};return null;
 }
 reserveResource(actor,request){
  const a=actor.agent,step=this.resourceStep(a,request);if(!step){actor.resource={mode:'clear',requestKey:null,attempts:0,diversions:actor.resource?.diversions||0,conflict:null,anchor:null};return null;}
  request.resourceTicket??=(this.resourceSerial=(this.resourceSerial||0)+1);
  const conflict=this.resourceConflict(a,request,step);if(conflict)return conflict;
  let predecessor=null;
  for(const other of this.values()){
   const pending=other.queue[0],agent=other.agent;
   if(other===actor||other.disposed||agent.paused||agent.error||agent.characterEditInProgress||this.isReserved(agent))continue;
   if(pending?.source==='behavior'&&(!other.behavior.enabled||pending.behavior!==other.behavior))continue;
   if(pending?.resourceTicket<request.resourceTicket&&(!predecessor||pending.resourceTicket<predecessor.ticket))predecessor={id:other.id,ticket:pending.resourceTicket};
  }
  if(predecessor)return{kind:'turn',id:'shared-physics',ownerId:predecessor.id,step};
  this.claims.set(step.objectId,a.npcId);this.stationClaims.set(step.targetId,a.npcId);this.physicsOwner=a.npcId;
  actor.resource={mode:'reserved',requestKey:[request.source,request.text].join('|'),attempts:0,diversions:actor.resource?.diversions||0,conflict:null,anchor:[...a.pos]};return null;
 }
 resourceProgress(ownerId){
  const owner=this.actors.get(ownerId),a=owner?.agent;
  if(!a||owner.disposed||a.paused||a.error||a.characterEditInProgress)return null;
  const goal=a.route?.at(-1),distance=goal?Math.hypot(a.pos[0]-goal[0],a.pos[2]-goal[2]):null;
  return{key:JSON.stringify([ownerId,a.index,a.skill?.objectId,a.skill?.targetId,a.phase,a.stats?.completed,goal]),distance,steps:a.preflight?.steps||0};
 }
 resourceManeuvers(actor,conflict,maneuver){
  const a=actor.agent,owner=this.actors.get(conflict.ownerId)?.agent,skill=owner?.skill;
  const directions={left:[-1,0],forward:[0,1],right:[1,0],backward:[0,-1]},candidates=[];
  const areas=[];
  if(['carry','push'].includes(skill?.type)){
   const radius=(a.h?.bodyMetrics?.bodyRadiusM||.26)+(owner.h?.bodyMetrics?.bodyRadiusM||.26)+.3;
   for(const p of [owner.pos,skill.o?.p,skill.dest,skill.transferEnd])if(p)areas.push({p,radius});
  }
  for(const direction of npcResourceDirectionOrder(a.npcId,maneuver))for(const distanceM of [.65,.85,1.05]){
   const [x,z]=directions[direction],yaw=a.yaw||0,delta=[(Math.cos(yaw)*x+Math.sin(yaw)*z)*distanceM,(Math.cos(yaw)*z-Math.sin(yaw)*x)*distanceM],end=[a.pos[0]+delta[0],a.pos[2]+delta[1]];
   let penalty=0;
   for(const area of areas){
    const dx=area.p[0]-a.pos[0],dz=area.p[2]-a.pos[2],t=Math.max(0,Math.min(1,(dx*delta[0]+dz*delta[1])/(distanceM*distanceM)));
    const deficit=d=>Math.max(0,area.radius-d),start=deficit(Math.hypot(dx,dz));
    // Escape an area already occupied, but do not cut through another area
    // just because the endpoint is clear. Existing route/pose checks still apply.
    penalty+=2*deficit(Math.hypot(end[0]-area.p[0],end[1]-area.p[2]))+Math.max(0,deficit(Math.hypot(dx-t*delta[0],dz-t*delta[1]))-start);
   }
   candidates.push({direction,distanceM,penalty});
  }
  return candidates.sort((x,y)=>x.penalty-y.penalty);
 }
 startResourceCirculation(actor,request,conflict){
  const a=actor.agent,key=[request.source,request.text].join('|'),same=actor.resource?.requestKey===key,now=Number.isFinite(a.time)?a.time:(this.elapsedS||0);
  const contention=request.resourceContention??={startedAtS:now,progress:null,resets:0};
  if(now-contention.startedAtS>300)throw Error('等待共享资源超过 300 秒活跃任务时间，已停止重试：'+conflict.id);
  const progress=this.resourceProgress(conflict.ownerId),before=contention.progress;
  const advanced=progress&&before&&(progress.key!==before.key||progress.distance!=null&&before.distance!=null&&progress.distance<before.distance-.25||progress.steps>before.steps+32);
  if(progress&&(!before||advanced))contention.progress=progress;
  if(advanced)contention.resets++;
  const attempts=(same&&!advanced?actor.resource.attempts:0)+1;if(attempts>16)throw Error('共享资源持续被占用，完成 16 次机动且未观察到所有者进展：'+conflict.id);
  actor.queue.unshift(request);let lastError=null;const maneuver=(contention.maneuvers||0)+1;
  // Progress can reset the stall budget, never the physical diversion cycle.
  for(const {direction,distanceM} of this.resourceManeuvers(actor,conflict,maneuver))try{
   const step={type:'walk',direction,distanceM,referenceFrame:'self'};a.submitPlan({schema:'knowledge_human/checked_semantic_plan@1.0',steps:[step]});actor.running={source:'resource-circulation',kind:'command',text:'资源机动',requestKey:key};
   contention.maneuvers=maneuver;
   actor.resource={mode:'circulating',requestKey:key,attempts,progressResets:contention.resets,diversions:(actor.resource?.diversions||0)+1,conflict:{...conflict},anchor:actor.resource?.anchor||[...a.pos]};if(request.source==='behavior')actor.behavior.status='resourceCirculation';
   a.log(conflict.kind==='turn'?'较早请求 '+conflict.ownerId+' 优先接手共享资源，已改走备用路线后重试原任务':'共享资源 '+conflict.id+' 正由 '+conflict.ownerId+' 使用，已改走备用路线后重试原任务');this.observation?.event('resource-circulation',actor,{attempts,conflict:{...conflict},step});return true;
  }catch(error){lastError=error;}
  actor.queue.shift();throw Error('资源被占用且周边没有可执行的机动路线：'+conflict.id+(lastError?'；'+lastError.message:''));
 }
 claimObject(a,id,targetId=null){
  const owner=this.claims.get(id),o=this.lab.world.get(id);if(owner&&owner!==a.npcId||o?.held&&o.heldOwner!==a.npcId)throw Error('物体正由其他 NPC 使用：'+id);
  const stationOwner=targetId?this.stationClaims.get(targetId):null;if(stationOwner&&stationOwner!==a.npcId)throw Error('目标工位正由其他 NPC 使用：'+targetId);
  if(this.physicsOwner&&this.physicsOwner!==a.npcId)throw Error('已有 NPC 正在操作物体');if(targetId)this.stationClaims.set(targetId,a.npcId);this.physicsOwner=a.npcId;this.claims.set(id,a.npcId);
 }
 releaseObjects(a,{preserveResource=false}={}){
  a.locomotion?.releaseIntersection?.();
  for(const [id,owner]of this.claims)if(owner===a.npcId&&a.held?.id!==id){this.lab.world.physics?.clearManipulation(id);this.claims.delete(id);}if(!a.held)for(const [id,owner]of this.stationClaims)if(owner===a.npcId)this.stationClaims.delete(id);if(this.physicsOwner===a.npcId&&!a.held)this.physicsOwner=null;
  const actor=this.actors.get(a.npcId),keepResource=preserveResource||actor?.running?.source==='resource-circulation';if(actor&&!keepResource&&!a.held)actor.resource={mode:'clear',requestKey:null,attempts:0,diversions:actor.resource?.diversions||0,conflict:null,anchor:null};
 }
 dispatch(text,{targets='selected',mode='append'}={}){

  if(typeof text!=='string'||!text.trim()||text.length>4096)throw Error('请输入不超过 4096 字的动作指令');
  if(!['append','replace'].includes(mode))throw Error('任务提交模式无效');
  const actors=this.targets(targets);
  const result=actors.map(actor=>{try{
   if(this.isReserved(actor.agent))throw Error('此人物由任务面板或持续日常控制');
   if(actor.agent.characterEditInProgress)throw Error('此人物正在更新外观');
   if(mode==='append'&&actor.agent.error)throw Error('此人物已失败，请先停止或替换任务后重试：'+actor.agent.error);
   if(mode==='append'&&actor.queue.length>=64)throw Error('此人物等待队列已满');
   parse(text,this.lab.world,actor.agent.lastObject); // Syntax/targets only; forecast again at execution time.
   const keepPaused=mode==='append'&&actor.agent.paused&&!!(actor.running||actor.queue.length||actor.agent.activity().physicalBusy);
   if(mode==='replace'){if(actor.agent.held)throw Error('此人物仍在持物，请先继续完成放置');actor.agent.cancel();actor.queue=[];actor.running=null;}
   actor.behavior.enabled=false;actor.behavior.status='stopped';actor.behavior.error=null;actor.queue.push({text:text.trim(),source:'manual'});actor.agent.paused=keepPaused;this.pump(actor);if(actor.behavior.error)throw Error(actor.behavior.error);
   return{id:actor.id,accepted:true,queued:actor.queue.length};
  }catch(error){return{id:actor.id,accepted:false,reason:error.message};}});
  this.lab.setAuto(true);this.changed();return result;
 }
 control(action,targets='selected'){
  if(!['pause','resume','stop'].includes(action))throw Error('NPC 控制操作无效');
  const results=this.targets(targets).map(actor=>{try{
   if(this.isReserved(actor.agent))throw Error('请通过当前任务面板控制此人物');
   if(actor.agent.characterEditInProgress)throw Error('此人物正在更新外观');
   if(action==='stop'){actor.queue=[];actor.behavior.enabled=false;actor.behavior.status='stopped';actor.behavior.error=null;actor.behavior.waitUntil=null;actor.running=null;const result=actor.agent.cancel();this.releaseObjects(actor.agent);return{id:actor.id,accepted:true,...result};}
   if(action==='resume'&&actor.agent.error)throw Error('请先停止并处理此人物的错误');
   actor.agent.paused=action==='pause';if(actor.agent.paused)actor.agent.locomotion?.releaseIntersection?.();return{id:actor.id,accepted:true};
  }catch(error){return{id:actor.id,accepted:false,reason:error.message};}});
  this.lab.setAuto(true);this.changed();return results;
 }
 setBehavior(id,input){
  const actor=this.get(id);if(this.isReserved(actor.agent))throw Error('请先结束此人物在任务面板的控制');
  const recipe=npcTaskRecipe(input),steps=recipe.type==='repeat'?npcCompileTask(recipe.command,this.lab.world,actor.agent.lastObject):[];
  if(actor.agent.characterEditInProgress)throw Error('请等待此人物更新外观');
  if(recipe.type==='repeat'){
   if(actor.behavior.enabled||actor.queue.length||actor.running||actor.agent.activity().physicalBusy)throw Error('请先停止此人物的现有任务并等待收脚，再开始新任务');
   if(actor.agent.error)throw Error('请先停止并处理此人物的错误：'+actor.agent.error);
  }
  if(recipe.type==='repeat')this.observation?.start();
  actor.behavior=npcIdleBehavior(recipe,steps);actor.behavior.enabled=recipe.type==='repeat';actor.behavior.status=recipe.type==='repeat'?'scheduled':'idle';actor.behavior.nextAt=actor.agent.time;
  this.observation?.event('task-start',actor,{recipe});
  if(recipe.type==='repeat')actor.agent.paused=false;
  this.pump(actor);this.lab.setAuto(true);this.changed();if(actor.behavior.error)throw Error(actor.behavior.error);return this.list().find(row=>row.id===id).behavior;
 }
 finishBehavior(actor,reason){const b=actor.behavior;b.enabled=false;b.status='completed';b.finishReason=reason;b.waitUntil=null;}
 pump(actor){
  const a=actor.agent,b=actor.behavior;if(a.paused||a.error||a.characterEditInProgress||this.isReserved(a)||!a.activity().readyForTask)return;
  const timeLimit=b.durationS>0&&b.elapsedS>=b.durationS;
  if(actor.running){
   const previous=actor.running;
   if(previous.kind==='wait'&&b.enabled&&b.elapsedS<previous.until&&!timeLimit)return;
   const finishedStep=previous.kind!=='wait'||b.elapsedS>=previous.until;
   if(previous.source==='behavior'&&previous.behavior===b&&b.enabled&&finishedStep){
    b.waitUntil=null;b.stepIndex++;
    if(b.stepIndex===b.steps.length){b.cycles++;b.stepIndex=0;b.nextAt=a.time+b.intervalS;b.status='interval';if(b.cycleLimit>0&&b.cycles>=b.cycleLimit)this.finishBehavior(actor,'cycles');}
   }
   actor.running=null;this.releaseObjects(a,{preserveResource:previous.source==='resource-circulation'});
  }
  if(b.enabled&&timeLimit)this.finishBehavior(actor,'duration');
  let request=actor.queue.shift();
  if(request?.source==='behavior'&&(!b.enabled||request.behavior!==b))request=null;
  if(!request&&b.enabled&&a.time>=b.nextAt){const step=b.steps[b.stepIndex];request={text:step.text,source:'behavior',behavior:b,kind:step.kind,seconds:step.seconds};}
  if(!request)return;
  try{
   if(request.kind!=='wait'){const conflict=this.reserveResource(actor,request);if(conflict){this.startResourceCirculation(actor,request,conflict);return;}}
   if(request.source==='behavior')b.status=request.kind==='wait'?'waiting':'running';
   if(request.kind==='wait'){request.until=b.elapsedS+request.seconds;b.waitUntil=request.until;}else a.submit(request.text,{cooperative:true});
   actor.running=request;
  }catch(error){b.error=error.message;b.status='failed';if(request.source==='behavior')b.enabled=false;actor.queue=[];a.log('任务未开始：'+error.message);this.releaseObjects(a);}
 }
 deferPhysics(a){this.physicsDeferred.add(a);}
 // One shared physical clock. PhysicsWorld freezes a paused actor's held
 // body locally; other actors and free bodies retain their independent clocks.
 physicsPaused(){return !this.hasActive();}
 tick(dt){this.clock.advance(dt,step=>this.tickFixed(step),!this.hasActive());}
 tickFixed(step){
  const physics=this.lab.world.physics,checkpoint=physics?.capture(),worldRevision=this.lab.world.revision,routineBefore=structuredClone(this.lab.world.routineState),elapsedBefore=this.elapsedS;
  this.physicsTickActive=true;
  this.elapsedS+=step;advanceRoutineEnvironment(this.lab.world,step);this.physicsDeferred.clear();
  // Includes pauses/task changes made by the semantic and routine entry points.
  // Paused actors still remain physical obstacles in sweepFor/collisionFor.
  if(typeof trafficPruneIntersections==='function')trafficPruneIntersections(this,trafficRuntime(this),this.elapsedS);
  if(typeof trafficPruneCorridors==='function')trafficPruneCorridors(this,trafficRuntime(this),this.elapsedS);
  for(const actor of this.values()){
   if(actor.disposed||actor.agent.characterEditInProgress)continue;
   const tickStarted=this.observation?.recording?performance.now():null;
   this.pump(actor);const a=actor.agent,before=a.time,taskClock=actor.behavior.enabled&&!a.paused&&!this.isReserved(a);a.tick(step);actor.tissue.update(a.time,a.time-before,a.held?.mass||0);
   if(taskClock){actor.behavior.elapsedS+=a.time-before;if(actor.running?.kind!=='wait'&&actor.behavior.durationS>0&&actor.behavior.elapsedS>=actor.behavior.durationS)actor.behavior.status='finishing';}
   actor.compact?.hair?.update(a.paused?0:step);
   if(a.error){actor.behavior.enabled=false;actor.behavior.error=a.error;actor.behavior.status='failed';actor.queue=[];actor.running=null;this.releaseObjects(a);}else this.pump(actor);
   if(tickStarted!==null)this.observation.actorTick(actor,performance.now()-tickStarted);
  }
  try{
   // The physics adapter receives every live actor, including paused actors
   // as stationary obstacles. Object claims still serialize manipulation.
   {
    physics?.step(step,[...this.values()].filter(a=>!a.disposed).map(a=>a.agent));
    for(const a of this.physicsDeferred){a.stats.physicsSteps++;if(a.held&&!a.paused)a.assessManipulationFeedback(step);}
   }
   this.physicsTickActive=false;
   for(const a of this.physicsDeferred)if(a.pendingPhysicsFinish&&!a.error){a.finish();a.tick(0);}
  }catch(error){
   this.physicsTickActive=false;
   if(checkpoint)physics.restore(checkpoint);
   this.lab.world.revision=worldRevision;this.lab.world.routineState=routineBefore;this.elapsedS=elapsedBefore;
   for(const a of this.physicsDeferred){a.pendingPhysicsFinish=false;a.fail('共享物理步进未通过：'+error.message);const actor=this.actors.get(a.npcId);if(actor){actor.behavior.enabled=false;actor.behavior.error=a.error;actor.behavior.status='failed';actor.queue=[];actor.running=null;this.releaseObjects(a);this.observation?.event('error',actor,{error:a.error,phase:a.phase,position:[...a.pos],sharedPhysics:true});}}
   if(this.observation?.recording)this.observation.persist();
  }finally{this.physicsTickActive=false;}
 }
 hasActive(){return [...this.values()].some(a=>!a.agent.paused);}
 requireWorldIdle(){if(this.lab.character.busy||this.active.compactQualityPending||this.active.hairTask)throw Error('请等待当前人物更新完成');if(window.__jarvisRoutineReservation||window.__jarvisSemanticReservation)throw Error('请先结束任务或持续日常');if(this.pending)throw Error('请先等待 NPC 生成完成');for(const actor of this.values()){requireCharacterIdle(actor.agent,'修改共享场景',{reservations:false});if(actor.queue.length||actor.behavior.enabled)throw Error('请先停止所有 NPC 的队列和持续行为');}}
 guardWorldReplacement(){this.requireWorldIdle();if(this.actors.size>1)throw Error('替换整个场景前请先移除额外 NPC；已有场景仍可编辑');}
 guardReset(){this.requireWorldIdle();if(this.actors.size>1)throw Error('多人场景请通过 NPC 控制停止任务；重置站位前请移除额外 NPC');}
 remove(id){
  const actor=this.get(id);if(this.actors.size===1)throw Error('请至少保留一个 NPC');this.editorGuard();
  requireCharacterIdle(actor.agent,'移除 NPC');if(actor.queue.length||actor.behavior.enabled)throw Error('请先停止此 NPC 的队列和持续行为');
  if(id===this.activeId)this.activate([...this.actors.keys()].find(key=>key!==id));
  actor.disposed=true;this.releaseObjects(actor.agent);actor.compact?.dispose();this.actors.delete(id);this.selected.delete(id);if(!this.selected.size)this.selected.add(this.activeId);this.changed();return this.list();
 }
 exportScene(){return{schema:NPC_POPULATION_SCHEMA,sceneId:this.lab.world.sceneId,instances:[...this.values()].map(a=>({definition:this.definitionFor(a),identity:npcCopy(a.identity),position:[a.agent.pos[0],0,a.agent.pos[2]],yaw:a.agent.yaw,behavior:npcTaskRecipe(a.behavior)})),runtimeStateIncluded:false};}
 async importScene(input){
  if(!input||input.schema!==NPC_POPULATION_SCHEMA||!Array.isArray(input.instances)||!input.instances.length||input.instances.length+this.actors.size+this.pending>NPC_INSTANCE_LIMIT)throw Error('NPC 群组配方无效或超过 8 人上限');
  const specs=input.instances.map(v=>{
   if(!v||typeof v!=='object')throw Error('NPC 配方条目无效');
   const behavior=npcTaskRecipe(v.behavior||{type:'manual',command:'',intervalS:4}),steps=behavior.type==='repeat'?npcCompileTask(behavior.command,this.lab.world):[];
   if(v.position!==undefined&&(!Array.isArray(v.position)||v.position.length!==3||!v.position.every(Number.isFinite)||v.position[1]!==0))throw Error('NPC 配方出生位置无效');
   if(v.yaw!==undefined&&!Number.isFinite(v.yaw))throw Error('NPC 配方朝向无效');
   return{definition:validateNPCDefinition(v.definition),identity:v.identity,position:v.position,yaw:v.yaw??0,behavior:npcIdleBehavior(behavior,steps)};
  }); // Import adds idle actors. Rehome occupied positions; never resume saved actions.
  const staged=[];this.pending+=specs.length;this.changed();
  try{for(const spec of specs){
    let position=spec.position;
    // Stage validates positions against current bodies. An imported group is
    // a new population, so overlapping saved positions are placed in free space.
    if(position&&[...this.values(),...staged].some(a=>horizontal(a.agent.pos,position)<1.2))position=undefined;
    const actor=await this.stage(spec.definition,{identity:spec.identity,position,yaw:spec.yaw},staged);actor.behavior=spec.behavior;staged.push(actor);
   }
   for(const actor of staged)this.positionFor(actor.human,[actor.agent.pos[0],0,actor.agent.pos[2]],actor.id,staged);
   if(this.closed)throw Error('NPC 场景已关闭');
   for(const actor of staged){this.actors.set(actor.id,actor);this.selected.add(actor.id);this.startHair(actor);}this.changed();return staged.map(a=>a.id);
  }catch(error){for(const actor of staged){actor.disposed=true;actor.compact?.dispose();}throw error;}
  finally{for(const actor of staged)this.pendingIds.delete(actor.id);this.pending-=specs.length;this.changed();}
 }
 disposeAll(){this.closed=true;for(const actor of this.values()){actor.disposed=true;actor.agent.locomotion?.releaseIntersection?.();actor.compact?.dispose();}this.claims.clear();this.stationClaims.clear();this.physicsOwner=null;}
}
function installNPCPopulation(lab){const population=new NPCPopulation(lab);lab.population=population;installNPCPopulationControls(lab,population);population.announceActive();window.addEventListener('pagehide',event=>{if(!event.persisted)population.disposeAll();});return population;}
