/* Reusable R9 appearance + spawn-task data for the single-character prototype.
 * A seed deterministically chooses bounded authoring parameters. No random mesh
 * construction happens on motion frames; future crowds need their own manager. */
function validateCharacterPreset(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('角色预设必须为对象');
 const allowed=['schema','bodyPlanRevision','bodyArchetype','id','label','seed','bodySex','statureM','appearance','task','strength','biology'];
 for(const k of Object.keys(input))if(!allowed.includes(k))throw Error('未知角色预设字段：'+k);
 if(input.schema!=null&&!['jarvis/character_preset@1','jarvis/character_preset@2'].includes(input.schema))throw Error('不支持此角色预设格式');
 if(input.bodyPlanRevision!=null&&input.bodyPlanRevision!==9)throw Error('角色骨架比例版本不一致');
 if(input.statureM!=null&&input.statureM!==1.75)throw Error('当前预设使用 1.75 m 基准骨架');
 const sex=input.bodySex??BODY_SEX;if(!Object.hasOwn(BODY_PRESET_CONFIG,sex))throw Error('角色预设性别无效');
 if(input.bodyArchetype!=null&&input.bodyArchetype!==BODY_ARCHETYPES[sex].id)throw Error('角色骨架母版与性别或版本不一致');
 const appearance=input.appearance??{},allowedAppearance=['lowerBody','torso','headNeck','shoulder','skinColor','morphs','skinLayers'];
 if(typeof appearance!=='object'||Array.isArray(appearance))throw Error('外形参数必须为对象');
 for(const k of Object.keys(appearance))if(!allowedAppearance.includes(k))throw Error('未知外形参数：'+k);
 const shape=(value,limits,validate)=>{
  const data=value===undefined?{}:value;
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!Object.hasOwn(limits,k)))throw Error('外形参数字段无效');
  return validate(data);
 };
 const color=appearance.skinColor??[.43,.29,.22];
 if(!Array.isArray(color)||color.length!==3||color.some(v=>!Number.isFinite(v)||v<.08||v>.8))throw Error('肤色必须是设计范围内的三个数值');
 const task=input.task??{};if(typeof task!=='object'||Array.isArray(task)||Object.keys(task).some(k=>!['command','startOnSpawn'].includes(k)))throw Error('任务预设格式无效');
 const command=task.command??'';if(typeof command!=='string'||command.length>4096)throw Error('角色任务文本过长或格式无效');
 if(task.startOnSpawn!=null&&typeof task.startOnSpawn!=='boolean')throw Error('自动开始标记必须为布尔值');
 const id=input.id??'adult175';if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(id))throw Error('角色 ID 格式无效');
 const label=input.label??'175 cm 成人';if(typeof label!=='string'||label.length>80)throw Error('角色名称格式无效');
 const seed=input.seed??0;if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('角色种子必须为 32 位非负整数');
 const strength=input.strength==null?new StrengthModel(makeCharacterStrengthProfile(sex)).export():StrengthModel.fromSnapshot(input.strength).export();
 const morphs=validateCharacterMorphs(appearance.morphs,sex);
 if(appearance.morphs===undefined){
  const set=(key,value)=>{if(value!==undefined){const [a,b]=CHARACTER_MORPH_LIMITS[key];morphs[key]=Math.max(a,Math.min(b,value));}};
  set('chestWidth',appearance.torso?.chestWidth);set('waistWidth',appearance.torso?.waistWidth);set('neckWidth',appearance.headNeck?.neckWidth);
  set('limbVolume',appearance.lowerBody?.thighVolume??appearance.shoulder?.upperArmWidth);set('softness',appearance.lowerBody?.softness);
 }
 return {schema:'jarvis/character_preset@2',bodyPlanRevision:9,bodyArchetype:BODY_ARCHETYPES[sex].id,id,label,seed,bodySex:sex,statureM:1.75,strength,biology:validateBiologySnapshot(input.biology),
  appearance:{morphs,skinLayers:validateSkinLayerSettings(appearance.skinLayers),lowerBody:shape(appearance.lowerBody,LOWER_BODY_SHAPE_LIMITS,validateLowerBodyShape),torso:shape(appearance.torso,TORSO_SHAPE_LIMITS,validateTorsoShape),headNeck:shape(appearance.headNeck,HEAD_NECK_SHAPE_LIMITS,validateHeadNeckShape),shoulder:shape(appearance.shoulder,SHOULDER_SHAPE_LIMITS,validateShoulderShape),skinColor:[...color]},
  task:{command:command.trim(),startOnSpawn:task.startOnSpawn===true}};
}
function seededCharacterPreset(seed,base={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('角色种子必须为 32 位非负整数');
 let state=seed>>>0;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},range=(a,b)=>a+(b-a)*next();
 const p=validateCharacterPreset(base);p.seed=seed;p.id='adult175-'+seed;p.label='成人预设 '+seed;
 p.appearance.lowerBody={calfVolume:range(.92,1.16),thighVolume:range(.93,1.12),gluteVolume:range(.9,1.13),softness:range(.87,1.22)};
 p.appearance.torso={...p.appearance.torso,chestWidth:range(.97,1.04),waistWidth:range(.96,1.04),pectoralVolume:range(.84,1.17)};
 p.appearance.headNeck={...p.appearance.headNeck,neckWidth:range(.95,1.06),scmDefinition:range(.6,1.2)};
 p.appearance.shoulder={...p.appearance.shoulder,deltoidFullness:range(.93,1.10),upperArmWidth:range(.95,1.06)};
 const morphs=p.appearance.morphs;
 for(const key of ['shoulderWidth','chestWidth','waistWidth','hipWidth','neckWidth','limbVolume','softness','faceWidth']){const [a,b]=CHARACTER_MORPH_LIMITS[key];morphs[key]=Math.max(a,Math.min(b,morphs[key]*range(.96,1.04)));}
 if(morphs.breastProjectionM>0)morphs.breastProjectionM=Math.min(CHARACTER_MORPH_LIMITS.breastProjectionM[1],morphs.breastProjectionM*range(.85,1.15));
 const colors=[[.31,.19,.135],[.38,.245,.175],[.43,.29,.22],[.52,.36,.26],[.61,.44,.33]];p.appearance.skinColor=[...colors[Math.floor(next()*colors.length)]];
 return validateCharacterPreset(p);
}
function initialCharacterPreset(){const p=validateCharacterPreset(window.__BODY_PRESET_STATE__?.character||window.__NPC_DEFINITION__?.character||window.__CHARACTER_PRESET__||{bodySex:BODY_SEX});p.bodySex=BODY_SEX;return p;}
function installCharacterPresetAPI(lab){
 const api={busy:false,
  export(){const h=lab.human,p=h.characterPreset||validateCharacterPreset();return validateCharacterPreset({...p,bodySex:h.bodySex,strength:lab.agent.strength.export(),biology:h.tissue.ecology.export(),appearance:{morphs:{...p.appearance.morphs},skinLayers:validateSkinLayerSettings(p.appearance.skinLayers),lowerBody:{...h.lowerBodyShape},torso:{...h.torsoShape},headNeck:{...h.headNeckShape},shoulder:{...(h.shoulderShape||SHOULDER_SHAPE_DEFAULT)},skinColor:[...h.tissue.skinColor]}});},
  sample:seed=>seededCharacterPreset(seed,api.export()),
  async apply(input){
   const preset=validateCharacterPreset(input);
   if(preset.bodySex!==BODY_SEX)throw Error('请先切换到角色预设对应的性别，再导入');
   if(api.busy||lab.torso.busy||lab.headNeck.busy||lab.shoulders.busy||lab.hands.busy)throw Error('请等待当前形体重建完成');
   if(lab.agent.held||lab.agent.skill||lab.agent.basic?.busy||(lab.agent.plan&&lab.agent.index<lab.agent.plan.steps.length))throw Error('请先完成或停止当前身体任务');
   if(characterRigSignature(preset)!==ADULT_SPEC.rigShapeSignature){switchBodyPreset(preset.bodySex,preset,null,true);return {reloading:true};}
   const h=lab.human,old={lowerBodyShape:h.lowerBodyShape,torsoShape:h.torsoShape,headNeckShape:h.headNeckShape,shoulderShape:h.shoulderShape,characterPreset:h.characterPreset,tissue:h.tissue,strength:h.strength,bones:h.bones,cartilage:h.cartilage,records:h.records,evidence:h.evidence};
   api.busy=true;const paused=lab.agent.paused;lab.agent.paused=true;try{
    await new Promise(resolve=>setTimeout(resolve,0));
    h.lowerBodyShape=preset.appearance.lowerBody;h.torsoShape=preset.appearance.torso;h.headNeckShape=preset.appearance.headNeck;h.shoulderShape=preset.appearance.shoulder;h.characterPreset=preset;h.strength=StrengthModel.fromSnapshot(preset.strength);
    const tissue=new ProceduralTissue(h);tissue.view=old.tissue.view;h.tissue=tissue;lab.tissue=tissue;lab.agent.strength=h.strength;lab.agent.strengthLastLengths=null;lab.renderer.setTissue(tissue);lab.renderer.lastItems=[];
    lab.hands.cache={};lab.hands.cachedGeometry=null;lab.lowerLimb.sideMeshes=new WeakMap();
    for(const [key,shape]of [['torso',h.torsoShape],['headNeck',h.headNeckShape],['shoulders',h.shoulderShape]]){const w=lab[key];w.draft={...shape};for(const[k,v]of Object.entries(shape))w.sync?.('shape',k,v);}
    h.tissue.update(lab.agent.time,0);lab.biology?.refresh();needsRedraw=true;lab.render();return api.export();
   }catch(error){Object.assign(h,old);lab.agent.strength=old.strength;lab.tissue=old.tissue;lab.renderer.setTissue(old.tissue);lab.renderer.lastItems=[];throw error;}
   finally{api.busy=false;lab.agent.paused=paused;}
  },
  async applyLowerBody(shape){const p=api.export();p.appearance.lowerBody=validateLowerBodyShape(shape);return api.apply(p);},
  setTask(command,startOnSpawn=false){const p=api.export();p.task={command,startOnSpawn};lab.human.characterPreset=validateCharacterPreset(p);return api.export();},
  startTask(){
   const task=api.export().task;if(!task.command)return {started:false,reason:'empty task'};
   if(api.busy||lab.agent.skill||lab.agent.held||lab.agent.basic?.busy)throw Error('当前身体任务或形体重建尚未结束');
   // Resolve task targets against the actual scene before leaving inspection.
   parse(task.command,lab.world,lab.agent.lastObject);
   for(const key of ['lowerLimb','headNeck','torso','shoulders','hands'])if(lab[key].active)lab[key].leave();
   lab.agent.submit(task.command);lab.setAuto(true);lab.human.characterTaskStatus={started:true,command:task.command};return {...lab.human.characterTaskStatus};
  },
  startOnSpawn(){return api.export().task.startOnSpawn?api.startTask():{started:false,reason:'manual start'};}
 };
 return api;
}
