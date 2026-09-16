/* Versioned recipes shared by independently owned runtime NPC instances. */
const NPC_CONTRACT=Object.freeze({schema:'jarvis/npc_definition@1',bodyAssetFamily:'reconstructed-r2@1',rigProfile:'r2-source-rig-r7',motionProfile:'motion-lab-r2.2-task-extensions@1',behaviorProfile:'task-agent@1'});
const npcCopy=v=>JSON.parse(JSON.stringify(v));
function npcFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(npcFreeze);Object.freeze(value);}return value;}
function validateNPCBehavior(input){
 if(input==null)return null;
 const p=window.JarvisNPCRoutineCatalog.data.residents.find(p=>p.id===input.presetId),name=String(input.displayName||p?.name||'').trim();
 if(!p||input.schema&&input.schema!=='jarvis/npc_behavior@1'||input.role!==p.role||!name||name.length>24||Object.keys(input).some(k=>!['schema','presetId','role','displayName'].includes(k)))throw Error('NPC 日常身份定义无效');
 return{schema:'jarvis/npc_behavior@1',presetId:p.id,role:p.role,displayName:name};
}
function validateNPCDefinition(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('NPC 定义必须是对象');
 const allowed=[...Object.keys(NPC_CONTRACT),'character','attachments','behavior'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('NPC 定义含未知字段');
 // Existing R2 definitions contain authored identity/capacity, never a saved
 // animation. Their previous motion-profile label can migrate to this kernel.
 for(const [key,value]of Object.entries(NPC_CONTRACT))if(input[key]!=null&&input[key]!==value&&!(key==='motionProfile'&&input[key]==='cmu-reference-retarget@1'))throw Error('NPC 版本或兼容性不符：'+key);
 const character=validateCharacterPreset(input.character||{});
 // A reusable definition stores capacity, not another instance's fatigue.
 character.strength=new StrengthModel(character.strength.profile).export();
 character.biology=validateBiologySnapshot({environment:character.biology.environment});
 const slots=input.attachments??{hair:{assetId:'builtin/r2-hair-v1',enabled:true},outfit:[],accessories:[]};
 if(!slots||typeof slots!=='object'||Array.isArray(slots)||Object.keys(slots).some(k=>!['hair','outfit','accessories'].includes(k)))throw Error('NPC 外观部件格式无效');
 const hair=slots.hair??{assetId:null,enabled:false};
 if(!hair||typeof hair!=='object'||Array.isArray(hair)||Object.keys(hair).some(k=>!['assetId','enabled'].includes(k))||typeof hair.enabled!=='boolean'||(hair.assetId!==null&&(typeof hair.assetId!=='string'||!/^[-a-zA-Z0-9_/.@]{1,96}$/.test(hair.assetId))))throw Error('发型引用格式无效');
 const refs=key=>{const list=slots[key]??[];if(!Array.isArray(list)||list.length>16||list.some(v=>typeof v!=='string'||!/^[-a-zA-Z0-9_/.@]{1,96}$/.test(v))||new Set(list).size!==list.length)throw Error('部件引用格式无效：'+key);return [...list];};
 return {...NPC_CONTRACT,character,behavior:validateNPCBehavior(input.behavior),attachments:{hair:{...hair},outfit:refs('outfit'),accessories:refs('accessories')}};
}
function installNPCDefinitionAPI(lab){
 const definitions=new Map();let activeDefinition=null;
 const api={
  capabilities:()=>({previewInstances:NPC_INSTANCE_LIMIT,bodySex:[BODY_SEX],archetypeRevision:17,compositionDrivesGeometry:false,shapeDrivesGeometry:true,morphs:SHAPE_PARAMETER_SPECS.map(spec=>spec.id),morphLimits:structuredClone(CHARACTER_MORPH_LIMITS),
   arbitraryStature:false,statureScaleRange:{...CHARACTER_STATURE_RANGE},statureRangeM:[R2_RIG.sourceHeightM*CHARACTER_STATURE_RANGE.min,R2_RIG.sourceHeightM*CHARACTER_STATURE_RANGE.max],
   shapeMethod:CHARACTER_SHAPE_REVISION,shapeStatus:'Candidate',runtimeVerified:false,visualAcceptance:false,crowdRuntime:true,independentControl:true,groupControl:true,maxInstances:NPC_INSTANCE_LIMIT,attachmentAssets:['builtin/r2-hair-v1']}),
  spawn:(definitionId,options)=>lab.population.spawn(definitionId,options),
  instances:()=>lab.population.list(),
  define(input,{replace=false}={}){const d=validateNPCDefinition(input),id=d.character.id;if(definitions.has(id)&&!replace)throw Error('NPC 定义 ID 已存在：'+id);definitions.set(id,npcFreeze(d));return npcCopy(d);},
  list:()=>[...definitions.values()].map(d=>({id:d.character.id,label:d.character.label,bodySex:d.character.bodySex,seed:d.character.seed,statureM:d.character.statureM,shape:npcCopy(d.character.shape),behavior:d.behavior})),
  get(id){if(!definitions.has(id))throw Error('NPC 定义不存在：'+id);return npcCopy(definitions.get(id));},
  geometryKey(id=null){return characterShapeKey(id===null?lab.human.characterPreset.shape:api.get(id).character.shape);},
  derive(id,seed,newId){if(typeof newId!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(newId))throw Error('派生角色需要新的有效 ID');const d=api.get(id);d.character=seededCharacterPreset(seed,d.character);d.character.id=newId;d.character.label=definitions.get(id).character.label+' · '+seed;return api.define(d);},
  export(){if(lab.population)return lab.population.definitionFor(lab.population.active);const p=lab.character.export(),hair=lab.hair;return validateNPCDefinition({...NPC_CONTRACT,character:p,behavior:window.__NPCRoutineIdentity__||activeDefinition?.behavior||null,attachments:{...(activeDefinition?.attachments||{outfit:[],accessories:[]}),hair:{assetId:hair?'builtin/r2-hair-v1':null,enabled:!!hair?.enabled}}});},
  createSpawnRecord(definitionId,instanceId){
   if(typeof instanceId!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(instanceId))throw Error('NPC 实例 ID 无效');
   const definition=api.get(definitionId);
   return {schema:'jarvis/npc_spawn_record@1',instanceId,definitionId,definition,
    state:{schema:'jarvis/npc_runtime_state@1',strength:npcCopy(definition.character.strength.state),biology:npcCopy(definition.character.biology),task:{status:'idle',command:definition.character.task.command,behavior:npcCopy(definition.behavior),routineMemory:{completedCycles:0,lastRoutine:null,enabled:false}},pose:null},instantiated:false};
  },
  async preview(input){
   if(window.__jarvisRoutineReservation)throw Error('请先结束持续日常，再切换 NPC 身体');
   const d=typeof input==='string'?api.get(input):validateNPCDefinition(input),slots=d.attachments;
   if(slots.outfit.length||slots.accessories.length||(slots.hair.assetId!==null&&slots.hair.assetId!=='builtin/r2-hair-v1'))throw Error('当前预览器尚未安装定义中引用的外观部件');

   const result=await lab.character.apply(d.character);if(result?.reloading)return result;activeDefinition=d;window.__NPCRoutineIdentity__=d.behavior;if(lab.population){const a=lab.population.active;a.definition=npcCopy(d);a.definitionId=d.character.id;a.label=d.character.label;a.identity={residentId:d.behavior?.presetId||a.id,displayName:d.behavior?.displayName||d.character.label.slice(0,24),role:d.behavior?.role||'general'};lab.population.changed();lab.population.announceActive();}
   if(lab.hair){lab.hair.enabled=slots.hair.enabled;lab.hair.refreshControls?.();}
   api.define(d,{replace:true});needsRedraw=true;lab.render();return api.export();
  }
 };
 api.define({character:{id:'base-r2',label:'R2 参考人体',bodySex:BODY_SEX}});
 for(const preset of CHARACTER_STATURE_PRESETS)api.define({character:{id:'stature-'+preset.id,label:preset.label+'身高 · '+(R2_RIG.sourceHeightM*preset.statureScale*100).toFixed(1)+' cm',shape:{statureScale:preset.statureScale}}});
 for(const preset of CHARACTER_FORM_PRESETS)api.define({character:{id:'form-'+preset.id,label:preset.label,shape:preset.shape}});
 for(const [i,p]of window.JarvisNPCRoutineCatalog.data.residents.entries())api.define({character:{id:p.id,label:p.name+' · '+p.title,bodySex:lab.human.bodySex,seed:(i+1)*4101,appearance:{skin:sampleSkinAppearance((i+1)*4101),hair:{preset:['crop','side-part','textured'][i%3]}}},behavior:{presetId:p.id,role:p.role,displayName:p.name}});
 const initial=window.__BODY_PRESET_STATE__?.npc||window.__NPC_DEFINITION__;
 if(initial){const d=validateNPCDefinition(initial);activeDefinition=d;api.define(d,{replace:true});if(lab.hair){lab.hair.enabled=d.attachments.hair.enabled;lab.hair.refreshControls?.();}}
 installNPCDefinitionControls(lab,api);return api;
}
function installNPCDefinitionControls(lab,api){
 const panel=document.createElement('section');panel.id='npc-panel';panel.hidden=true;
 panel.innerHTML='<h3>角色定义</h3><p>当前人物可保存体型比例、身高、皮肤、毛发和面部参数。新增多人请使用 NPC 生成与控制面板。调整体型前请先起身并站稳。</p><label>角色 <select id="npc-choice"></select></label><button id="npc-apply">使用角色</button><button id="npc-export">导出角色</button><label>导入角色 <input id="npc-import" type="file" accept=".json,application/json"></label><output id="npc-status" role="status"></output>';
 document.body.append(panel);const el=id=>panel.querySelector('#npc-'+id);
 for(const p of api.list()){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;el('choice').append(option);}
 el('apply').onclick=async()=>{try{await api.preview(el('choice').value);el('status').textContent='角色定义已更新';}catch(e){el('status').textContent=e.message;}};
 el('export').onclick=()=>{const d=api.export();hfDownload(d.character.id+'.npc.json',JSON.stringify(d,null,2),'application/json');};
 el('import').onchange=async()=>{try{const f=el('import').files[0];if(!f||f.size>262144)throw Error('角色文件为空或过大');await api.preview(JSON.parse(await f.text()));el('status').textContent='已导入';}catch(e){el('status').textContent=e.message;}finally{el('import').value='';}};
}
