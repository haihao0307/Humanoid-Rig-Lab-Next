/* Two tiny generated props and seven parameter-only return zones. */
const NPC_ROUTINE_TEMPLATES=Object.freeze({
 wateringCan:{templateId:'wateringCan',name:'浇水壶',category:'日常工具',shape:'box',w:.24,h:.28,d:.22,mass:.9,color:[.30,.48,.55],movable:true,collidable:true},
 waterPoint:{templateId:'waterPoint',name:'村庄取水点',category:'日常设施',shape:'box',w:.42,h:.92,d:.5,mass:80,color:[.44,.48,.43],movable:false,collidable:true}
});
function routineFurniture(def){
 if(def.shape!=='box'||!Object.hasOwn(NPC_ROUTINE_TEMPLATES,def.templateId))return null;
 const{w,h,d}=def,parts=[],part=(x,y,z,W,H,D,color=def.color)=>parts.push({g:transform(box(W,H,D),[x,y-h/2,z]),color});
 if(def.templateId==='wateringCan'){
  part(-w*.10,h*.40,0,w*.66,h*.72,d*.92);part(w*.34,h*.52,0,w*.32,h*.10,d*.18);part(w*.43,h*.64,0,w*.12,h*.24,d*.23);
  for(const z of [-d*.38,d*.38])part(-w*.12,h*.86,z,w*.12,h*.25,d*.12);part(-w*.12,h*.965,0,w*.12,h*.07,d*.85);
 }else{
  part(0,h*.06,0,w,h*.12,d,[.52,.52,.46]);part(0,h*.43,-d*.23,w*.25,h*.75,d*.22,[.27,.35,.32]);
  part(0,h*.75,0,w*.2,h*.10,d*.7,[.30,.38,.36]);part(0,h*.68,d*.3,w*.13,h*.16,d*.13);
  part(w*.19,h*.91,-d*.23,w*.45,h*.05,d*.1,[.25,.29,.27]);
 }
 return campColored(parts);
}
function createRoutineEnvironment(){const c=window.JarvisNPCRoutineCatalog;return{schema:'jarvis/npc_routine_environment@1',elapsedS:0,pendingS:0,revision:0,needs:Object.fromEntries(c.data.routines.map(r=>[r.id,r.initialNeed])),completed:Object.fromEntries(c.data.routines.map(r=>[r.id,0])),lastServiced:Object.fromEntries(c.data.routines.map(r=>[r.id,null]))}}
function installNPCRoutineWorld(world,addObject){
 // Keep the can clear of TREE_D's collision footprint (left edge x=11.3).
 addObject('waterPoint','WATER_PT','村庄取水点',[12.15,0,-8.7],{aliases:['取水点','水泵']});
 addObject('wateringCan','WATER_A','日常浇水壶',[10.95,0,-8.1],{aliases:['水壶','浇水壶']});
 for(const home of window.JarvisNPCRoutineCatalog.data.homes){const o=world.get(home.object);if(!o)throw Error('日常归位对象缺失：'+home.object);world.zones.push(world.normalizeZone({id:home.zone,name:home.label,p:[o.p[0],0,o.p[2]],r:.65,shape:'square',color:[.39,.49,.48],aliases:[home.label]},home.zone));}
 world.routineState=createRoutineEnvironment();
}
function advanceRoutineEnvironment(world,dt){
 const s=world.routineState;if(world.theme!=='camp'||!s)return;s.pendingS+=dt;if(s.pendingS<1)return;
 const elapsed=s.pendingS;s.pendingS=0;s.elapsedS+=elapsed;
 for(const r of window.JarvisNPCRoutineCatalog.data.routines)s.needs[r.id]=Math.min(1,s.needs[r.id]+elapsed/r.period);
}
function routineEnvironmentSnapshot(world){const s=world.routineState;return world.theme==='camp'&&s?JSON.parse(JSON.stringify(s)):null}
function restoreRoutineEnvironment(world,input){
 if(world.theme!=='camp'){world.routineState=null;return}
 const s=createRoutineEnvironment();if(input?.schema===s.schema){
  const number=(v,min,max,fallback)=>Number.isFinite(v)&&v>=min&&v<=max?v:fallback;
  s.elapsedS=number(input.elapsedS,0,1e12,0);s.revision=number(input.revision,0,1e9,0);
  for(const r of window.JarvisNPCRoutineCatalog.data.routines){s.needs[r.id]=number(input.needs?.[r.id],0,1,r.initialNeed);s.completed[r.id]=Math.floor(number(input.completed?.[r.id],0,1e9,0));s.lastServiced[r.id]=number(input.lastServiced?.[r.id],0,s.elapsedS,null);}
 }world.routineState=s;
}
function installRoutineWorldAPI(lab){
 const receipts=new Map();
 return{
  get owner(){return window.__jarvisRoutineReservation||null;},
  snapshot:()=>routineEnvironmentSnapshot(lab.world),
  bindIdentity(input){const identity=validateNPCBehavior(input);if(!identity)throw Error('缺少 NPC 日常身份');window.__NPCRoutineIdentity__=identity;return identity;},
  prepare(){
   environmentIdleGuard();const w=lab.world;if(w.theme!=='camp')throw Error('日常设施需要军营与邻村场景');let added=0;const missing=[];
   for(const [id,templateId,name,p]of [['WATER_PT','waterPoint','村庄取水点',[12.15,0,-8.7]],['WATER_A','wateringCan','日常浇水壶',[10.95,0,-8.1]]]){
    if(w.get(id))continue;if(w.objects.length>=160){missing.push(id);continue}
    const o=w.normalizeObject({...NPC_ROUTINE_TEMPLATES[templateId],id,name,p},id),check=w.canPlace(o,null,lab.agent.pos);
    if(!check.ok){missing.push(id);continue}w.objects.push(o);added++;
   }
   for(const home of window.JarvisNPCRoutineCatalog.data.homes){if(w.get(home.zone))continue;const o=w.get(home.object);if(!o||w.zones.length>=32){missing.push(home.zone);continue}w.zones.push(w.normalizeZone({id:home.zone,name:home.label,p:[o.p[0],0,o.p[2]],r:.65,shape:'square',color:[.39,.49,.48],aliases:[home.label]},home.zone));added++;}
   if(!w.routineState)w.routineState=createRoutineEnvironment();if(added){w.touch('routine.prepare');environmentChanged('routine.prepare');}
   return{added,missing,state:routineEnvironmentSnapshot(w)};
  },
  complete({owner,cycleId,routineId}){
   if(!owner||window.__jarvisRoutineReservation!==owner)throw Error('日常循环预约身份不匹配');
   if(typeof cycleId!=='string'||cycleId.length>160)throw Error('日常验收编号无效');
   const signature=owner+'|'+routineId;
   if(receipts.has(cycleId)){const previous=receipts.get(cycleId);if(previous.signature!==signature)throw Error('日常验收编号已用于其他任务');return{...previous.result,duplicate:true};}
   const a=lab.agent,w=lab.world,s=w.routineState,r=window.JarvisNPCRoutineCatalog.recipe(routineId);
   if(!r||r.role!==window.__NPCRoutineIdentity__?.role)throw Error('日常任务与当前身份不匹配');
   if(w.theme!=='camp'||!s)throw Error('当前场景没有日常状态');
   if(!a.activity().readyForTask)throw Error('人物尚未结束本轮动作和收脚');
   const verification=window.JarvisNPCRoutineCatalog.verify(routineId,w.snapshot(),{pos:a.pos,posture:a.basic.posture,heldObject:a.held?.id||null});
   if(!verification.ok)throw Error(verification.reasons.join('；'));
   s.needs[routineId]=0;s.completed[routineId]=Math.min(1e9,s.completed[routineId]+1);s.lastServiced[routineId]=s.elapsedS;s.revision=Math.min(1e9,s.revision+1);
   const result={verified:true,routineId,cycleId,verification,state:routineEnvironmentSnapshot(w)};
   receipts.set(cycleId,{signature,result:{verified:true,routineId,cycleId,verification}});if(receipts.size>32)receipts.delete(receipts.keys().next().value);
   return result;
  }
 };
}
