/* Identity/capacity and an authored, bounded variant of the locked R2 body. */
const CHARACTER_MORPH_LIMITS=Object.freeze(Object.fromEntries(SHAPE_PARAMETER_SPECS.map(({id,min,max,neutral})=>[id,Object.freeze({min,max,neutral})])));
function makeCharacterStrengthProfile(sex=BODY_SEX,id='balanced'){if(sex!==BODY_SEX)throw Error('当前只使用同源 R2 人体');return makeStrengthProfile(id);}
function validateSkinLayerSettings(input={}){if(input.subcutaneousScale!=null&&input.subcutaneousScale!==1)throw Error('R2 形体未开放未经校准的皮层修改');return {subcutaneousScale:1};}
function validateCharacterPreset(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('角色定义必须为对象');
 if(input.schema!==undefined&&!['jarvis/character_preset@3','jarvis/character_preset@4','jarvis/character_preset@5','jarvis/character_preset@6'].includes(input.schema))throw Error('不支持的角色定义版本');
 if(input.bodySex!=null&&input.bodySex!==BODY_SEX)throw Error('当前人体固定为 R2 参考，旧男女构造已移除');
 const id=input.id??'r2-reference',label=input.label??'R2 参考人物',seed=input.seed??0;
 if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(id)||typeof label!=='string'||label.length>80||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('角色名称、ID 或种子无效');
 const task=input.task??{},command=task.command??'';if(typeof command!=='string'||command.length>4096)throw Error('角色任务文本无效');
 const appearance=input.appearance===undefined?{}:input.appearance;
 skinObject(appearance,'角色外观');
 if(Object.keys(appearance).some(k=>!['skin','skinColor','skinLayers','hair','face'].includes(k)))throw Error('旧体型构造参数已移除，请使用 R2 定义');
 const skin=characterSkinAppearance(appearance);
 const shape=validateCharacterShape(input.shape),statureM=R2_RIG.sourceHeightM*shape.statureScale;
 if(input.statureM!==undefined&&(typeof input.statureM!=='number'||!Number.isFinite(input.statureM)||Math.abs(input.statureM-statureM)>1e-8))throw Error('身高读数与体型比例不一致；请通过 shape.statureScale 设置身高');
 return {schema:'jarvis/character_preset@6',bodyPlanRevision:17,bodyArchetype:'r2-source-reference',id,label,seed,bodySex:BODY_SEX,shape,statureM,
  appearance:{skin,skinColor:skinHexToLinear(skin.baseColor),skinLayers:validateSkinLayerSettings(appearance.skinLayers),hair:validateHairProfile(appearance.hair,seed,HAIR_CATALOG),face:validateFacePose(appearance.face)},
  strength:input.strength?StrengthModel.fromSnapshot(input.strength).export():new StrengthModel(makeCharacterStrengthProfile()).export(),
  biology:validateBiologySnapshot(input.biology),task:{command:command.trim(),startOnSpawn:task.startOnSpawn===true}};
}
function seededCharacterPreset(seed,base={}){return validateCharacterPreset({...base,seed,id:'r2-'+seed,label:'R2 角色 '+seed,appearance:{...base.appearance,skin:sampleSkinAppearance(seed),hair:{...base.appearance?.hair,seed:undefined},face:{identity:sampleFaceIdentity(seed)}}});}
function initialCharacterPreset(){return validateCharacterPreset(window.__NPC_DEFINITION__?.character||window.__CHARACTER_PRESET__||{label:'立体男性参考',appearance:{face:{identity:{shape:FACE_SCULPTED_MALE_SHAPE}},skin:{baseColor:'#c7a18d',roughness:.60,oil:.15,redness:.16}}});}
function installCharacterPresetAPI(lab){
 const api={busy:false,
  export(){return validateCharacterPreset({...lab.human.characterPreset,strength:lab.agent.strength.export(),biology:lab.human.tissue.ecology.export()});},
  sample:seed=>seededCharacterPreset(seed,api.export()),
  async apply(input){const p=validateCharacterPreset(input);requireCharacterIdle(lab.agent,'切换角色定义');
   if(lab.population&&(lab.population.active.queue.length||lab.population.active.behavior.enabled))throw Error('请先停止当前 NPC 的等待队列和循环行为，再编辑人物');
   if(api.busy)throw Error('上一份角色定义正在应用');api.busy=true;
   const editAgent=lab.agent;editAgent.characterEditInProgress=true;let preparedBody=null;
   try{
    lab.face?.stop();lab.face?.endSample();
    const previousDefinition=lab.human.characterPreset;
    if(!sameCharacterShape(p.shape,previousDefinition.shape)){
     preparedBody=await prepareCharacterBody(lab,p,previousDefinition);preparedBody.commit();
     refreshCharacterControls(lab);return api.export();
    }
    const strength=StrengthModel.fromSnapshot(p.strength),ecology=new HumanEcology({human:{characterPreset:p,strength}},p.biology);
    const commitHair=await lab.hair.prepare(p.appearance.hair);
    requireCharacterIdle(lab.agent,'切换角色定义',{allowCharacterEdit:true});
    if(lab.human.characterPreset!==previousDefinition)throw Error('计算期间角色定义已更新，请重新应用');
    commitHair();
    lab.human.characterPreset=p;lab.human.tissue.setSkinAppearance(p.appearance.skin);lab.human.strength=strength;lab.agent.strength=strength;ecology.tissue=lab.human.tissue;lab.human.tissue.ecology=ecology;lab.agent.saveSafe();refreshCharacterControls(lab);return api.export();
   }catch(error){if(lab.hairStatus?.state==='loading')lab.hairStatus={state:lab.compact?.hair?'ready':'failed',error:error.message};throw error;}
   finally{try{preparedBody?.dispose();}catch(error){console.error('暂存人物资源清理失败',error);}finally{editAgent.characterEditInProgress=false;api.busy=false;}
    if(!lab.compact?.disposed&&!lab.compact?.hair&&lab.hairStatus?.state==='pending')scheduleCompactHair(lab);
   }},
  setTask(command,startOnSpawn=false){lab.human.characterPreset=validateCharacterPreset({...api.export(),task:{command,startOnSpawn}});return api.export();},
  startTask(){const t=api.export().task;if(!t.command)return {started:false,reason:'empty task'};lab.agent.submit(t.command);lab.setAuto(true);return {started:true,command:t.command};},
  startOnSpawn(){return api.export().task.startOnSpawn?api.startTask():{started:false,reason:'manual start'};}
 };return api;
}
